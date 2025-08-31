import { type NextRequest, NextResponse } from "next/server"

// ⚠️ Перенеси токены и ID в .env
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "YOUR_TOKEN_HERE"
const ADMIN_IDS = (process.env.TELEGRAM_ADMIN_IDS || "6772742245,1234567890")
  .split(",")
  .map((id) => id.trim())
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || "OtrodyaBot"

const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

// Состояния
type UserSession = {
  chatId: number
  orderId?: string
  status: "new" | "waiting_for_operator" | "connected_to_operator"
}

const userSessions = new Map<number, UserSession>()
const activeChats = new Map<number, string>() // userId -> adminId

// Helpers
async function sendMessage(chatId: number | string, text: string, replyMarkup?: any) {
  const res = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: replyMarkup,
    }),
    // @ts-ignore
    cache: "no-store",
  })
  return res.json()
}

async function answerCallbackQuery(id: string, text?: string) {
  await fetch(`${TELEGRAM_API_URL}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: id, text }),
  })
}

function makeAdminConnectKeyboard(userId: number) {
  return {
    inline_keyboard: [
      [{ text: "✉️ Начать чат с клиентом", callback_data: `admin_connect:${userId}` }],
      [{ text: "📋 Список активных", callback_data: "admin_list" }],
    ],
  }
}

export async function POST(req: NextRequest) {
  try {
    const update = await req.json()

    // --- Callback кнопки (действия админа)
    if (update.callback_query) {
      const cb = update.callback_query
      const fromId: string = String(cb.from.id)
      const data: string = cb.data

      if (ADMIN_IDS.includes(fromId)) {
        if (data.startsWith("admin_connect:")) {
          const userId = Number(data.split(":")[1])
          if (userSessions.has(userId)) {
            activeChats.set(userId, fromId)
            await answerCallbackQuery(cb.id, "Подключено к клиенту")
            await sendMessage(fromId, `✅ Подключено к чату с пользователем <code>${userId}</code>. Напишите сообщение — я перешлю.`)
            await sendMessage(userId, "Оператор подключился к чату ✅")
            userSessions.set(userId, { ...userSessions.get(userId)!, status: "connected_to_operator" })
          } else {
            await answerCallbackQuery(cb.id, "Пользователь не найден")
          }
        } else if (data === "admin_list") {
          await answerCallbackQuery(cb.id, "Открываю список")
          if (userSessions.size === 0) {
            await sendMessage(fromId, "Список пуст.")
          } else {
            let list = "Активные клиенты:\n\n"
            for (const [uid, s] of userSessions) {
              list += `• <code>${uid}</code> — статус: <b>${s.status}</b>${s.orderId ? `, заказ: <code>${s.orderId}</code>` : ""}\n`
            }
            await sendMessage(fromId, list, {
              inline_keyboard: [
                ...[...userSessions.keys()].map((uid) => [{ text: `Подключиться к ${uid}`, callback_data: `admin_connect:${uid}` }]),
              ],
            })
          }
        }
      }
      return NextResponse.json({ ok: true })
    }

    // --- Обычные сообщения
    if (update.message) {
      const msg = update.message
      const chatId: number = msg.chat.id
      const fromId: number = msg.from.id
      const text: string = msg.text || ""

      // Команда старта с заказом
      if (text.startsWith("/start")) {
        const payload = text.split(" ").slice(1).join(" ")
        if (payload && payload.startsWith("order_")) {
          const orderId = payload.replace("order_", "")
          const already = userSessions.has(fromId)

          userSessions.set(fromId, { chatId, orderId, status: "waiting_for_operator" })

          // Сообщение клиенту только один раз
          if (!already) {
            await sendMessage(chatId, [
              "✅ <b>Ваш заказ принят!</b>",
              "Для дальнейшего оформления и оплаты с вами свяжется наш оператор прямо в этом чате.",
              "",
              "Если у вас есть вопросы — просто напишите здесь."
            ].join("\n"))
          }

          // Уведомить всех админов
          for (const adminId of ADMIN_IDS) {
            await sendMessage(adminId, [
              "🆕 <b>Новый клиент в боте</b>",
              `Пользователь: <code>${fromId}</code>`,
              `Заказ: <code>${orderId}</code>`,
            ].join("\n"), makeAdminConnectKeyboard(fromId))
          }
        }
        return NextResponse.json({ ok: true })
      }

      // --- Если пишет админ
      if (ADMIN_IDS.includes(String(fromId))) {
        for (const [uid, adminId] of activeChats.entries()) {
          if (adminId === String(fromId)) {
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
        // Если оператор ещё не подключился — просто уведомляем админов
        for (const adminId of ADMIN_IDS) {
          await sendMessage(adminId, `📩 Новое сообщение от <code>${fromId}</code>:\n${text}`, makeAdminConnectKeyboard(fromId))
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("Webhook error:", err)
    return NextResponse.json({ ok: false })
  }
}
