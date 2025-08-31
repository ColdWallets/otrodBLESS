import { NextResponse } from "next/server"

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`
const ADMIN_IDS = process.env.ADMIN_IDS?.split(",").map(id => id.trim()) || []
const BOT_USERNAME = process.env.BOT_USERNAME || "OtrodyaBot"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log("RAW ORDER BODY:", JSON.stringify(body, null, 2))

    const { items, customer, total, shippingCost } = body
    const orderId = Date.now()

    // Составляем текст заказа
    const itemsText = items
      .map(
        (item: any, idx: number) =>
          `${idx + 1}. ${item.product?.name || "??"} — ${item.size || ""} × ${
            item.quantity || 0
          } = ${item.product?.price * item.quantity || 0}`
      )
      .join("\n")

    const message = `🛒 Новый заказ\n№: ${orderId}\n\nТовары:\n${itemsText}\n\nКлиент:\nИмя: ${customer.firstName || ""} ${customer.lastName || ""}\nТелефон: ${customer.phone || ""}\nEmail: ${customer.email || ""}\nГород: ${customer.city || ""}\nАдрес: ${customer.address || ""}\nИндекс: ${customer.postalCode || ""}\n\nДоставка: ${shippingCost}\nИтого: ${total}\n\n🔗 Открыть/создать чат с клиентом (https://t.me/${BOT_USERNAME}?start=order_${orderId})`

    // Шлём заказ всем админам
    await Promise.all(
      ADMIN_IDS.map(adminId =>
        fetch(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: adminId,
            text: message,
            parse_mode: "HTML",
          }),
        })
      )
    )

    // 👇 Возвращаем то, что фронт ждёт
    return NextResponse.json({
      success: true,
      botLink: `https://t.me/${BOT_USERNAME}?start=order_${orderId}`,
    })
  } catch (error) {
    console.error("SEND ORDER ERROR:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка оформления заказа" },
      { status: 500 }
    )
  }
}
