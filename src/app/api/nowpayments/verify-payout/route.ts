import { NextResponse } from "next/server"
import { supabase } from "@/lib/db"
import axios from "axios"
import { HttpsProxyAgent } from "https-proxy-agent"
import type { AxiosError } from "axios"

// Define NOWPayments API URL
const NOWPAYMENTS_API_URL = "https://api.nowpayments.io/v1"
// Define Fixie Proxy URL
const FIXIE_PROXY = process.env.FIXIE_PROXY || "http://fixie:1xRr9W89mBEYLGO@criterium.usefixie.com:80"

// Interface for request body
interface VerifyPayoutRequest {
  payout_id: string
  verification_code: string
}

export async function POST(request: Request) {
  try {
    // Parse request body
    const body = (await request.json()) as VerifyPayoutRequest

    // Validate request
    if (!body.payout_id) {
      return NextResponse.json({ error: "Missing payout_id" }, { status: 400 })
    }

    if (!body.verification_code) {
      return NextResponse.json({ error: "Missing verification_code" }, { status: 400 })
    }

    console.log(`Verifying payout ID: ${body.payout_id} with code: ${body.verification_code}`)

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

    // Make the verification API call
    const response = await axios.post(
      `${NOWPAYMENTS_API_URL}/payout/${body.payout_id}/verify`,
      { verification_code: body.verification_code },
      {
        headers: {
          "x-api-key": process.env.NOWPAYMENTS_API_KEY,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        httpsAgent: proxyAgent,
      },
    )

    console.log(`Verification response:`, response.data)

    // Update the verification record in the database
    const { error: updateError } = await supabase
      .from("nowpayments_verifications")
      .update({
        status: "verified",
        verification_code: body.verification_code,
        verified_at: new Date().toISOString(),
      })
      .eq("payout_id", body.payout_id)

    if (updateError) {
      console.error(`Failed to update verification record:`, updateError)
    }

    return NextResponse.json({
      success: true,
      message: "Payout verified successfully",
      data: response.data,
    })
  } catch (error: unknown) {
    console.error("Error verifying payout:", error)

    // Log more detailed error information
    const axiosError = error as AxiosError
    if (axiosError.response) {
      console.error("Error response data:", axiosError.response.data)
      console.error("Error response status:", axiosError.response.status)
    }

    return NextResponse.json(
      {
        error: "Failed to verify payout",
        message: (axiosError.response?.data as { message?: string })?.message || (error instanceof Error ? error.message : "Unknown error"),
      },
      { status: 500 },
    )
  }
}

