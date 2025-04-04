import { NextResponse } from "next/server"
import { supabase } from "@/lib/db"

export async function GET() {
  try {
    // Fetch verification requests from the database
    const { data: verifications, error } = await supabase
      .from("nowpayments_verifications")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching verification requests:", error)
      return NextResponse.json({ error: "Failed to fetch verification requests" }, { status: 500 })
    }

    return NextResponse.json({ verifications })
  } catch (error) {
    console.error("Error in GET function:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

