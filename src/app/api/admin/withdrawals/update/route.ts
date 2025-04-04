import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

interface WithdrawalStatusInput {
  id: string;
  status:string;
  reason?: string;
  userId: string;
  amount: number;
  wallet_address: string;
}

export async function POST(request: Request) {
  try {
    const { id, status, reason, userId, amount, wallet_address } = await request.json() as WithdrawalStatusInput;

    console.log(status);
    // Enhanced input validation
    if (!id || !status || !userId ) {
      return NextResponse.json({ error: 'Invalid input parameters' }, { status: 400 });
    }

    // Validate status
    const validStatuses: WithdrawalStatusInput['status'][] = ['pending', 'delayed', 'cancelled', 'completed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid withdrawal status' }, { status: 400 });
    }

    const updateWithdrawalStatus = async (newStatus: string, updateReason?: string | null) => {
      const { error } = await supabase
        .from('withdrawal_queue')
        .update({ 
          status: newStatus
        })
        .eq('id', id);

      if (error) {
        throw new Error(`Failed to update status to ${newStatus}`);
      }
    };


    const updateCancel = async (userId: string) => {
      const {data, error:userDetailsError } = await supabase
        .from('users')
        .select('profit_balance')
        .eq('id',userId)
        .single()

      if (userDetailsError) {
        throw new Error(`Failed to update status to ${userId}`);
      }

      const {profit_balance}= data;

      const {error :balaceUpdateError} = await supabase
      .from ('users')
      .update (
        {
          profit_balance:profit_balance+amount
        }
      )
      .eq('id',userId)

      if (balaceUpdateError) {
        throw new Error(`Failed to update balance}`);
      }
    };

    switch (status) {
      case 'delayed':
        await updateWithdrawalStatus('delayed', reason);
        break;

      case 'cancelled':
        await updateWithdrawalStatus('cancelled', reason || null);
        await updateCancel(userId)
        break;

      case 'completed':
        // update status to complet using now api 
        await updateWithdrawalStatus('pending', reason);
        break;

      default:
        return NextResponse.json({ error: 'Unhandled status' }, { status: 400 });
    }

    return NextResponse.json({ message: 'Withdrawal status updated successfully' });
  } catch (error) {
    console.error('Unexpected error in withdrawal handler:', error);
    return NextResponse.json(
      {
        error: 'Unexpected error processing withdrawal',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}