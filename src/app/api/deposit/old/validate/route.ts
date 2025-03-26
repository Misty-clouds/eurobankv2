import { supabase } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { transaction_hash, from_wallet, amount } = await request.json();

  console.log({ from_wallet, amount: Number(amount), currentTime: new Date().toISOString() });

  // Find a matching pending deposit
  const { data: deposit, error } = await supabase
    .from('deposits')
    .select('*')
    .eq('wallet_address', from_wallet)
    .eq('amount', Number(amount)) // Match type to `int2`
    .eq('status', 'pending')
    .single();

  if (error || !deposit) {
    console.error('Deposit Query Error:', error);
    return NextResponse.json({ error: error?.message || 'No matching pending deposit found.' }, { status: 404 });
  }

  // Mark deposit as completed
  const { error: updateError } = await supabase
    .from('deposits')
    .update({ status: 'completed', transaction_hash })
    .eq('id', deposit.id);

  if (updateError) {
    console.error('Update Error:', updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Fetch user's current balance
  const { data: user, error: userFetchError } = await supabase
    .from('users')
    .select('balance')
    .eq('id', deposit.user_id)
    .single();

  if (userFetchError || !user) {
    console.error('User Fetch Error:', userFetchError);
    return NextResponse.json({ error: userFetchError?.message || 'User not found.' }, { status: 404 });
  }

  // Update user's balance
  const newBalance = user.balance + deposit.amount;
  const { error: balanceUpdateError } = await supabase
    .from('users')
    .update({ balance: newBalance })
    .eq('id', deposit.user_id);

  if (balanceUpdateError) {
    console.error('Balance Update Error:', balanceUpdateError);
    return NextResponse.json({ error: balanceUpdateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
