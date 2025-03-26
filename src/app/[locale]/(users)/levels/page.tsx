'use client';

import React from 'react';
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ArrowUpToLine, Wallet } from 'lucide-react';
import BottomNav from '@/lib/components/BottomNav';

interface LevelInfo {
  level: number;
  dailyProfit: string;
  deposit: string;
}

const levels: LevelInfo[] = [
  { level: 1, dailyProfit: "$2.00", deposit: "$80" },
  { level: 2, dailyProfit: "$3.00", deposit: "$100" },
  { level: 3, dailyProfit: "$6.00", deposit: "$200" },
  { level: 4, dailyProfit: "$12.00", deposit: "$400" },
  { level: 5, dailyProfit: "$15.00", deposit: "$500" },
  { level: 6, dailyProfit: "$30.00", deposit: "$1,000" },
  { level: 7, dailyProfit: "$60.00", deposit: "$2,000" },
  { level: 8, dailyProfit: "$150.00", deposit: "$5,000" },
  { level: 9, dailyProfit: "$300.00", deposit: "$10,000" },
  { level: 10, dailyProfit: "$450.00", deposit: "$15,000" },
];

export default function LevelsPage() {
  const router = useRouter();
  const t = useTranslations('LevelsPage');

  const navigateToDeposit = () => {
    router.push('/deposit');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        {/* Header - Matched with withdrawal form style */}
        <div className="bg-secondary p-4 flex justify-between items-center mb-8 rounded-2xl">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => router.push('/dashboard')} 
              className="text-muted-foreground hover:text-primary"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl text-primary font-bold">{t('title')}</h1>
          </div>
        </div>

        {/* Overview Section */}
        <div className="bg-blue-900/50 backdrop-blur-md p-6 mb-8 rounded-2xl border border-blue-700/50 flex flex-col items-center">
          <div className="w-24 h-24 bg-primary-600 rounded-full flex items-center justify-center mb-4">
            <Wallet className="w-12 h-12 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-bold text-primary mb-2">{t('schemeTitle')}</h2>
          <p className="text-muted-foreground text-center">{t('schemeDescription')}</p>
        </div>

        {/* Levels Grid */}
        <div className="pb-20 md:pb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {levels.map((level) => (
              <div
                key={level.level}
                onClick={navigateToDeposit}
                className="bg-accent-800/50 backdrop-blur-md border border-blue-700/50 rounded-2xl p-6 hover:bg-blue-700/50 transition-all cursor-pointer"
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-primary">{t('level', { level: level.level })}</h3>
                  <ArrowUpToLine className="w-6 h-6 text-blue-400" />
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('dailyProfit')}</p>
                    <p className="text-lg font-bold text-green-400">{level.dailyProfit}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('requiredDeposit')}</p>
                    <p className="text-lg font-bold text-primary">{level.deposit}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
