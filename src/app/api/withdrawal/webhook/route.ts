import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/db"
import crypto from "crypto"

// NOWPayments IPN secret for verifying webhook signatures
const NOWPAYMENTS_IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET

export async function POST(request: NextRequest) {
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
    const { withdrawal_id, status, address, currency, network, amount, hash, extra_id: extraId } = body

    console.log("Received webhook for withdrawal:", withdrawal_id, "Status:", status)

    // Verify this is a TRX USDT withdrawal
    if (currency !== "USDT" || network !== "TRX") {
      console.error("Unexpected currency or network:", currency, network)
      return NextResponse.json({ error: "Unexpected currency or network" }, { status: 400 })
    }

    // Find the withdrawal in our database using extraId (which contains our withdrawal ID)
    if (!extraId) {
      console.error("Missing extraId in webhook payload")
      return NextResponse.json({ error: "Missing withdrawal reference" }, { status: 400 })
    }

    const withdrawalId = extraId

    const { data: withdrawal, error: withdrawalError } = await supabase
      .from("withdrawal_queue")
      .select("*")
      .eq("id", withdrawalId)
      .single()

    if (withdrawalError || !withdrawal) {
      console.error("Withdrawal not found:", withdrawalId)
      return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 })
    }

    // Process based on payment status
    // NOWPayments statuses: processing, confirming, confirmed, sending, partially_paid, finished, failed, refunded, expired
    let withdrawalStatus

    switch (status) {
      case "finished":
        withdrawalStatus = "completed"
        break
      case "failed":
      case "refunded":
      case "expired":
        withdrawalStatus = "failed"
        break
      default:
        withdrawalStatus = "processing"
    }

    // Update withdrawal status
    const { error: updateError } = await supabase
      .from("withdrawal_queue")
      .update({
        status: withdrawalStatus,
        transaction_hash: hash || withdrawal_id,
        updated_at: new Date().toISOString(),
        payment_details: body,
      })
      .eq("id", withdrawalId)

    if (updateError) {
      console.error("Failed to update withdrawal:", updateError)
      return NextResponse.json({ error: "Failed to update withdrawal" }, { status: 500 })
    }

    // If withdrawal is completed, add it to the withdrawal_list table
    if (withdrawalStatus === "completed") {
      const { error: insertError } = await supabase.from("withdrawal_list").insert({
        user_id: withdrawal.user_id,
        withdrawal_id: withdrawalId,
        amount: withdrawal.amount,
        transaction_hash: hash || withdrawal_id,
        wallet_address: address || withdrawal.wallet_address,
      })

      if (insertError) {
        console.error("Failed to insert into withdrawal_list:", insertError)
        return NextResponse.json({ error: "Failed to record completed withdrawal" }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Webhook processing error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

