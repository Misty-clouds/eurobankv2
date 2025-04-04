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

    if (withdrawals.length === 0) {
      return NextResponse.json({ message: "No pending withdrawals to process" })
    }

    try {
      // Generate a batch ID
      const batchId = `BATCH-${Date.now()}`

      // Create a new instance of HttpsProxyAgent
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

      const withdrawalItems = []

      // Add each withdrawal to the array
      for (const withdrawal of withdrawals) {
        withdrawalItems.push({
          address: withdrawal.wallet_address,
          currency: "usdtbsc",
          amount: Number.parseFloat(withdrawal.amount),
          ipn_callback_url: ipn_callback_url,
        })
      }

      // Create the exact payload format as shown in the curl example
      const payoutData = {
        ipn_callback_url: ipn_callback_url,
        withdrawals: withdrawalItems,
      }

      console.log(`Sending payout request for ${withdrawalItems.length} withdrawals`)

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
      console.log(`NOWPayments API response:`, result)

      // Process each withdrawal with the response
      const results = []
      for (let i = 0; i < withdrawals.length; i++) {
        const withdrawal = withdrawals[i]

        // Extract payment ID from response - structure may vary
        const paymentId =
          result.id || (result.data && result.data[i] ? result.data[i].id : null) || `NP-${Date.now()}-${withdrawal.id}`

        // Update withdrawal status in Supabase
        const { error: updateError } = await supabase
          .from("withdrawal_queue")
          .update({
            status: "pending",
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
      }

      return NextResponse.json({ results })
    } catch (error: unknown) {
      console.error(`Error processing withdrawals:`, error)

      // Log more detailed error information
      const axiosError = error as AxiosError
      if (axiosError.response) {
        console.error("Error response data:", axiosError.response.data)
        console.error("Error response status:", axiosError.response.status)
      }

      // Update all withdrawals as failed
      const results = []
      for (const withdrawal of withdrawals) {
        await supabase
          .from("withdrawal_queue")
          .update({
            reason: axiosError.response?.data || (error instanceof Error ? error.message : "Unknown error"),
          })
          .eq("id", withdrawal.id)

        results.push({
          id: withdrawal.id,
          status: "pending",
          error: axiosError.response?.data || (error instanceof Error ? error.message : "Unknown error"),
          created_at: withdrawal.created_at,
        })
      }

      return NextResponse.json({ results })
    }
  } catch (error: unknown) {
    console.error("Error in GET function:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

