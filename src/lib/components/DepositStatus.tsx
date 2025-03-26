'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { ArrowLeft, Clock, DollarSign, Hash, AlertCircle } from 'lucide-react';
import BottomNav from '@/lib/components/BottomNav';
import { useCurrentUser } from '../auth/useCurrentUser';

interface Deposit {
  id: number;
  created_at: string;
  user_id: string;
  wallet_address: string;
  amount: number;
  transaction_hash: string;
  updated_at: string;
  expires_at: string;
  status: string;
}

export default function DepositStatus() {
  const t = useTranslations('DepositStatus'); // Hook for translations
  const router = useRouter();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = useCurrentUser();
  const navigateToDeposit = () => router.push('/deposit');
  const userId= user?.supabaseId;
  const [verifyingDepositId, setVerifyingDepositId] = useState<number | null>(null);



  const verifyDeposit = async (deposit: Deposit) => {
    try {
      setVerifyingDepositId(deposit.id);
      const response = await fetch('/api/deposit/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user:userId,
          depositId: deposit.id,
          walletAddress: deposit.wallet_address,
          amount: deposit.amount,
          createdAt: deposit.created_at,
          expiresAt: deposit.expires_at
        })
      });
  
      if (!response.ok) {
        throw new Error('Verification failed');
      }
  
      const result = await response.json();
      if (result.verified) {
        // Refresh the deposits list
        const updatedDeposits = deposits.map(d => 
          d.id === deposit.id ? { ...d, status: 'completed' } : d
        );
        setDeposits(updatedDeposits);
      } else {
        alert('No matching transaction found');
      }
    } catch (error) {
      console.error('Error verifying deposit:', error);
      alert('Failed to verify deposit');
    }finally{
      setVerifyingDepositId(null);
    }
  };

  useEffect(() => {
    const fetchStatuses = async () => {
      if (!user) return;

      try {
        const response = await fetch(`/api/deposit/status?user_id=${user.supabaseId}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.statusText}`);
        }

        const data = await response.json();

        if (data && Array.isArray(data.deposits)) {
          setDeposits(data.deposits);
        } else {
          throw new Error('Unexpected response format.');
        }
      } catch (error: any) {
        console.error('Failed to fetch deposit statuses:', error);
        setError(error.message || 'An unknown error occurred.');
      } finally {
        setLoading(false);
      }
    };

    fetchStatuses();
  }, [user]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'text-green-400';
      case 'pending':
        return 'text-yellow-400';
      case 'failed':
        return 'text-red-400';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden text-foreground">
      <div className="container mx-auto px-4 py-8 pb-24"> {/* Added padding-bottom */}
        {/* Header */}
        <div className="bg-secondary p-4 flex justify-between items-center mb-8 rounded-2xl">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.back()}
              className="text-muted-foreground hover:text-primary"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl text-primary font-bold">{t('depositStatus')}</h1>
          </div>
        </div>

        {/* Status Overview */}
        <div className="bg-blue-900/50 backdrop-blur-md p-6 mb-8 rounded-2xl border border-blue-700/50 flex flex-col items-center">
          <div className="w-24 h-24 bg-primary-600 rounded-full flex items-center justify-center mb-4">
            <DollarSign className="w-12 h-12 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-bold text-primary mb-2">{t('yourDeposits')}</h2>
          <p className="text-muted-foreground text-center">{t('trackDeposits')}</p>
        </div>

        {loading ? (
          <div className="bg-accent-800/50 backdrop-blur-md rounded-2xl p-6 border border-blue-700/50 flex items-center justify-center">
            <div className="text-primary">{t('loadingDeposits')}</div>
          </div>
        ) : error ? (
          <div className="bg-red-900/50 backdrop-blur-md rounded-2xl p-6 border border-red-700/50 flex items-center space-x-3">
            <AlertCircle className="text-red-400 w-6 h-6" />
            <p className="text-red-200">
              {t('error')}: {error}
            </p>
          </div>
        ) : deposits.length === 0 ? (
          <div className="bg-accent-800/50 backdrop-blur-md rounded-2xl p-6 border border-blue-700/50 flex flex-col items-center">
            <Clock className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t('noDepositsFound')}</p>
            <button
              onClick={navigateToDeposit}
              className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center space-x-3 transition-all ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <DollarSign className="w-6 h-6" />
              <span>{loading ? t('processing') : t('initiateDeposit')}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {deposits.map((deposit) => (
              <div
                key={deposit.id}
                className="bg-accent-800/50 backdrop-blur-md rounded-2xl p-6 border border-blue-700/50"
              >
                <div className="grid grid-cols-2 gap-4">
                  {/* Amount */}
                  <div className="flex items-center space-x-3">
                    <DollarSign className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">{t('amount')}</p>
                      <p className="font-medium text-primary">${deposit.amount.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center space-x-3">
                    <AlertCircle className={`w-5 h-5 ${getStatusColor(deposit.status)}`} />
                    <div>
                      <p className="text-sm text-muted-foreground">{t('status')}</p>
                      <p className={`font-medium ${getStatusColor(deposit.status)}`}>
                        {deposit.status}
                      </p>
                    </div>
                  </div>

                  {/* Expiry */}
                  <div className="flex items-center space-x-3">
                    <Clock className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">{t('expiresAt')}</p>
                      <p className="font-medium text-primary">
                        {new Date(deposit.expires_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Transaction Hash */}
                  <div className="flex items-center overflow-x-hidden space-x-3">
                    <Hash className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">{t('transaction')}</p>
                      <p className="font-medium text-primary truncate max-w-[100px]">
                        {deposit.transaction_hash || 'N/A'}
                      </p>
                    </div>
                  </div>

                   {/* verification button for pending/expired status 
                    //Not needed in nowpayment implementation 
                   */}
                  {/* {(deposit.status === 'pending' || deposit.status === 'expired') && (
                    <button
                      onClick={() => verifyDeposit(deposit)}
                      disabled={verifyingDepositId===deposit.id}
                      className="w-full mt-4 bg-primary hover:bg-green-700  font-bold py-2 rounded-xl flex items-center justify-center space-x-2  "
                    >
                      <AlertCircle className="w-5 h-5" />
                      <span>{t('verifyTransaction')}</span>
                    </button>
                  )}  */}

                  
                </div>
              </div>
            ))}

            {/* Initiate Deposit Button */}
            <button
              onClick={navigateToDeposit}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center space-x-3 transition-all"
            >
              <DollarSign className="w-6 h-6" />
              <span>{t('initiateDeposit')}</span>
            </button>
            <div className="h-10"></div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
