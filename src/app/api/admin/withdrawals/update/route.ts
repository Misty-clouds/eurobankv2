import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { AxiosError } from 'axios';

interface WithdrawalStatusInput {
  id: string;
  status: string;
  reason?: string;
  userId: string;
  amount: number;
  wallet_address: string;
}

const NOWPAYMENTS_API_URL = 'https://api.nowpayments.io/v1';
const FIXIE_PROXY = process.env.FIXIE_PROXY || 'http://fixie:1xRr9W89mBEYLGO@criterium.usefixie.com:80';
const ipn_callback_url = process.env.NEXT_PUBLIC_APP_URL_TEST + '/api/nowpayments/webhook';

export async function POST(request: Request) {
  console.log('Received POST request for withdrawal update');
  try {
    const { id, status, reason, userId, amount, wallet_address } = await request.json() as WithdrawalStatusInput;
    console.log('Parsed request body:', { id, status, reason, userId, amount, wallet_address });

    // Enhanced input validation
    if (!id || !status || !userId) {
      console.error('Invalid input parameters:', { id, status, userId });
      return NextResponse.json({ error: 'Invalid input parameters' }, { status: 400 });
    }

    // Validate status
    const validStatuses: WithdrawalStatusInput['status'][] = ['pending', 'delayed', 'cancelled', 'completed'];
    if (!validStatuses.includes(status)) {
      console.error('Invalid withdrawal status:', status);
      return NextResponse.json({ error: 'Invalid withdrawal status' }, { status: 400 });
    }

    const updateWithdrawalStatus = async (newStatus: string, updateReason?: string | null) => {
      console.log(`Updating withdrawal status to ${newStatus} for ID ${id}`);
      const { error } = await supabase
        .from('withdrawal_queue')
        .update({
          status: newStatus,
          reason: updateReason,
        })
        .eq('id', id);

      if (error) {
        console.error(`Failed to update status to ${newStatus} for ID ${id}:`, error);
        throw new Error(`Failed to update status to ${newStatus}`);
      }
    };

    const updateCancel = async (userId: string) => {
      console.log(`Reverting balance for user ID ${userId} due to cancellation`);
      const { data, error: userDetailsError } = await supabase
        .from('users')
        .select('profit_balance')
        .eq('id', userId)
        .single();

      if (userDetailsError) {
        console.error(`Failed to fetch user details for ID ${userId}:`, userDetailsError);
        throw new Error(`Failed to fetch user details for ID ${userId}`);
      }

      const { profit_balance } = data;
      console.log(`Current profit balance for user ID ${userId}:`, profit_balance);

      const { error: balanceUpdateError } = await supabase
        .from('users')
        .update({
          profit_balance: profit_balance + amount,
        })
        .eq('id', userId);

      if (balanceUpdateError) {
        console.error(`Failed to update balance for user ID ${userId}:`, balanceUpdateError);
        throw new Error('Failed to update balance');
      }
    };

    switch (status) {
      case 'delayed':
        console.log(`Processing delayed status for withdrawal ID ${id}`);
        await updateWithdrawalStatus('delayed', reason);
        break;

      case 'cancelled':
        console.log(`Processing cancelled status for withdrawal ID ${id}`);
        await updateWithdrawalStatus('cancelled', reason || null);
        await updateCancel(userId);
        break;

      case 'completed':
        console.log(`Processing completed status for withdrawal ID ${id}`);
        const withdrawalItems = [{
          address: wallet_address,
          currency: 'usdtbsc',
          amount: amount,
          ipn_callback_url: ipn_callback_url,
        }];

        const proxyAgent = new HttpsProxyAgent(FIXIE_PROXY);

        try {
          console.log('Requesting auth token from NOWPayments');
          const authResponse = await axios.post(
            `${NOWPAYMENTS_API_URL}/auth`,
            {
              email: process.env.NOWPAYMENTS_EMAIL,
              password: process.env.NOWPAYMENTS_PASSWORD,
            },
            { httpsAgent: proxyAgent }
          );

          if (!authResponse.data || !authResponse.data.token) {
            console.error('Failed to get auth token from NOWPayments');
            throw new Error('Failed to get auth token from NOWPayments');
          }

          const token = authResponse.data.token;
          console.log('Received auth token from NOWPayments');

          const payoutData = {
            ipn_callback_url: ipn_callback_url,
            withdrawals: withdrawalItems,
          };

          console.log('Sending payout request to NOWPayments');
          const response = await axios.post(
            `${NOWPAYMENTS_API_URL}/payout`,
            payoutData,
            {
              headers: {
                'x-api-key': process.env.NOWPAYMENTS_API_KEY,
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              httpsAgent: proxyAgent,
            }
          );

          const result = response.data;
          console.log('Payout response from NOWPayments:', result);

          const paymentId = result.withdrawals[0]?.id;
          console.log(`Updating withdrawal status to processing for ID ${id} with payment ID ${paymentId}`);

          const { error: updateError } = await supabase
            .from('withdrawal_queue')
            .update({
              status: 'processing',
              payment_id: paymentId,
            })
            .eq('id', id);

          if (updateError) {
            console.error(`Failed to update withdrawal status for ID ${id}:`, updateError);
            throw new Error(`Failed to update withdrawal status for ID ${id}`);
          }

          return NextResponse.json({ message: 'Withdrawal status updated successfully', paymentId });
        } catch (error: unknown) {
          console.error('Error processing completed withdrawal:', error);

          const axiosError = error as AxiosError;
          if (axiosError.response) {
            console.error('Error response data:', axiosError.response.data);
            console.error('Error response status:', axiosError.response.status);
          }

          const errorMessage = axiosError.response?.data || (error as Error).message;
          console.log(`Updating withdrawal status to pending for ID ${id} due to error:`, errorMessage);
          await updateWithdrawalStatus('pending', errorMessage as string);
          return NextResponse.json({ error: 'Failed to process completed withdrawal' }, { status: 500 });
        }

        break;

      default:
        console.error('Unhandled status:', status);
        return NextResponse.json({ error: 'Unhandled status' }, { status: 400 });
    }

    console.log('Withdrawal status updated successfully');
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
