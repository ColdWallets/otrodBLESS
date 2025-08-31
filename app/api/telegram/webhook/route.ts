import { NextResponse } from "next/server"

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ""
const ADMIN_IDS = (process.env.TELEGRAM_ADMIN_IDS || "")
  .split(",")
  .map((id) => Number(id.trim()))
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || "OtrodyaBot"

const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

// --- Helpers
async function sendMessage(chatId: number, text: string, replyMarkup?: any) {
  await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: replyMarkup,
    }),
  })
}

async function answerCallbackQuery(cbId: string, text: string) {
  await fetch(`${TELEGRAM_API_URL}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: cbId, text }),
  })
}

function makeAdminConnectKeyboard(userId: number) {
  return {
    inline_keyboard: [
      [{ text: "👤 Подключиться к чату", callback_data: `admin_connect:${userId}` }],
    ],
  }
}

// --- In-memory state
type UserSession = {
  chatId: number
  orderId?: string
  status: "new" | "waiting_for_operator" | "connected_to_operator"
  welcomeSent?: boolean
}

const userSessions = new Map<number, UserSession>()
const activeChats = new Map<number, number>() // userId -> adminId

// --- Webhook handler
export async function POST(req: Request) {
  const update = await req.json()

  // --- Handle callback (админ подключается к клиенту)
  if (update.callback_query) {
    const cb = update.callback_query
    const fromId = cb.from.id
    const data = cb.data

    if (data.startsWith("admin_connect:")) {
      const userId = Number(data.split(":")[1])
      if (userSessions.has(userId)) {
        activeChats.set(userId, fromId)
        await answerCallbackQuery(cb.id, "Подключено к клиенту")
        await sendMessage(
          fromId,
          `✅ Подключено к чату с пользователем <code>${userId}</code>.`
        )
        await sendMessage(userId, "Оператор подключился к чату ✅")
        const s = userSessions.get(userId)!
        userSessions.set(userId, { ...s, status: "connected_to_operator" })
      } else {
        await answerCallbackQuery(cb.id, "Пользователь не найден")
      }
    }

    return NextResponse.json({ ok: true })
  }

  // --- Handle text message
  if (update.message) {
    const msg = update.message
    const fromId = msg.from.id
    const chatId = msg.chat.id
    const text = msg.text || ""

    // payload (например start=order_12345)
    const payload =
      msg.text && msg.text.startsWith("/start")
        ? msg.text.split(" ")[1]
        : undefined

    // Новый клиент зашел по ссылке с заказом
    if (payload && payload.startsWith("order_")) {
      const orderId = payload.replace("order_", "")

      const already = userSessions.has(fromId)
      userSessions.set(fromId, {
        chatId,
        orderId,
        status: "waiting_for_operator",
      })

      if (!already) {
        for (const adminId of ADMIN_IDS) {
          await sendMessage(
            adminId,
            [
              "🆕 <b>Новый клиент в боте</b>",
              `Пользователь: <code>${fromId}</code>`,
              `Заказ: <code>${orderId}</code>`,
            ].join("\n"),
            makeAdminConnectKeyboard(fromId)
          )
        }
      }
    }

    // --- Если пишет админ
    if (ADMIN_IDS.includes(fromId)) {
      for (const [uid, adminId] of activeChats.entries()) {
        if (adminId === fromId) {
          await sendMessage(uid, text)
        }
      }
      return NextResponse.json({ ok: true })
    }

    // --- Если пишет клиент
    if (activeChats.has(fromId)) {
      const adminId = activeChats.get(fromId)!
      await sendMessage(adminId, `Сообщение от <code>${fromId}</code>:\n${text}`)
    } else {
      const session = userSessions.get(fromId)
      if (session && session.status === "waiting_for_operator") {
        if (!session.welcomeSent) {
          await sendMessage(
            fromId,
            "✅ Ваш заказ принят! Оператор скоро подключится."
          )
          userSessions.set(fromId, { ...session, welcomeSent: true })
        }

        for (const adminId of ADMIN_IDS) {
          await sendMessage(
            adminId,
            `📩 Новое сообщение от <code>${fromId}</code>:\n${text}`,
            makeAdminConnectKeyboard(fromId)
          )
        }
      }
    }
  }

  return NextResponse.json({ ok: true })
}
