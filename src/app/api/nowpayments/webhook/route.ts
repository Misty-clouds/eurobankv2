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

    // Determine if this is a deposit or withdrawal webhook
    const isWithdrawal = !!body.withdrawal_id
    const isDeposit = !!body.payment_id

    if (!isWithdrawal && !isDeposit) {
      console.error("Unknown webhook type - neither withdrawal_id nor payment_id found")
      return NextResponse.json({ error: "Unknown webhook type" }, { status: 400 })
    }

    console.log(
      `Received ${isWithdrawal ? "withdrawal" : "deposit"} webhook:`,
      isWithdrawal ? body.withdrawal_id : body.payment_id,
      "Status:",
      body.payment_status || body.status,
    )

    // Process based on webhook type
    if (isWithdrawal) {
      return await processWithdrawalWebhook(body)
    } else {
      return await processDepositWebhook(body)
    }
  } catch (error) {
    console.error("Webhook processing error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

/**
 * Process withdrawal webhook from NOWPayments
 */
interface WithdrawalWebhookBody {
    withdrawal_id: string;
    status: string;
    address: string;
    currency: string;
    network?: string;
    amount: number;
    hash?: string;
    extra_id?: string;
}

async function processWithdrawalWebhook(body: WithdrawalWebhookBody) {
    const { withdrawal_id, status, address, currency, network, amount, hash, extra_id: extraId } = body;

    // Verify this is a TRX USDT withdrawal
    if (currency !== "USDT" || (network && network !== "TRX")) {
        console.error("Unexpected currency or network for withdrawal:", currency, network);
        return NextResponse.json({ error: "Unexpected currency or network" }, { status: 400 });
    }

    // Find the withdrawal in our database using extraId (which contains our withdrawal ID)
    if (!extraId) {
        console.error("Missing extraId in withdrawal webhook payload");
        return NextResponse.json({ error: "Missing withdrawal reference" }, { status: 400 });
    }

    const withdrawalId = extraId;

    const { data: withdrawal, error: withdrawalError } = await supabase
        .from("withdrawal_queue")
        .select("*")
        .eq("id", withdrawalId)
        .single();

    if (withdrawalError || !withdrawal) {
        console.error("Withdrawal not found:", withdrawalId);
        return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
    }

    // Map NOWPayments status to our status
    let withdrawalStatus: string;
    switch (status) {
        case "finished":
            withdrawalStatus = "completed";
            break;
        case "failed":
        case "refunded":
        case "expired":
            withdrawalStatus = "failed";
            break;
        default:
            withdrawalStatus = "processing";
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
        .eq("id", withdrawalId);

    if (updateError) {
        console.error("Failed to update withdrawal:", updateError);
        return NextResponse.json({ error: "Failed to update withdrawal" }, { status: 500 });
    }

    // If withdrawal is completed, add it to the withdrawal_list table
    if (withdrawalStatus === "completed") {
        const { error: insertError } = await supabase.from("withdrawal_list").insert({
            user_id: withdrawal.user_id,
            withdrawal_id: withdrawalId,
            amount: withdrawal.amount,
            transaction_hash: hash || withdrawal_id,
            wallet_address: address || withdrawal.wallet_address,
        });

        if (insertError) {
            console.error("Failed to insert into withdrawal_list:", insertError);
            return NextResponse.json({ error: "Failed to record completed withdrawal" }, { status: 500 });
        }
    }

    return NextResponse.json({ success: true, type: "withdrawal" });
}

/**
 * Process deposit webhook from NOWPayments
 */
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

interface Deposit {
    id: string;
    user_id: string;
    amount: number;
}

async function processDepositWebhook(body: DepositWebhookBody) {
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
    } = body;

    // Find the deposit in our database
    const { data: deposit, error: depositError } = await supabase
        .from("deposits")
        .select("*")
        .eq("payment_id", order_id)
        .single();

    if (depositError || !deposit) {
        console.error("Deposit not found:", payment_id);
        return NextResponse.json({ error: "Deposit not found" }, { status: 404 });
    }

    // Process based on payment status
    // NOWPayments statuses: waiting, confirming, confirmed, sending, partially_paid, finished, failed, refunded, expired
    let depositStatus: string;

    switch (payment_status) {
        case "finished":
            depositStatus = "completed";
            // Update user balance
            await updateUserBalance(deposit.user_id, deposit.amount, payment_id);
            break;
        case "partially_paid":
            depositStatus = "partially_paid";
            break;
        case "confirming":
        case "sending":
            depositStatus = "processing";
            break;
        case "failed":
        case "refunded":
        case "expired":
            depositStatus = "failed";
            break;
        default:
            depositStatus = "pending";
    }

    // Update deposit status
    const { error: updateError } = await supabase
        .from("deposits")
        .update({
            status: depositStatus,
            transaction_hash: payment_id,
            updated_at: new Date().toISOString(),
            payment_details: body,
        })
        .eq("id", deposit.id);

    if (updateError) {
        console.error("Failed to update deposit:", updateError);
        return NextResponse.json({ error: "Failed to update deposit" }, { status: 500 });
    }

    return NextResponse.json({ success: true, type: "deposit" });
}

/**
 * Update user balance after successful deposit
 */
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

