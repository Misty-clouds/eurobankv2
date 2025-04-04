import { NextResponse,NextRequest } from "next/server";



export async function POST(request:NextRequest) {
  console.log("POST request received");
  try {
    const body = request.json();
    console.log("Parsed request body:", body);

    // Handle the withdrawal request
    return NextResponse.json({ message: "Withdrawal initiated successfully" });
  } catch (error) {
    console.error("Error processing withdrawal:", error);
    return NextResponse.json({ error: "Failed to initiate withdrawal" }, { status: 500 });
  }

    
}