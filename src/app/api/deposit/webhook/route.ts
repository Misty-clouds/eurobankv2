import { supabase } from "@/lib/db"
import { NextResponse } from "next/server"
import crypto from "crypto"

// NOWPayments IPN secret for verifying webhook signatures
const NOWPAYMENTS_IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET

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
    // Get the raw request body for signature verification
    const rawBody = await request.text()
    const body = JSON.parse(rawBody)

    // Get the signature from headers
    const signature = request.headers.get("x-nowpayments-sig")

    if (!signature) {
      console.error("Missing signature header")
      return NextResponse.json({ error: "Missing signature" }, { status: 400 })
    }

    // Verify the signature
    const hmac = crypto.createHmac("sha512", NOWPAYMENTS_IPN_SECRET || "")
    hmac.update(rawBody)
    const calculatedSignature = hmac.digest("hex")

    if (calculatedSignature !== signature) {
      console.error("Invalid signature")
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 })
    }

    // Extract payment information
    const {
      payment_id,
      payment_status,
      pay_address,
      price_amount,
      price_currency,
      pay_amount,
      amount_received,
      pay_currency,
      order_id,
      order_description,
      created_at,
      updated_at,
      purchase_id,
      network,
      expiration_estimate_date,
    } = body

    console.log("Received webhook for payment:", payment_id, "Status:", payment_status)

    // Find the deposit in our database
    const { data: deposit, error: depositError } = await supabase
      .from("deposits")
      .select("*")
      .eq("payment_id", payment_id)
      .single()

    if (depositError || !deposit) {
      console.error("Deposit not found:", payment_id)
      return NextResponse.json({ error: "Deposit not found" }, { status: 404 })
    }

    // Process based on payment status
    // NOWPayments statuses: waiting, confirming, confirmed, sending, partially_paid, finished, failed, refunded, expired
    let depositStatus

    switch (payment_status) {
      case "finished":
        depositStatus = "completed"
        // Update user balance with payment_id for locale retrieval
        await updateUserBalance(deposit.user_id, deposit.amount, payment_id)
        break
      case "partially_paid":
        depositStatus = "partially_paid"
        break
      case "confirming":
      case "confirmed":
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

    // Update deposit status with all the NOWPayments data
    const { error: updateError } = await supabase
      .from("deposits")
      .update({
        status: depositStatus,
        transaction_hash: payment_id,
        updated_at: new Date().toISOString(),
        payment_details: body,
        pay_address: pay_address || deposit.pay_address,
        pay_amount: pay_amount || deposit.pay_amount,
        amount_received: amount_received,
        purchase_id: purchase_id,
        expires_at: expiration_estimate_date || deposit.expires_at,
      })
      .eq("id", deposit.id)

    if (updateError) {
      console.error("Failed to update deposit:", updateError)
      return NextResponse.json({ error: "Failed to update deposit" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Webhook processing error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

