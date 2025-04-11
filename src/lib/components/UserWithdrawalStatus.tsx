'use client';

import { useState, useEffect } from 'react';
import { useCurrentUser } from '@/lib/auth/useCurrentUser';
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { ArrowLeft, DollarSign, AlertCircle, Clock, Info } from 'lucide-react';
import BottomNav from '@/lib/components/BottomNav';
import { createClient } from '@/utils/supabase/client';

interface Withdrawal {
  id: string;
  amount: number;
  status: 'pending' | 'delayed' | 'canceled' | 'completed';
  reason?: string;
}

export default function UserWithdrawalStatus() {
  const t = useTranslations('WithdrawalStatus'); // Use translations
  const user = useCurrentUser();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase= createClient()

  const toWithdrawal = () => router.push('/withdrawal');

  const fetchWithdrawals = async () => {
    if (!user?.supabaseId) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/user/withdrawals?user_id=${user.supabaseId}`);
      if (!res.ok) throw new Error(t('fetchError'));

      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setWithdrawals(data.withdrawals);
      }
    } catch (err) {
      const errorMessage = (err as Error).message || t('unknownError');
      console.error(t('consoleError'), errorMessage);
      setError(t('loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchWithdrawals();
    }
  }, [user]);

  if (loading) return <div>{t('loading')}</div>;
  if (error) return <div>{error}</div>;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-400';
      case 'pending':
        return 'text-yellow-400';
      case 'delayed':
        return 'text-orange-400';
      case 'canceled':
        return 'text-red-400';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-secondary p-4 flex justify-between items-center mb-8 rounded-2xl">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => router.push('/dashboard')} 
              className="text-muted-foreground hover:text-primary"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl text-primary font-bold">{t('header')}</h1>
          </div>
        </div>

        {/* Status Overview */}
        <div className="bg-blue-900/50 backdrop-blur-md p-6 mb-8 rounded-2xl border border-blue-700/50 flex flex-col items-center">
          <div className="w-24 h-24 bg-primary-600 rounded-full flex items-center justify-center mb-4">
            <DollarSign className="w-12 h-12 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-bold text-primary mb-2">{t('overviewTitle')}</h2>
          <p className="text-muted-foreground text-center">
            {t('overviewSubtitle')}
          </p>
        </div>

        {error && (
          <div className="bg-red-900/50 backdrop-blur-md rounded-2xl p-6 mb-8 border border-red-700/50 flex items-center space-x-3">
            <AlertCircle className="text-red-400 w-6 h-6" />
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {withdrawals.length === 0 ? (
          <div className="bg-accent-800/50 backdrop-blur-md rounded-2xl p-6 border border-blue-700/50 flex flex-col items-center">
            <Clock className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t('noRecords')}</p>
          </div>
        ) : (
          <div className="space-y-4 mb-8">
            {withdrawals.map((withdrawal) => (
              <div
                key={withdrawal.id}
                className="bg-accent-800/50 backdrop-blur-md rounded-2xl p-6 border border-blue-700/50"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Amount */}
                  <div className="flex items-center space-x-3">
                    <DollarSign className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">{t('amount')}</p>
                      <p className="font-medium text-primary">
                        ${withdrawal.amount.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center space-x-3">
                    <AlertCircle className={`w-5 h-5 ${getStatusColor(withdrawal.status)}`} />
                    <div>
                      <p className="text-sm text-muted-foreground">{t('status')}</p>
                      <p className={`font-medium ${getStatusColor(withdrawal.status)}`}>
                        {t(`statuses.${withdrawal.status}`)}
                      </p>
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="flex items-center space-x-3">
                    <Info className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">{t('reason')}</p>
                      <p className="font-medium text-primary">
                        {withdrawal.reason || t('notApplicable')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Withdrawal Button */}
        <button
          onClick={toWithdrawal}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 mt-3 mb-[200px] rounded-2xl flex items-center justify-center space-x-3 transition-all"
        >
          <DollarSign className="w-6 h-6" />
          <span>{t('withdrawalButton')}</span>
        </button>
      </div>
      <BottomNav />
    </div>
  );
}
