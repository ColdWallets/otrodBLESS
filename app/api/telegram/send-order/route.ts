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
    // Можно оставить лог для дебага:
    console.log("👉 RAW ORDER BODY:", JSON.stringify(body, null, 2))

    // Твой фронт шлёт сразу объект (или в body.order) — поддержим оба варианта
    const order: any = body.order ? body.order : body

    // Генерируем orderId на сервере
    const orderId = Date.now()

    // Товары
    const itemsText = (order.items || [])
      .map(
        (i: any, idx: number) =>
          `${idx + 1}. ${i.product?.name || "??"} — ${i.size || ""} × ${
            i.quantity || 1
          } = ${(i.product?.price || 0) * (i.quantity || 1)}`
      )
      .join("\n")

    // Клиент
    const c = order.customer || {}
    const customerName = `${c.firstName || ""} ${c.lastName || ""}`.trim()

    // Текст уведомления админам
    const text = [
      "🛒 <b>Новый заказ</b>",
      `№: <code>${orderId}</code>`,
      "",
      "Товары:",
      itemsText || "—",
      "",
      "Клиент:",
      `Имя: ${customerName || "??"}`,
      `Телефон: ${c.phone || "??"}`,
      `Email: ${c.email || "??"}`,
      `Город: ${c.city || "??"}`,
      `Адрес: ${c.address || "??"}`,
      `Индекс: ${c.postalCode || "??"}`,
      "",
      `Доставка: ${order.shippingCost ?? "??"}`,
      `Итого: ${order.total ?? "??"}`,
      "",
      `🔗 <a href="https://t.me/${BOT_USERNAME}?start=order_${orderId}">Открыть/создать чат с клиентом</a>`,
    ].join("\n")

    // Шлём всем админам
    for (const adminId of ADMIN_IDS) {
      await sendMessage(adminId, text, { disable_web_page_preview: true })
    }

    // ⬇️ Возвращаем формат, который твой фронт может ожидать
    return NextResponse.json({
      success: true,
      message: "Заказ успешно оформлен",
      orderId,
      orderLink: `https://t.me/${BOT_USERNAME}?start=order_${orderId}`,
    })
  } catch (e) {
    console.error("send-order error", e)
    return NextResponse.json(
      { success: false, message: "Order failed", error: String(e) },
      { status: 500 }
    )
  }
}
