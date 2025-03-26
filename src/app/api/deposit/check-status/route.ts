import { supabase } from "@/lib/db"
import { NextResponse } from "next/server"
import axios from "axios"

// NOWPayments API configuration
const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY
const NOWPAYMENTS_API_URL = "https://api.nowpayments.io/v1"

// Update the updateUserBalance function to handle locale-aware redirects
async function updateUserBalance(userId: string, amount: number, paymentId: string) {
  try {
    // Get current user data
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("balance, total_dp")
      .eq("id", userId)
      .single()

    if (userError || !userData) {
      console.error("User not found:", userError)
      throw new Error("User not found")
    }

    // Get deposit data to retrieve locale
    const { data: depositData, error: depositError } = await supabase
      .from("deposits")
      .select("locale")
      .eq("payment_id", paymentId)
      .single()

    const locale = depositData?.locale || "en"

    const newBalance = userData.balance + amount
    const dp = amount * 0.02 // 2% DP calculation
    const newTotalDp = userData.total_dp + dp

    // Update user balance and total_dp
    const { error: updateError } = await supabase
      .from("users")
      .update({
        balance: newBalance,
        total_dp: newTotalDp,
      })
      .eq("id", userId)

    if (updateError) {
      console.error("Failed to update user balance:", updateError)
      throw new Error("Failed to update user balance")
    }

    console.log(`Updated balance for user ${userId}: +${amount}, new balance: ${newBalance}, locale: ${locale}`)
    return true
  } catch (error) {
    console.error("Error updating user balance:", error)
    throw error
  }
}

// Update the POST function to pass payment_id to updateUserBalance
export async function POST(request: Request) {
  try {
    const { payment_id } = await request.json()

    if (!payment_id) {
      return NextResponse.json({ error: "Missing payment ID" }, { status: 400 })
    }

    // Check payment status from NOWPayments API
    const response = await axios.get(`${NOWPAYMENTS_API_URL}/payment/${payment_id}`, {
      headers: {
        "x-api-key": NOWPAYMENTS_API_KEY,
      },
    })

    if (!response.data) {
      return NextResponse.json({ error: "Failed to get payment status" }, { status: 500 })
    }

    const paymentStatus = response.data.payment_status

    // Find the deposit in our database
    const { data: deposit, error: depositError } = await supabase
      .from("deposits")
      .select("*")
      .eq("payment_id", payment_id)
      .single()

    if (depositError || !deposit) {
      return NextResponse.json({ error: "Deposit not found" }, { status: 404 })
    }

    // Map NOWPayments status to our status
    let depositStatus
    switch (paymentStatus) {
      case "finished":
        depositStatus = "completed"
        // If status is completed but we haven't processed it yet, update user balance
        if (deposit.status !== "completed") {
          await updateUserBalance(deposit.user_id, deposit.amount, payment_id)
        }
        break
      case "partially_paid":
        depositStatus = "partially_paid"
        break
      case "confirming":
      case "sending":
        depositStatus = "processing"
        break
      case "failed":
      case "refunded":
      case "expired":
        depositStatus = "failed"
        break
      default:
        depositStatus = "pending"
    }

    // Update deposit status if it has changed
    if (deposit.status !== depositStatus) {
      const { error: updateError } = await supabase
        .from("deposits")
        .update({
          status: depositStatus,
          updated_at: new Date().toISOString(),
          payment_details: response.data,
        })
        .eq("id", deposit.id)

      if (updateError) {
        console.error("Failed to update deposit:", updateError)
        return NextResponse.json({ error: "Failed to update deposit" }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      status: depositStatus,
      payment: response.data,
      locale: deposit.locale || "ar",
    })
  } catch (error) {
    console.error("Error checking payment status:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

