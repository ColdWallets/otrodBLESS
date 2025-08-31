import { NextResponse } from "next/server"

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ""
const ADMIN_IDS = (process.env.TELEGRAM_ADMIN_IDS || "")
  .split(",")
  .map((id) => Number(id.trim()))
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

type ChatState = {
  adminId?: number
  active: boolean
}

const activeChats = new Map<number, ChatState>() // userId -> state

async function sendMessage(chatId: number, text: string, extra: any = {}) {
  await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      ...extra,
    }),
  })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    if (body.message) {
      const msg = body.message
      const chatId = msg.chat.id
      const userId = msg.from.id
      const text = msg.text || ""

      // если пишет клиент
      if (!ADMIN_IDS.includes(userId)) {
        const chat = activeChats.get(userId)

        if (!chat) {
          // впервые → уведомляем админов и ставим статус "ожидание"
          activeChats.set(userId, { active: false })
          for (const adminId of ADMIN_IDS) {
            await sendMessage(
              adminId,
              `🆕 Новый клиент в боте\nПользователь: ${userId}\n\nНажмите кнопку ниже, чтобы начать переписку.`
            )
          }
          // отправляем клиенту только один раз автоответ
          await sendMessage(
            chatId,
            "Спасибо! Оператор скоро ответит здесь."
          )
        } else {
          // если чат уже активен → не флудим автоответом
          const { adminId } = chat
          if (adminId) {
            await sendMessage(adminId, `💬 Сообщение от клиента ${userId}:\n${text}`)
          }
        }
      }

      // если пишет админ
      if (ADMIN_IDS.includes(userId)) {
        const match = text.match(/\/chat (\d+)/)
        if (match) {
          const targetId = Number(match[1])
          activeChats.set(targetId, { active: true, adminId: userId })
          await sendMessage(
            userId,
            `✅ Вы подключились к чату с клиентом ${targetId}`
          )
          await sendMessage(targetId, "Оператор подключился к чату.")
        } else {
          // ищем к какому клиенту привязан этот админ
          const entry = [...activeChats.entries()].find(
            ([, state]) => state.adminId === userId
          )
          if (entry) {
            const [clientId] = entry
            await sendMessage(clientId, text)
          }
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("webhook error", e)
    return NextResponse.json({ ok: false, error: String(e) })
  }
}
