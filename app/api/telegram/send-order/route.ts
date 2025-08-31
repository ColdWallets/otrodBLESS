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

    // Универсально: если прилетает { order: {...} }, то берём order
    const order = body.order ? body.order : body

    const orderId = order.orderId || order.id || "—"

    const items = order.items || order.cart || []
    const itemsText = Array.isArray(items)
      ? items
          .map(
            (i: any) =>
              `${i.name || "??"} — ${i.size || ""} × ${i.quantity || 1} = ${
                i.price || 0
              }`
          )
          .join("\n")
      : "—"

    const text = [
      "🛒 <b>Новый заказ</b>",
      `№: <code>${orderId}</code>`,
      "",
      "Товары:",
      itemsText,
      "",
      "Клиент:",
      `Имя: ${order.customerName || order.name || "??"}`,
      `Телефон: ${order.phone || "??"}`,
      `Email: ${order.email || "??"}`,
      `Город: ${order.city || "??"}`,
      `Адрес: ${order.address || "??"}`,
      `Индекс: ${order.postalCode || "??"}`,
      "",
      `Доставка: ${order.deliveryPrice ?? "??"}`,
      `Итого: ${order.totalPrice ?? "??"}`,
      "",
      `🔗 <a href="https://t.me/${BOT_USERNAME}?start=order_${orderId}">Открыть/создать чат с клиентом</a>`,
    ].join("\n")

    for (const adminId of ADMIN_IDS) {
      await sendMessage(adminId, text, { disable_web_page_preview: true })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("send-order error", e)
    return NextResponse.json(
      { ok: false, error: String(e), stack: (e as any).stack },
      { status: 500 }
    )
  }
}
