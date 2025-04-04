import { NextResponse } from "next/server"
import { supabase } from "@/lib/db"
import crypto from "crypto"

// Interface for request body
interface Generate2FARequest {
  verification_string: string
  payout_id?: string
  description?: string
}

export async function POST(request: Request) {
  try {
    // Parse request body
    const body = (await request.json()) as Generate2FARequest

    // Validate request
    if (!body.verification_string) {
      return NextResponse.json({ error: "Missing verification_string" }, { status: 400 })
    }

    console.log(`Generating 2FA code for verification string: ${body.verification_string}`)

    // Generate a 6-digit code based on the verification string
    // This is a simple implementation - in production you might want a more sophisticated algorithm
    const hash = crypto.createHash("sha256").update(body.verification_string).digest("hex")
    const code = hash.substring(0, 6)

    // Store the code in the database
    const { data: codeData, error: codeError } = await supabase
      .from("admin_2fa_codes")
      .insert({
        code: code,
        description:
          body.description || `Generated for verification string: ${body.verification_string.substring(0, 10)}...`,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (codeError) {
      console.error(`Failed to store 2FA code:`, codeError)
      return NextResponse.json({ error: "Failed to store 2FA code" }, { status: 500 })
    }

    // If payout_id is provided, update the verification record
    if (body.payout_id) {
      const { error: updateError } = await supabase
        .from("nowpayments_verifications")
        .update({
          verification_string: body.verification_string,
          verification_code: code,
        })
        .eq("payout_id", body.payout_id)

      if (updateError) {
        console.error(`Failed to update verification record:`, updateError)
      }
    }

    return NextResponse.json({
      success: true,
      code: code,
      message: "2FA code generated successfully",
    })
  } catch (error) {
    console.error("Error generating 2FA code:", error)
    return NextResponse.json(
      {
        error: "Failed to generate 2FA code",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

