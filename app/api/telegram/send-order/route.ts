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
  let body: any
  try {
    body = await req.json()
    console.log("👉 RAW ORDER BODY:", JSON.stringify(body, null, 2)) // 👈 ЛОГ В VERCEL

    // пробуем достать заказ
    const order = body.order ? body.order : body
    if (!order) {
      throw new Error("Нет данных заказа в body")
    }

    const orderId = order.orderId || order.id || "—"

    const itemsText = (order.items || [])
      .map(
        (i: any) =>
          `${i.name || "??"} — ${i.size || ""} × ${i.quantity || 1} = ${
            i.price || 0
          }`
      )
      .join("\n")

    const text = [
      "🛒 <b>Новый заказ</b>",
      `№: <code>${orderId}</code>`,
      "",
      "Товары:",
      itemsText || "—",
      "",
      "Клиент:",
      `Имя: ${order.customerName || "??"}`,
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

    // 🔧 отправим сырой JSON прямо админу, чтобы видеть что прилетает
    const rawJson = JSON.stringify(body || {}, null, 2)
    for (const adminId of ADMIN_IDS) {
      await sendMessage(
        adminId,
        `⚠️ Ошибка обработки заказа\n\n<pre>${rawJson}</pre>`,
        { disable_web_page_preview: true }
      )
    }

    return NextResponse.json(
      {
        ok: false,
        error: String(e),
        requestBody: body || "не удалось распарсить",
      },
      { status: 500 }
    )
  }
}
