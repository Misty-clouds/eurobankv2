import { createHmac } from "crypto"

/**
 * Generate a TOTP code based on the provided secret
 * This follows the RFC 6238 TOTP algorithm used by Google Authenticator
 */
export function generateTOTP(secret: string, window = 0): string {
  try {
    // Use the raw secret directly
    const secretBuffer = Buffer.from(secret)

    // Get the current time window (30 seconds is standard for TOTP)
    let timeWindow = Math.floor(Date.now() / 1000 / 30) + window

    // Convert time window to buffer
    const timeBuffer = Buffer.alloc(8)
    for (let i = 0; i < 8; i++) {
      timeBuffer[7 - i] = timeWindow & 0xff
      timeWindow = timeWindow >> 8
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
export function getTimeRemaining(): number {
  return 30 - (Math.floor(Date.now() / 1000) % 30)
}

