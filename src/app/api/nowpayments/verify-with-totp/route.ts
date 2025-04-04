import { NextResponse } from "next/server"
import { supabase } from "@/lib/db"
import axios from "axios"
import { HttpsProxyAgent } from "https-proxy-agent"
import type { AxiosError } from "axios"
import { createHmac } from "crypto"
import { decode as base32Decode } from "hi-base32"

// Define NOWPayments API URL
const NOWPAYMENTS_API_URL = "https://api.nowpayments.io/v1"
// Define Fixie Proxy URL
const FIXIE_PROXY = process.env.FIXIE_PROXY || "http://fixie:1xRr9W89mBEYLGO@criterium.usefixie.com:80"

// Interface for request body
interface VerifyPayoutRequest {
  payout_id: string
  secret?: string
}

/**
 * Generate a TOTP code based on the provided secret
 */
function generateTOTP(secret: string): string {
  try {
    // Convert the secret from base32 to buffer
    // If the secret is not in base32 format, we'll use it directly
    let secretBuffer: Buffer
    try {
      // Try to decode as base32
      secretBuffer = Buffer.from(base32Decode(secret.toUpperCase().replace(/\s/g, "")))
    } catch (e) {
      // If not base32, use the raw secret
      secretBuffer = Buffer.from(secret)
    }

    // Get the current time window (30 seconds is standard for TOTP)
    const timeWindow = Math.floor(Date.now() / 1000 / 30)

    // Convert time window to buffer
    const timeBuffer = Buffer.alloc(8)
    let timeWindowCalc = timeWindow
    for (let i = 0; i < 8; i++) {
      timeBuffer[7 - i] = timeWindowCalc & 0xff
      timeWindowCalc = timeWindowCalc >> 8
    }

    // Generate HMAC-SHA1 hash
    const hmac = createHmac("sha1", secretBuffer)
    hmac.update(timeBuffer)
    const hmacResult = hmac.digest()

    // Get offset and truncate
    const offset = hmacResult[hmacResult.length - 1] & 0xf
    const binary =
      ((hmacResult[offset] & 0x7f) << 24) |
      ((hmacResult[offset + 1] & 0xff) << 16) |
      ((hmacResult[offset + 2] & 0xff) << 8) |
      (hmacResult[offset + 3] & 0xff)

    // Get 6-digit code
    const otp = binary % 1000000
    return otp.toString().padStart(6, "0")
  } catch (error) {
    console.error("Error generating TOTP:", error)
    return "000000" // Return a default code on error
  }
}

export async function POST(request: Request) {
  try {
    // Parse request body
    const body = (await request.json()) as VerifyPayoutRequest

    // Validate request
    if (!body.payout_id) {
      return NextResponse.json({ error: "Missing payout_id" }, { status: 400 })
    }

    // Use provided secret or default to the one provided by the user
    const secret = body.secret || "IRgFIMsPLZDSKVbb"

    // Generate current TOTP code
    const verificationCode = generateTOTP(secret)

    console.log(`Verifying payout ID: ${body.payout_id} with TOTP code: ${verificationCode}`)

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
      { verification_code: verificationCode },
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
        verification_code: verificationCode,
        verification_string: secret,
        verified_at: new Date().toISOString(),
      })
      .eq("payout_id", body.payout_id)

    if (updateError) {
      console.error(`Failed to update verification record:`, updateError)
    }

    return NextResponse.json({
      success: true,
      message: "Payout verified successfully",
      code_used: verificationCode,
      data: response.data,
    })
  } catch (error: unknown) {
    console.error("Error verifying payout:", error)

    // Log more detailed error information
    const axiosError = error as AxiosError<{ message?: string }>
    if (axiosError.response) {
      console.error("Error response data:", axiosError.response.data)
      console.error("Error response status:", axiosError.response.status)
    }

    return NextResponse.json(
      {
        error: "Failed to verify payout",
        message: axiosError.response?.data?.message || (error instanceof Error ? error.message : "Unknown error"),
      },
      { status: 500 },
    )
  }
}

