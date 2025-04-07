import { supabase } from "@/lib/db"
import { NextResponse } from "next/server"
import axios from "axios"

// NOWPayments API configuration
const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY
const NOWPAYMENTS_API_URL = "https://api.nowpayments.io/v1"

export async function POST(request: Request) {
  try {
    const { user_id, amount, currency, locale } = await request.json()

    if (!user_id || !amount) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    // Include locale in callback URLs
    const localePrefix = locale ? `/${locale}` : ""



    const CALLBACK_URL = `${process.env.NEXT_PUBLIC_APP_URL_TEST}${localePrefix}/deposit/success`
    const CANCEL_URL = `${process.env.NEXT_PUBLIC_APP_URL_TEST}${localePrefix}/deposit/cancel`
    const IPN_CALLBACK_URL = `${process.env.NEXT_PUBLIC_APP_URL_TEST}/api/nowpayments/webhook`


    // Create a payment via NOWPayments API 
    const paymentData = {
      price_amount: amount,
      price_currency: "usd", 
      pay_currency: "usdtbsc",
      order_id: `DEP-${user_id}-${Date.now()}`,
      order_description: `Deposit of $${amount}`,
      ipn_callback_url: IPN_CALLBACK_URL,
      success_url: CALLBACK_URL,
      cancel_url: CANCEL_URL,
    }

    console.log("Sending payment request to NOWPayments:", paymentData)

    const response = await axios.post(`${NOWPAYMENTS_API_URL}/payment`, paymentData, {
      headers: {
        "x-api-key": NOWPAYMENTS_API_KEY,
        "Content-Type": "application/json",
      },
    })

    console.log("NOWPayments API response:", response.data)

    if (!response.data ) {
      console.error("NOWPayments API error:", response.data)
      return NextResponse.json({ error: "Failed to create payment" }, { status: 500 })
    }

    const paymentId = response.data.order_id
    const paymentUrl = response.data.invoice_url
    const paymentWallet = response.data.pay_address
    const nowpaymentsId = response.data.payment_id
    const expiresAt=response.data.expiration_estimate_date

  


    // Store payment information in database including locale
    const { data: depositData, error: depositError } = await supabase
      .from("deposits")
      .insert({
        user_id,
        amount,
        payment_id: paymentId,
        currency: currency || "USDT", // Default to USDT if not provided
        status: "",
        locale: locale || "ar", // Store locale with deposit
        wallet_address: paymentWallet,
        nowpayments_id: nowpaymentsId,
        expires_at:expiresAt,
      })
      .select()
      .single()

    if (depositError) {
      console.error("Database error:", depositError)
      return NextResponse.json({ error: "Failed to store payment information" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      paymentId,
      paymentUrl,
      deposit: depositData,
    })
  } catch (error) {
    console.error("Error creating payment:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

