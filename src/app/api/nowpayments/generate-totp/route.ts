import { NextResponse } from "next/server"
import { createHmac } from "crypto"
import { decode as base32Decode } from "hi-base32"

// Interface for request body
interface GenerateTOTPRequest {
  secret?: string
}

/**
 * Generate a TOTP code based on the provided secret
 * This follows the RFC 6238 TOTP algorithm used by Google Authenticator
 */
function generateTOTP(secret: string, window = 0): string {
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
    const timeWindow = Math.floor(Date.now() / 1000 / 30) + window

    // Convert time window to buffer
    const timeBuffer = Buffer.alloc(8)
    let timeWindowValue = timeWindow
    for (let i = 0; i < 8; i++) {
      timeBuffer[7 - i] = timeWindowValue & 0xff
      timeWindowValue = timeWindowValue >> 8
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

/**
 * Calculate time remaining until next TOTP code
 */
function getTimeRemaining(): number {
  return 30 - (Math.floor(Date.now() / 1000) % 30)
}

export async function POST(request: Request) {
  try {
    // Parse request body
    const body = (await request.json()) as GenerateTOTPRequest

    // Use provided secret or default to the one provided by the user
    const secret = body.secret || "IRgFIMsPLZDSKVbb"

    console.log(`Generating TOTP code for secret: ${secret}`)

    // Generate current and next codes
    const currentCode = generateTOTP(secret)
    const nextCode = generateTOTP(secret, 1)
    const timeRemaining = getTimeRemaining()

    return NextResponse.json({
      success: true,
      currentCode,
      nextCode,
      timeRemaining,
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + timeRemaining * 1000).toISOString(),
    })
  } catch (error) {
    console.error("Error generating TOTP code:", error)
    return NextResponse.json(
      {
        error: "Failed to generate TOTP code",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

