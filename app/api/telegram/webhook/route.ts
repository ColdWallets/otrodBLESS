import { type NextRequest, NextResponse } from "next/server"

const TELEGRAM_BOT_TOKEN = "8369763130:AAFDJGzAw36tiPdLfBkD610knG_pGUwQ47o"
const ADMIN_ID = "6772742245"
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

// Store user sessions (in production, use a database)
const userSessions = new Map()

async function sendMessage(chatId: string, text: string, replyMarkup?: any) {
  const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: replyMarkup,
      parse_mode: "HTML",
    }),
  })

  return response.json()
}

export async function POST(request: NextRequest) {
  try {
    const update = await request.json()

    if (update.message) {
      const message = update.message
      const chatId = message.chat.id.toString()
      const text = message.text
      const userId = message.from.id.toString()

      if (text === "/start") {
        // Handle /start command
        const welcomeText = `🛍️ <b>Добро пожаловать в OTRODYA!</b>

Ваш заказ:
📦 <b>ОТРОДЬЕ ДЕНЬГИ</b> - 16,000 ₸
📍 <b>Адрес доставки:</b> Будет указан после оформления
🚚 <b>Тип доставки:</b> Курьерская доставка

Для завершения оформления заказа и оплаты нажмите кнопку ниже:`

        const keyboard = {
          inline_keyboard: [
            [
              {
                text: "💬 Связаться с оператором для оплаты",
                callback_data: "contact_operator",
              },
            ],
          ],
        }

        await sendMessage(chatId, welcomeText, keyboard)
      }
    }

    if (update.callback_query) {
      const callbackQuery = update.callback_query
      const chatId = callbackQuery.message.chat.id.toString()
      const userId = callbackQuery.from.id.toString()
      const data = callbackQuery.data

      if (data === "contact_operator") {
        // Connect user with operator
        userSessions.set(userId, { chatId, status: "waiting_for_operator" })

        const operatorText = `🔔 <b>Новый клиент!</b>

👤 Пользователь: ${callbackQuery.from.first_name || "Неизвестно"}
🆔 ID: ${userId}
📱 Username: @${callbackQuery.from.username || "не указан"}

Клиент хочет связаться с оператором для оплаты заказа.`

        const operatorKeyboard = {
          inline_keyboard: [
            [
              {
                text: "✅ Принять заказ",
                callback_data: `accept_order_${userId}`,
              },
            ],
          ],
        }

        // Send notification to admin
        await sendMessage(ADMIN_ID, operatorText, operatorKeyboard)

        // Confirm to user
        await sendMessage(
          chatId,
          `✅ <b>Запрос отправлен!</b>

Оператор свяжется с вами в ближайшее время для подтверждения заказа и оплаты.

⏰ Обычно это занимает не более 5 минут.`,
        )
      }

      if (data.startsWith("accept_order_")) {
        const targetUserId = data.replace("accept_order_", "")
        const userSession = userSessions.get(targetUserId)

        if (userSession) {
          userSession.status = "connected_to_operator"
          userSessions.set(targetUserId, userSession)

          // Notify admin
          await sendMessage(
            chatId,
            `✅ <b>Заказ принят!</b>

Теперь вы можете общаться с клиентом. Все ваши сообщения будут переданы клиенту.`,
          )

          // Notify user
          await sendMessage(
            userSession.chatId,
            `👨‍💼 <b>Оператор подключился!</b>

Здравствуйте! Я помогу вам с оформлением заказа и оплатой. Напишите ваши вопросы, и я отвечу в ближайшее время.`,
          )
        }
      }
    }

    // Handle messages from admin to users
    if (update.message && update.message.from.id.toString() === ADMIN_ID) {
      const text = update.message.text

      // Forward admin messages to all connected users
      for (const [userId, session] of userSessions.entries()) {
        if (session.status === "connected_to_operator") {
          await sendMessage(session.chatId, `👨‍💼 <b>Оператор:</b>\n\n${text}`)
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Telegram webhook error:", error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
