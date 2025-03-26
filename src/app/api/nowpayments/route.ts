import { NextResponse } from "next/server"
import { supabase } from "@/lib/db"
import { headers } from "next/headers"

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function GET() {
  try {
    // Check if automatic processing is enabled
    const headersList = await headers()
    const host = headersList.get("host")
    const protocol = process.env.NODE_ENV === "development" ? "http" : "https"
    const { data: automaticData, error: automaticError } = await supabase
      .from("automatic")
      .select("enabled")
      .eq("id", 1)
      .single()

    if (automaticError) {
      console.error("Error fetching automatic processing state:", automaticError)
      return NextResponse.json({ error: "Failed to check automatic processing state" }, { status: 500 })
    }

    if (!automaticData?.enabled) {
      console.log("Automatic processing is disabled")
      return NextResponse.json({ message: "Automatic processing is disabled" })
    }

    // Calculate the date 3 days ago
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

    // Fetch pending withdrawals from Supabase that are 3 days old or older
    const { data: withdrawals, error } = await supabase
      .from("withdrawal_queue")
      .select("*")
      .eq("status", "pending")
      .lte("created_at", threeDaysAgo.toISOString())
      .order("created_at", { ascending: true })
      .limit(50)

    if (error) {
      throw new Error("Failed to fetch withdrawals")
    }

    const results = []

    // Process withdrawals in batches of 10 to avoid overloading the API
    const batchSize = 10
    for (let i = 0; i < withdrawals.length; i += batchSize) {
      const batch = withdrawals.slice(i, i + batchSize)

      try {
        // Prepare withdrawals batch for NOWPayments - all using TRX USDT
        const withdrawalsBatch = batch.map((withdrawal) => ({
          address: withdrawal.wallet_address,
          currency: "USDT", // Always USDT
          network: "TRX", // Always TRX network
          amount: withdrawal.amount,
          ipn_callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/withdrawal/webhook`,
          extraId: withdrawal.id.toString(), // Use withdrawal ID as reference
        }))

        // Process the batch with NOWPayments
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/nowpayments/mass-withdrawal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            withdrawals: withdrawalsBatch,
          }),
        })

        if (!response.ok) {
          throw new Error(`NOWPayments API error: ${response.statusText}`)
        }

        const result = await response.json()

        // Update each withdrawal in the batch
        for (const withdrawal of batch) {
          const paymentInfo = result.payments.find((p:any) => p.extraId === withdrawal.id.toString())

          if (paymentInfo) {
            // Update withdrawal status in Supabase
            const { error: updateError } = await supabase
              .from("withdrawal_queue")
              .update({
                status: "processing",
                payment_id: paymentInfo.id,
              })
              .eq("id", withdrawal.id)

            if (updateError) {
              console.error(`Failed to update withdrawal status for ID ${withdrawal.id}:`, updateError)
            }

            results.push({
              id: withdrawal.id,
              status: "processing",
              paymentId: paymentInfo.id,
              created_at: withdrawal.created_at,
            })
          } else {
            // Payment not found in response
            await supabase
              .from("withdrawal_queue")
              .update({
                reason: "Payment not found in NOWPayments response",
              })
              .eq("id", withdrawal.id)

            results.push({
              id: withdrawal.id,
              status: "pending",
              error: "Payment not found in NOWPayments response",
              created_at: withdrawal.created_at,
            })
          }
        }

        // Add a delay before processing the next batch
        await delay(2000)
      } catch (error) {
        console.error(`Error processing withdrawal batch:`, error)

        // Update all withdrawals in the failed batch
        for (const withdrawal of batch) {
          await supabase
            .from("withdrawal_queue")
            .update({
              reason: error instanceof Error ? error.message : "Unknown error",
            })
            .eq("id", withdrawal.id)

          results.push({
            id: withdrawal.id,
            status: "pending",
            error: error instanceof Error ? error.message : "Unknown error",
            created_at: withdrawal.created_at,
          })
        }
      }
    }

    return NextResponse.json({ results })
  } catch (error) {
    console.error("Error in GET function:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

