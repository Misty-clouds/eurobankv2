import { NextResponse } from "next/server"
import { supabase } from "@/lib/db"
import { headers } from "next/headers"
import axios from "axios"
import { HttpsProxyAgent } from "https-proxy-agent"
import type { AxiosError } from "axios"

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Define NOWPayments API URL
const NOWPAYMENTS_API_URL = "https://api.nowpayments.io/v1"
// Define Fixie Proxy URL
const FIXIE_PROXY = process.env.FIXIE_PROXY || "http://fixie:1xRr9W89mBEYLGO@criterium.usefixie.com:80"

export async function GET() {
  try {
    // Check if automatic processing is enabled
    const headersList = await headers()
    const host = headersList.get("host")
    const protocol = process.env.NODE_ENV === "development" ? "http" : "https"

    // Webhook URL
    const ipn_callback_url = process.env.NEXT_PUBLIC_APP_URL_TEST + "/api/nowpayments/webhook"

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
        // Generate a batch ID (you might want to store this in your database)
        const batchId = `BATCH-${Date.now()}`

        // Current timestamp in ISO format
        const currentTimestamp = new Date().toISOString()

        // Create a new instance of HttpsProxyAgent for each request
        const proxyAgent = new HttpsProxyAgent(FIXIE_PROXY)

        // Get auth token first using proxy
        const authResponse = await axios.post(
          `${NOWPAYMENTS_API_URL}/auth`,
          {
            email: process.env.NOWPAYMENTS_EMAIL,
            password: process.env.NOWPAYMENTS_PASSWORD,
          },
          {
            httpsAgent: proxyAgent, // Use proxy for authentication
          },
        )

        if (!authResponse.data || !authResponse.data.token) {
          throw new Error("Failed to get auth token from NOWPayments")
        }

        const token = authResponse.data.token
        console.log("NOWPayments auth token obtained successfully")

        // Process each withdrawal individually
        for (const withdrawal of batch) {
          try {
            // Format according to the NOWPayments API requirements for single payout
            const withdrawalData = {
              address: withdrawal.wallet_address,
              currency: "usdt", // Lowercase as per the example
              amount: withdrawal.amount.toString(), // Convert to string as per the example
              ipn_callback_url: ipn_callback_url,
              extra_id: withdrawal.id.toString(), // Use withdrawal ID as reference
              network: "trx", // Lowercase as per the example
            }

            // Wrap the withdrawal data in a "withdrawals" field as required by the API
            const payoutData = {
              withdrawals: [withdrawalData],
            }

            console.log(`Sending payout request for withdrawal ID ${withdrawal.id}:`, JSON.stringify(payoutData))

            // Make the direct API call to NOWPayments using proxy
            const response = await axios.post(`${NOWPAYMENTS_API_URL}/payout`, payoutData, {
              headers: {
                "x-api-key": process.env.NOWPAYMENTS_API_KEY,
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              httpsAgent: proxyAgent, // Use proxy for payout request
            })

            const result = response.data
            console.log(`NOWPayments API response for withdrawal ID ${withdrawal.id}:`, result)

            // Extract payment ID from response
            const paymentId = result.id || result.payout_id || `NP-${Date.now()}-${withdrawal.id}`

            // Update withdrawal status in Supabase
            const { error: updateError } = await supabase
              .from("withdrawal_queue")
              .update({
                status: "processing",
                payment_id: paymentId,
                batch_id: batchId,
                payment_details: result,
              })
              .eq("id", withdrawal.id)

            if (updateError) {
              console.error(`Failed to update withdrawal status for ID ${withdrawal.id}:`, updateError)
            }

            results.push({
              id: withdrawal.id,
              status: "processing",
              paymentId: paymentId,
              batchId: batchId,
              created_at: withdrawal.created_at,
            })

            // Add a small delay between individual payouts
            await delay(500)
          } catch (error: unknown) {
            console.error(`Error processing withdrawal ID ${withdrawal.id}:`, error)

            // Log more detailed error information
            const axiosError = error as AxiosError
            if (axiosError.response) {
              console.error("Error response data:", axiosError.response.data)
              console.error("Error response status:", axiosError.response.status)
            }

            // Update the failed withdrawal
            await supabase
              .from("withdrawal_queue")
              .update({
                reason:
                  (axiosError.response?.data as { message?: string })?.message || (error instanceof Error ? error.message : "Unknown error"),
              })
              .eq("id", withdrawal.id)

            results.push({
              id: withdrawal.id,
              status: "pending",
              error: (axiosError.response?.data as { message?: string })?.message || (error instanceof Error ? error.message : "Unknown error"),
              created_at: withdrawal.created_at,
            })
          }
        }

        // Add a delay before processing the next batch
        await delay(2000)
      } catch (error: unknown) {
        console.error(`Error processing withdrawal batch:`, error)

        // Log more detailed error information
        const axiosError = error as AxiosError
        if (axiosError.response) {
          console.error("Error response data:", axiosError.response.data)
          console.error("Error response status:", axiosError.response.status)
        }

        // Update all withdrawals in the failed batch
        for (const withdrawal of batch) {
          await supabase
            .from("withdrawal_queue")
            .update({
              reason: (axiosError.response?.data as any)?.message || (error instanceof Error ? error.message : "Unknown error"),
            })
            .eq("id", withdrawal.id)

          results.push({
            id: withdrawal.id,
            status: "pending",
            error: (axiosError.response?.data as { message?: string })?.message || (error instanceof Error ? error.message : "Unknown error"),
            created_at: withdrawal.created_at,
          })
        }
      }
    }

    return NextResponse.json({ results })
  } catch (error: unknown) {
    console.error("Error in GET function:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

