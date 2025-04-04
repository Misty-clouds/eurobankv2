'use client';

import { useState, useEffect } from 'react';
import { useCurrentUser } from '@/lib/auth/useCurrentUser';
import { useRouter } from '@/i18n/routing';
import { z } from 'zod';
import { ArrowLeft, DollarSign, Wallet, AlertTriangle, CheckCircle2 } from 'lucide-react';
import BottomNav from '@/lib/components/BottomNav';
import { useTranslations } from 'next-intl';
import { createClient } from '@/utils/supabase/client';

// Zod schema for BSC USDT wallet address validation
const BSCUSDTAddressSchema = z.string().regex(
  /^0x[a-fA-F0-9]{40}$/,
  { message: 'Invalid BSC USDT wallet address' }
);

export default function WithdrawalForm() {
  const t = useTranslations('WithdrawalForm');
  const router = useRouter();
  const user = useCurrentUser();
  const [amount, setAmount] = useState<number>(0);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [totalProfit, setTotalProfit] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const supabase = createClient();

  const fetchUserProfit = async () => {
    if (!user?.supabaseId) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('profit_balance')
        .eq('id', user.supabaseId)
        .single();

      if (error) throw error;

      if (data) {
        setTotalProfit(data.profit_balance || 0);
      }
    } catch (err) {
      console.error('Error fetching profit:', err);
      setError(t('errors.fetchError'));
    }
  };

  useEffect(() => {
    if (user) fetchUserProfit();
  }, [user]);

  const validateWalletAddress = (address: string) => {
    try {
      BSCUSDTAddressSchema.parse(address);
      return true;
    } catch {
      return false;
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();

    setError(null);
    setSuccess(null);

    if (!user) {
      setError(t('errors.unauthenticated'));
      return;
    }

    if (amount < 15) {
      setError(t('errors.invalidAmount'));
      return;
    }

    if (amount > totalProfit) {
      setError(t('errors.exceedsBalance'));
      return;
    }

    if (!validateWalletAddress(walletAddress)) {
      setError(t('errors.invalidWalletAddress'));
      return;
    }

    try {
      const res = await fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user_id: user.supabaseId, 
          amount, 
          address: walletAddress 
        }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setSuccess(t('success.withdrawalPlaced'));
        fetchUserProfit();
        setAmount(0);
        setWalletAddress('');
      }
    } catch (err) {
      setError(t('errors.unexpected'));
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
            <h1 className="text-2xl text-primary font-bold">{t('header.title')}</h1>
          </div>
        </div>

        {/* Overview Section */}
        <div className="bg-blue-900/50 backdrop-blur-md p-6 mb-8 rounded-2xl border border-blue-700/50 flex flex-col items-center">
          <div className="w-24 h-24 bg-primary-600 rounded-full flex items-center justify-center mb-4">
            <DollarSign className="w-12 h-12 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-bold text-primary mb-2">{t('overview.title')}</h2>
          {totalProfit !== null && (
            <p className="text-muted-foreground text-center">
              {t('overview.balance', { balance: totalProfit })}
            </p>
          )}
        </div>

        {/* Status Messages */}
        {error && (
          <div className="bg-red-900/50 backdrop-blur-md rounded-2xl p-4 mb-6 border border-red-700/50 flex items-center space-x-3">
            <AlertTriangle className="text-red-400 w-6 h-6 flex-shrink-0" />
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-900/50 backdrop-blur-md rounded-2xl p-4 mb-6 border border-green-700/50 flex items-center space-x-3">
            <CheckCircle2 className="text-green-400 w-6 h-6 flex-shrink-0" />
            <p className="text-green-200">{success}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleWithdraw}>
          <div className="bg-accent-800/50 backdrop-blur-md rounded-2xl p-6 mb-6 border border-blue-700/50 space-y-6">
            <div>
              <label htmlFor="withdrawAmount" className="block text-lg font-semibold text-primary mb-4">
                {t('form.amountLabel')}
              </label>
              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                <input
                  id="withdrawAmount"
                  type="number"
                  placeholder={t('form.amountPlaceholder')}
                  value={amount}
                  onChange={(e) => setAmount(parseFloat(e.target.value))}
                  min="0"
                  className="w-full px-4 py-3 bg-background/30 text-primary rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary border border-blue-700/50 pl-12"
                />
              </div>
            </div>

            {/* Wallet Address Input */}
            <div>
              <label htmlFor="walletAddress" className="block text-lg font-semibold text-primary mb-4">
                {t('form.walletLabel')}
              </label>
              <div className="relative">
                <Wallet className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                <input
                  id="walletAddress"
                  type="text"
                  placeholder={t('form.walletPlaceholder')}
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  className="w-full px-4 py-3 bg-background/30 text-primary rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary border border-blue-700/50 pl-12"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={!user || totalProfit === null || !walletAddress}
            className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center space-x-3 transition-all ${
              (totalProfit === null || !walletAddress) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <DollarSign className="w-6 h-6" />
            <span>{totalProfit === null ? t('form.loading') : t('form.submitButton')}</span>
          </button>
            <div style={{ height: '100px' }}></div>

        </form>
      </div>
      <BottomNav />
    </div>
  );
}
