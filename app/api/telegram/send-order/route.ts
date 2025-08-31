import { NextResponse } from "next/server"

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ""
const ADMIN_IDS = (process.env.TELEGRAM_ADMIN_IDS || "")
  .split(",")
  .map((id) => Number(id.trim()))
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || "OtrodyaBot"

const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

async function sendMessage(chatId: number, text: string, extra: any = {}) {
  await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...extra }),
  })
}

export async function POST(req: Request) {
  try {
    const order = await req.json()

    const orderId = order.orderId

    const text = [
      "🛒 <b>Новый заказ</b>",
      `№: <code>${orderId}</code>`,
      "",
      "Товары:",
      order.items
        .map(
          (i: any) =>
            `${i.name} — ${i.size || ""} × ${i.quantity} = ${i.price}`
        )
        .join("\n"),
      "",
      "Клиент:",
      `Имя: ${order.customerName}`,
      `Телефон: ${order.phone}`,
      `Email: ${order.email}`,
      `Город: ${order.city}`,
      `Адрес: ${order.address}`,
      `Индекс: ${order.postalCode}`,
      "",
      `Доставка: ${order.deliveryPrice}`,
      `Итого: ${order.totalPrice}`,
      "",
      `🔗 <a href="https://t.me/${BOT_USERNAME}?start=order_${orderId}">Открыть/создать чат с клиентом</a>`,
    ].join("\n")

    for (const adminId of ADMIN_IDS) {
      await sendMessage(adminId, text, { disable_web_page_preview: true })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("send-order error", e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
