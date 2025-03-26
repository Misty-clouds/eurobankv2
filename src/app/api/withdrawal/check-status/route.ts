import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/db"
import axios from "axios"

// NOWPayments API configuration
const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY
const NOWPAYMENTS_API_URL = "https://api.nowpayments.io/v1"
const NOWPAYMENTS_EMAIL = process.env.NOWPAYMENTS_EMAIL
const NOWPAYMENTS_PASSWORD = process.env.NOWPAYMENTS_PASSWORD

// Cache for auth token
let authToken: string | null = null
let tokenExpiry = 0

/**
 * Get authentication token for NOWPayments API
 */
async function getAuthToken() {
  // Check if we have a valid cached token
  const now = Date.now()
  if (authToken && tokenExpiry > now) {
    return authToken
  }

  try {
    const response = await axios.post(`${NOWPAYMENTS_API_URL}/auth`, {
      email: NOWPAYMENTS_EMAIL,
      password: NOWPAYMENTS_PASSWORD,
    })

    if (response.data && response.data.token) {
      // Cache the token for 23 hours (token is valid for 24 hours)
      authToken = response.data.token
      tokenExpiry = now + 23 * 60 * 60 * 1000
      return authToken
    } else {
      throw new Error("Failed to get auth token from NOWPayments")
    }
  } catch (error) {
    console.error("Error getting NOWPayments auth token:", error)
    throw new Error("Authentication with NOWPayments failed")
  }
}

export async function POST(request: NextRequest) {
  try {
    const { payment_id } = await request.json()

    if (!payment_id) {
      return NextResponse.json({ error: "Missing payment ID" }, { status: 400 })
    }

    // Get auth token
    const token = await getAuthToken()

    // Check payment status from NOWPayments API
    const response = await axios.get(`${NOWPAYMENTS_API_URL}/withdrawal/${payment_id}`, {
      headers: {
        "x-api-key": NOWPAYMENTS_API_KEY,
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.data) {
      return NextResponse.json({ error: "Failed to get withdrawal status" }, { status: 500 })
    }

    const withdrawalStatus = response.data.status
    const extraId = response.data.extra_id

    if (!extraId) {
      return NextResponse.json({ error: "Withdrawal reference not found" }, { status: 404 })
    }

    // Verify this is a TRX USDT withdrawal
    if (response.data.currency !== "USDT" || response.data.network !== "TRX") {
      console.error("Unexpected currency or network:", response.data.currency, response.data.network)
      return NextResponse.json({ error: "Unexpected currency or network" }, { status: 400 })
    }

    // Find the withdrawal in our database
    const { data: withdrawal, error: withdrawalError } = await supabase
      .from("withdrawal_queue")
      .select("*")
      .eq("id", extraId)
      .single()

    if (withdrawalError || !withdrawal) {
      return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 })
    }

    // Map NOWPayments status to our status
    let dbStatus
    switch (withdrawalStatus) {
      case "finished":
        dbStatus = "completed"
        break
      case "failed":
      case "refunded":
      case "expired":
        dbStatus = "failed"
        break
      default:
        dbStatus = "processing"
    }

    // Update withdrawal status if it has changed
    if (withdrawal.status !== dbStatus) {
      const { error: updateError } = await supabase
        .from("withdrawal_queue")
        .update({
          status: dbStatus,
          updated_at: new Date().toISOString(),
          payment_details: response.data,
          transaction_hash: response.data.hash || payment_id,
        })
        .eq("id", extraId)

      if (updateError) {
        console.error("Failed to update withdrawal:", updateError)
        return NextResponse.json({ error: "Failed to update withdrawal" }, { status: 500 })
      }

      // If withdrawal is completed, add it to the withdrawal_list table
      if (dbStatus === "completed" && withdrawal.status !== "completed") {
        const { error: insertError } = await supabase.from("withdrawal_list").insert({
          user_id: withdrawal.user_id,
          withdrawal_id: extraId,
          amount: withdrawal.amount,
          transaction_hash: response.data.hash || payment_id,
          wallet_address: response.data.address || withdrawal.wallet_address,
        })

        if (insertError) {
          console.error("Failed to insert into withdrawal_list:", insertError)
        }
      }
    }

    return NextResponse.json({
      success: true,
      status: dbStatus,
      withdrawal: response.data,
    })
  } catch (error) {
    console.error("Error checking withdrawal status:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

