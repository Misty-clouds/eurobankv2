import { supabase } from '@/lib/db';
import { NextResponse } from 'next/server';

let isRunning = false; // Track the state of the profit-adding process

export async function POST() {
  if (isRunning) {
    return NextResponse.json(
      { error: 'Profit-adding process is already running' },
      { status: 400 }
    );
  }

  isRunning = true;

  try {
    console.log('Profit-adding process started');

    // Fetch all users with daily_profit
    const { data: users, error } = await supabase
      .from('users')
      .select('id, daily_profit, total_dp');

    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update each user's total_dp by adding daily_profit
    for (const user of users) {
      const { id, daily_profit, total_dp } = user;

      const { error: updateError } = await supabase
        .from('users')
        .update({ total_dp: total_dp + daily_profit })
        .eq('id', id);

      if (updateError) {
        console.error(`Error updating user ${id}:`, updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    console.log('Profit-adding process completed');
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    // Reset the running state after 24 hours
    setTimeout(() => {
      isRunning = false;
      console.log('Profit-adding process reset after 24 hours');
    }, 24 * 60 * 60 * 1000); // 24 hours
  }
}
