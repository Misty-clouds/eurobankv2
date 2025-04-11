import { NextRequest, NextResponse } from 'next/server';
import { makeRequest } from '../../../utils/bitgetApi';

/**
 * Process withdrawal using Bitget API
 * @param walletAddress - Recipient's wallet address
 * @param amount - Amount to withdraw
 * @param coin - The coin to withdraw (default: 'USDT')
 * @param chain - Blockchain network (default: 'BEP20')
 * @returns { transactionHash: string }
 */

 async function processWithdrawal(
  walletAddress: string,
  amount: number,
  coin = 'USDT',
  chain = 'BEP20'
): Promise<{ transactionHash: string }> {
  try {
    // Validate BEP20 wallet address
    const bep20AddressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!bep20AddressRegex.test(walletAddress)) {
      throw new Error('Invalid BEP20 wallet address');
    }

    if (amount <= 0.1) {
      throw new Error('Withdrawal amount must be greater than 0.1');
    }

    // Format the withdrawal request according to Bitget's API specifications
    const withdrawalData = {
      coin: coin.toUpperCase(),
      amount: amount.toString(),
      address: walletAddress,
      chain: chain.toUpperCase(),
    };

    console.log('Sending withdrawal request to Bitget:', withdrawalData);

    // Make the API call
    const response = await makeRequest(
      'POST',
      '/api/spot/v1/wallet/withdrawal',
      withdrawalData
    );

    console.log('Bitget API response:', response);

    if (response.code !== '00000') {
      throw new Error(`Bitget API Error ${response.code}: ${response.message}`);
    }

    return {
      transactionHash: response.data.id,
    };
  } catch (error) {
    console.error('Withdrawal error details:', {
      error: error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : error,
      params: {
        walletAddress,
        amount,
        coin,
        chain,
      },
    });

    if (error instanceof Error) {
      throw new Error(error.message || 'Unexpected error during withdrawal process');
    } else {
      throw new Error('Unexpected error during withdrawal process');
    }
  }
}

// POST handler for the API route
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, amount, coin, chain } = body;

    // Validate required fields
    if (!walletAddress || !amount) {
      return NextResponse.json(
        { error: 'Wallet address and amount are required' },
        { status: 400 }
      );
    }

    const result = await processWithdrawal(walletAddress, amount, coin, chain);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('API route error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
