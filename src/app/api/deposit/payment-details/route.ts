import { supabase } from "@/lib/db"
import { NextResponse } from "next/server"
import axios from "axios"

// NOWPayments API configuration
const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY
const NOWPAYMENTS_API_URL = "https://api.nowpayments.io/v1"

export async function GET(request: Request) {
  try {
    // Get payment ID from query params
    const { searchParams } = new URL(request.url)
    const paymentId = searchParams.get("paymentId")

    if (!paymentId) {
      return NextResponse.json({ error: "Payment ID is required" }, { status: 400 })
    }

    // First, check our database for the payment
    const { data: depositData, error: depositError } = await supabase
      .from("deposits")
      .select("*")
      .eq("payment_id", paymentId)
      .single()

    if (depositError) {
      console.error("Database error:", depositError)
      return NextResponse.json({ error: "Payment not found" }, { status: 404 })
    }

    // Then, get the payment details from NOWPayments
    try {
      const response = await axios.get(`${NOWPAYMENTS_API_URL}/payment/${depositData.nowpayments_id}`, {
        headers: {
          "x-api-key": NOWPAYMENTS_API_KEY,
        },
      })

      if (!response.data) {
        return NextResponse.json({ error: "Failed to fetch payment details from NOWPayments" }, { status: 500 })
      }

      // Combine our database data with NOWPayments data
      const paymentDetails = {
        ...depositData,
        ...response.data,
      }

      return NextResponse.json({
        success: true,
        payment: paymentDetails,
      })
    } catch (apiError) {
      console.error("NOWPayments API error:", apiError)

      // If we can't get details from NOWPayments, return what we have from our database
      return NextResponse.json({
        success: true,
        payment: {
          ...depositData,
          pay_address: depositData.wallet_address || "Address not available",
          pay_amount: depositData.amount,
          pay_currency: depositData.currency,
          price_amount: depositData.amount,
        },
      })
    }
  } catch (error) {
    console.error("Error fetching payment details:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

