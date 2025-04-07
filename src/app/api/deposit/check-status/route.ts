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

    // If we already have a confirmed status in our database, return it
    if (depositData.status === "completed" || depositData.status === "confirmed") {
      return NextResponse.json({
        success: true,
        status: depositData.status,
      })
    }

    // Check the payment status from NOWPayments
    const statusUrl = `${NOWPAYMENTS_API_URL}/payment/${depositData.nowpayments_id}`
    console.log('statusUrl',statusUrl)
    try {
      const response = await axios.get(statusUrl, {
        headers: {
          "x-api-key": NOWPAYMENTS_API_KEY,
        },
      })
      console.log('response from nowpayments',response)
      if (!response.data) {
        return NextResponse.json({ error: "Failed to fetch payment status from NOWPayments" }, { status: 500 })
      }

    

      const paymentStatus = response.data.payment_status

      // Map NOWPayments status to our status
      let status = depositData.status
      if (paymentStatus === "confirmed" || paymentStatus === "finished") {
        status = "completed"
      } else if (paymentStatus === "waiting") {
        status = "creating"
      } else if (paymentStatus === "expired") {
        status = "expired"
      }

      // Update our database with the latest status
      if (status !== depositData.status) {
        const { error: updateError } = await supabase.from("deposits").update({ status }).eq("payment_id", paymentId)

        if (updateError) {
          console.error("Error updating payment status:", updateError)
        }
      }

      return NextResponse.json({
        success: true,
        status,
      })
    } catch (apiError) {
      console.error("NOWPayments API error:", apiError)

      // If we can't get status from NOWPayments, return what we have from our database
      return NextResponse.json({
        success: true,
        status: depositData.status,
      })
    }
  } catch (error) {
    console.error("Error checking payment status:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

