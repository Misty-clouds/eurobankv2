import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET() {
  try {
    // Call the process-withdrawals API route using axios
    const response = await axios.get('https://b858-194-59-6-106.ngrok-free.app/api/cron/process-withdrawals');

    const result = response.data;
    return NextResponse.json({ message: 'Cron job executed successfully', result },{status:200});
  } catch (error) {
    console.error('Error in cron job:', error);
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}

