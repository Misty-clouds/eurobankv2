import { NextResponse } from "next/server"
import { supabase } from "@/lib/db"

export async function GET() {
  try {
    // Fetch 2FA codes from the database
    const { data: codes, error } = await supabase
      .from("admin_2fa_codes")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching 2FA codes:", error)
      return NextResponse.json({ error: "Failed to fetch 2FA codes" }, { status: 500 })
    }

    return NextResponse.json({ codes })
  } catch (error) {
    console.error("Error in GET function:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

