import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/db"
import crypto from "crypto"

// NOWPayments IPN secret for verifying webhook signatures
const NOWPAYMENTS_IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET

export async function POST(request: NextRequest) {
  console.log("POST request received")
  try {
    // Get the raw request body for signature verification
    const rawBody = await request.text()
    console.log("Raw request body:", rawBody)
    const body = JSON.parse(rawBody)
    console.log("Parsed request body:", body)

    // Get the signature from headers
    const signature = request.headers.get("x-nowpayments-sig")
    console.log("Received signature:", signature)

    if (!signature) {
      console.error("Missing signature header")
      return NextResponse.json({ error: "Missing signature" }, { status: 400 })
    }

    // Verify the signature
    const hmac = crypto.createHmac("sha512", NOWPAYMENTS_IPN_SECRET || "")
    hmac.update(rawBody)
    const calculatedSignature = hmac.digest("hex")
    console.log("Calculated signature:", calculatedSignature)

    if (calculatedSignature !== signature) {
      console.error("Invalid signature")
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 })
    }

    // Determine if this is a deposit or withdrawal webhook
    const isWithdrawal = !!body.batch_withdrawal_id
    const isDeposit = !!body.payment_id
    console.log("Webhook type:", isWithdrawal ? "withdrawal" : isDeposit ? "deposit" : "unknown")

    if (!isWithdrawal && !isDeposit) {
      console.error("Unknown webhook type - neither withdrawal_id nor payment_id found")
      return NextResponse.json({ error: "Unknown webhook type" }, { status: 400 })
    }

    console.log(
      `Received ${isWithdrawal ? "withdrawal" : "deposit"} webhook:`,
      isWithdrawal ? body.batch_withdrawal_id : body.payment_id,
      "Status:",
      body.payment_status || body.status,
    )

    // Process based on webhook type
    if (isWithdrawal) {
      console.log("Processing withdrawal webhook")
      return await processWithdrawalWebhook(body)
    } else {
      console.log("Processing deposit webhook")
      return await processDepositWebhook(body)
    }
  } catch (error) {
    console.error("Webhook processing error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

interface WithdrawalWebhookBody {
  id: string;
  withdrawal_id?: string;
  status: string;
  address: string;
  currency: string;
  network?: string;
  amount: number;
  hash?: string;
  extra_id?: string;
}

async function processWithdrawalWebhook(body: WithdrawalWebhookBody) {
  console.log("Processing withdrawal webhook with body:", body)
  const { id,withdrawal_id, status, address, currency, amount, hash, extra_id: extraId } = body

  // Verify this is a TRX USDT withdrawal
  if (currency !== "usdtbsc") {
    console.error("Unexpected currency or network for withdrawal:", currency)
    return NextResponse.json({ error: "Unexpected currency or network" }, { status: 400 })
  }



  const withdrawalId = id
  console.log("Looking up withdrawal in database with ID:", withdrawalId)

  const { data: withdrawal, error: withdrawalError } = await supabase
    .from("withdrawal_queue")
    .select("*")
    .eq("payment_id", withdrawalId)
    .single()

  if (withdrawalError || !withdrawal) {
    console.error("Withdrawal not found:", withdrawalId)
    return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 })
  }

  console.log("Found withdrawal:", withdrawal)

  let withdrawalStatus: string
  switch (status) {
    case "FINISHED":
      withdrawalStatus = "completed"
      break
    case "FAILED":
    case "REFUNDED":
    case "EXPIRED":
      withdrawalStatus = "failed"
      break
    default:
      withdrawalStatus = "processing"
  }

  console.log("Mapped withdrawal status:", withdrawalStatus)

  const { error: updateError } = await supabase
    .from("withdrawal_queue")
    .update({
      status: withdrawalStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("payment_id", withdrawalId)

  if (updateError) {
    console.error("Failed to update withdrawal:", updateError)
    return NextResponse.json({ error: "Failed to update withdrawal" }, { status: 500 })
  }

  console.log("Withdrawal updated successfully")

  if (withdrawalStatus === "completed") {
    console.log("Inserting completed withdrawal into withdrawal_list")
    const { error: insertError } = await supabase.from("withdrawal_list").insert({
      user_id: withdrawal.user_id,
      withdrawal_id: withdrawal.id,
      amount: withdrawal.amount,
      transaction_hash: hash || withdrawal_id,
      wallet_address: address || withdrawal.wallet_address,
    })

    if (insertError) {
      console.error("Failed to insert into withdrawal_list:", insertError)
      return NextResponse.json({ error: "Failed to record completed withdrawal" }, { status: 500 })
    }

    console.log("Completed withdrawal recorded successfully")
  }

  return NextResponse.json({ success: true, type: "withdrawal" })
}

interface DepositWebhookBody {
  payment_id: string;
  payment_status: string;
  pay_address: string;
  price_amount: number;
  price_currency: string;
  pay_amount: number;
  actually_paid: number;
  pay_currency: string;
  order_id: string;
  order_description: string;
}

async function processDepositWebhook(body: DepositWebhookBody) {
  console.log("Processing deposit webhook with body:", body)
  const {
    payment_id,
    payment_status,
    pay_address,
    price_amount,
    price_currency,
    pay_amount,
    actually_paid,
    pay_currency,
    order_id,
    order_description,
  } = body

  console.log("Looking up deposit in database with order ID:", order_id)

  const { data: deposit, error: depositError } = await supabase
    .from("deposits")
    .select("*")
    .eq("payment_id", order_id)
    .single()

  if (depositError || !deposit) {
    console.error("Deposit not found:", payment_id)
    return NextResponse.json({ error: "Deposit not found" }, { status: 404 })
  }

  console.log("Found deposit:", deposit)

  let depositStatus: string
  switch (payment_status) {
    case "finished":
      depositStatus = "completed"
      console.log("Updating user balance for completed deposit")
      await updateUserBalance(deposit.user_id, deposit.amount, payment_id)
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

  console.log("Mapped deposit status:", depositStatus)

  const { error: updateError } = await supabase
    .from("deposits")
    .update({
      status: depositStatus,
      transaction_hash: payment_id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", deposit.id)

  if (updateError) {
    console.error("Failed to update deposit:", updateError)
    return NextResponse.json({ error: "Failed to update deposit" }, { status: 500 })
  }

  console.log("Deposit updated successfully")
  return NextResponse.json({ success: true, type: "deposit" })
}

async function updateUserBalance(userId: string, amount: number, paymentId: string) {
  console.log("Updating user balance for user ID:", userId, "Amount:", amount, "Payment ID:", paymentId)
  try {
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("balance, total_dp")
      .eq("id", userId)
      .single()

    if (userError || !userData) {
      console.error("User not found:", userError)
      throw new Error("User not found")
    }

    console.log("Found user data:", userData)

    const formatDamount = (amount: number) => {
      if (amount == 80) {
        return 2;
      } else {
        return amount * 0.3;
      }
    }
    const { data: depositData, error: depositError } = await supabase
      .from("deposits")
      .select("locale")
      .eq("payment_id", paymentId)
      .single()

    const locale = depositData?.locale || "en"
    console.log("Deposit locale:", locale)

    const newBalance = userData.balance + amount
    const dp = formatDamount(amount)
    const newTotalDp = userData.total_dp + dp
    const newTotalDpInt=parseInt(newTotalDp.toFixed(0))

    console.log("New balance:", newBalance, "New total DP:", newTotalDp)

    const { error: updateError } = await supabase
      .from("users")
      .update({
        balance: newBalance,
        total_dp: newTotalDpInt,
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