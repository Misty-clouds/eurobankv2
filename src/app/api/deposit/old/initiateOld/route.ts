
import { supabase } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { user_id, amount, wallet_address } = await request.json();

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

  // Check for existing pending deposits
  const { data: existingDeposit } = await supabase
    .from('deposits')
    .select('*')
    .eq('wallet_address', wallet_address)
    .eq('status', 'pending')
    .single();

  if (existingDeposit) {
    return NextResponse.json({ error: 'A pending deposit already exists for this wallet.' }, { status: 400 });
  }

  // Create new deposit
  const { data, error } = await supabase
    .from('deposits')
    .insert({
      user_id,
      amount,
      wallet_address,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
    })
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deposit: data });
}
