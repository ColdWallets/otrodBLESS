import { type NextRequest, NextResponse } from "next/server"

const TELEGRAM_BOT_TOKEN = "8369763130:AAFDJGzAw36tiPdLfBkD610knG_pGUwQ47o"
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

export async function POST(request: NextRequest) {
  try {
    const orderData = await request.json()

    // Store order data temporarily (in a real app, use a database)
    const orderId = Date.now().toString()

    // In a real implementation, you would store this in a database
    // For now, we'll just log it
    console.log("Order received:", { orderId, orderData })

    return NextResponse.json({ success: true, orderId })
  } catch (error) {
    console.error("Error processing order:", error)
    return NextResponse.json({ success: false, error: "Failed to process order" }, { status: 500 })
  }
}
