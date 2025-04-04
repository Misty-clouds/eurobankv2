'use client';
import { createClient } from '@/utils/supabase/client';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import React, { useState, useEffect } from 'react';
import { useRouter,usePathname } from '@/i18n/routing';
import LoginPage from '../../auth/login/page';
import { 
  Wallet, 
  ArrowDownToLine, 
  ArrowUpToLine, 
  Users, 
  BookOpen, 
  Home,
  Headphones,
  User,
  Search,
  Bell,
  MessagesSquare
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import dynamic from 'next/dynamic';
const Loader = dynamic(() => import('@/lib/components/loader/loading'), { ssr: false });


function  dapo (){
  return(
    <>div</>
  )
}

const EurobankDashboard = () => {
  const t = useTranslations('EurobankDashboard'); // Using translations
  const [userData, setUserData] = useState({
    dailyEarning: 0,
    referralProfit: 0,
    totalProfit: 0,
    username: t('userPlaceholder'), // Placeholder
    balance: 0,
  });

  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const pathname= usePathname();
  const supabase = createClient()
  
  // Fetch user data from API
  useEffect(() => {

    const fetchUserData = async () => {
      if (!user) return;
  
      setLoading(true);
      try {
        const { data:id,error:idError} = await supabase
        .from('users')
        .select ('id')
        .eq('firebase_uid',user.uid)
        .single()

        if (idError){
          throw idError;
        }

        const supabaseId  = id.id;


        const { data, error } = await supabase
          .from('users')
          .select('daily_profit, ref_profit, total_profit, email, profit_balance')
          .eq('id', supabaseId)
          .single();
  
        if (error) throw error;
  
        const defaultbalance = data.profit_balance;
      
  
        setUserData({
          dailyEarning: data.daily_profit || 0,
          referralProfit: data.ref_profit || 0,
          totalProfit: data.total_profit || 0,
          username: data.email.split('@')[0],
          balance: defaultbalance || 0,
        });
      } catch (err) {
        console.error(t('fetchError'), err);
        setError(t('loadError'));
      } finally {
        setLoading(false);
      }
    };
  
    fetchUserData();
  }, [user, t, supabase]);

  // Navigation functions
  const navigateToWithdraw = () => router.push('/withdrawalstatus');
  const navigateToInvite = () => router.push('/invite');
  const navigateToRules = () => router.push('/rules');
  const navigateToLevel = () => router.push('/levels');
  const navigateToAnouncement = () => router.push('/anouncement');

  // Quick Actions (Mobile)
  const renderQuickActions = () => (
    <div className="grid grid-cols-4 gap-4 p-4">
      {[
        { 
          icon: ArrowDownToLine, 
          label: t('deposit'), 
          color: 'text-green-400', 
          action: () => router.push('/depositStatus') 
        },
        { 
          icon: ArrowUpToLine, 
          label: t('withdraw'), 
          color: 'text-red-400', 
          action: navigateToWithdraw 
        },
        { 
          icon: Users, 
          label: t('invite'), 
          color: 'text-blue-400', 
          action: navigateToInvite 
        },
        { 
          icon: BookOpen, 
          label: t('rules'), 
          color: 'text-yellow-400', 
          action: navigateToRules 
        }
      ].map(({ icon: Icon, label, color, action }, index) => (
        <div 
          key={index} 
          className="flex flex-col items-center space-y-2 cursor-pointer"
          onClick={action}
        >
          <div className={`bg-secondary rounded-full p-3 ${color}`}>
            <Icon className="w-6 h-6" />
          </div>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  );

  

    if (!user) {
        return <LoginPage />;
    }
  

 

 

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Mobile View */}
      <div className="md:hidden">
        {/* Mobile Header */}
        <div className="bg-secondary p-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Image src="/e.svg" alt="logo" height={50} width={50} />
            <span className="text-xl font-bold text-primary">{t('title')}</span>
          </div>
          <div onClick={navigateToAnouncement} className="flex items-center space-x-4">
            <Search className="w-5 h-5 text-muted-foreground" />

            <div className="relative">
            <Bell className="w-5 h-5 text-muted-foreground hover:text-blue-700/50" />
            <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-green"></span>

            </div>
           
          </div>
        </div>

        {/* Mobile Main Content */}
        <div className="pb-20">
          {/* Quick Balance Overview */}
          <div className="bg-blue-900/50 backdrop-blur-md p-4 m-4 rounded-2xl flex justify-between items-center border-blue-700/50">
            <div>
              <h3 className="text-sm text-muted-foreground">{t('totalBalance')}</h3>
              <p className="text-2xl font-bold text-primary">${userData.balance}</p>
            </div>
            <button 
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm"
              onClick={navigateToLevel}
            >
              {t('levels')}
            </button>
          </div>

          {/* Quick Actions */}
          {renderQuickActions()}

          {/* Profit Cards (Mobile Version) */}
          <div className="space-y-4 p-4">
            {[
              { 
                title: t('dailyEarning'), 
                amount: userData.dailyEarning, 
                icon: Wallet,
                color: 'text-green-400' 
              },
              { 
                title: t('referralProfit'), 
                amount: userData.referralProfit, 
                icon: Users,
                color: 'text-blue-400' 
              },
              { 
                title: t('totalProfit'), 
                amount: userData.totalProfit, 
                icon: ArrowUpToLine,
                color: 'text-yellow-400' 
              }
            ].map(({ title, amount, icon: Icon, color }, index) => (
              <div 
                key={index} 
                className="bg-accent-800/50 backdrop-blur-md border border-blue-700/50 shadow-xl rounded-2xl p-4 flex items-center justify-between hover:bg-blue-700/50 transition-all cursor-pointer"
              >
                <div>
                  <h3 className="text-sm text-muted-foreground mb-1">{title}</h3>
                  <p className="text-xl font-bold text-primary">${amount}</p>
                </div>
                <Icon className={`w-10 h-10 ${color}`} />
              </div>
            ))}
          </div>

        </div>  

        {/* BottomNav   */}
    <nav className="fixed bottom-0 left-0 right-0 bg-secondary flex justify-around items-center h-16 border-t border-blue-700/50 md:hidden">
      {[
    { label: 'Home', icon: Home, path: '/dashboard' },
    { label: 'Deposit', icon: ArrowDownToLine, path: '/depositStatus' },
    { label: 'Support', icon: Headphones, path: '/support' },
    { label: 'Profile', icon: User, path: '/profile' },
  ].map(({ label, icon: Icon, path }) => (
        <div
          key={label}
          onClick={() => router.push(path)}
          className={`flex bg-secondary flex-col items-center justify-center w-full h-full cursor-pointer ${
            pathname === path ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          <Icon className="w-6 h-6" />
          <span className="text-xs">{label}</span>
        </div>
      ))}
    </nav>
      </div>

      {/* Desktop View */}
      <div className="hidden md:block">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex justify-between items-center py-4 mb-8">
            <div className="flex items-center space-x-4">
              <Image src="/e.svg" alt="€"  height={100} width={50} />
              <h1 className="text-2xl text-primary font-bold">{t('title')}</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-lg text-primary">{t('welcome', { name: userData.username })}</span>
              <div className="w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center">
                <Users className="text-primary" />
              </div>
            </div>
          </div>

            {/* Quick Balance Overview */}
            <div className="bg-blue-800/50 backdrop-blur-md p-4 my-4 rounded-2xl flex justify-between items-center border border-blue-700/50 shadow-xl">
            <div>
              <h3 className="text-sm text-muted-foreground">{t('totalBalance')}</h3>
              <p className="text-2xl font-bold text-primary">${userData.balance}</p>
            </div>
            <button 
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm"
              onClick={navigateToLevel}
            >
              {t('levels')}
            </button>
          </div>

        
          {/* Profit Cards */}
          <div className="grid grid-cols-3 gap-6 text-primary mb-8">
            {[
              { 
                title: t('dailyEarning'), 
                amount: userData.dailyEarning, 
                icon: Wallet,
                bgClass: 'bg-accent-700/50',
                textClass: 'text-blue-300',
                iconClass: 'text-green-500'
              },
              { 
                title: t('referralProfit'), 
                amount: userData.referralProfit, 
                icon: Users,
                bgClass: 'bg-accent-800/50',
                textClass: 'text-blue-300',
                iconClass: 'text-blue-500'
              },
              { 
                title: t('totalProfit'), 
                amount: userData.totalProfit, 
                icon: ArrowUpToLine,
                bgClass: 'bg-accent-800/50',
                textClass: 'text-blue-300',
                iconClass: 'text-green-500'
              }
            ].map(({ title, amount, icon: Icon, bgClass, textClass, iconClass }, index) => (
              <div key={index} className={`${bgClass} backdrop-blur-md rounded-2xl p-6 border border-blue-700/50 shadow-xl`}>
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className={`text-sm ${textClass} mb-2`}>{title}</h3>
                    <p className="text-2xl font-bold text-gold-400">${amount}</p>
                  </div>
                  <Icon className={`${iconClass} w-12 h-12`} />
                </div>
              </div>
            ))}
          </div>

                 {/* Action Cards */}
          <div className="grid grid-cols-3 gap-6">
            {[
              { icon: ArrowDownToLine, label: t('Deposit'), color: 'text-green-400', action: () => router.push('/depositStatus') },
              { icon: ArrowUpToLine, label: t('Withdraw'), color: 'text-red-400', action: navigateToWithdraw },
              { icon: Users, label: t('InviteFriends'), color: 'text-blue-400', action: navigateToInvite },
              { icon: MessagesSquare, label: t('ChatSupport'), color: 'text-white-400', action: () => router.push('/support') },
              { icon: BookOpen, label: t('Rules'), color: 'text-yellow-400', action: navigateToRules },
              { icon: Bell, label: t('Anouncement'), color: 'text-orange-400', action: navigateToAnouncement }
            ].map(({ icon: Icon, label, color, action }, index) => (
              <div 
                key={index} 
                
                className="bg-accent-800/50 backdrop-blur-md border border-blue-700/50 shadow-xl   items-center justify-between hover:bg-blue-700/50 transition-all cursor-pointer text-center rounded-2xl p-6 "
                onClick={action}
              >
                <div className={`flex justify-center items-center ${color}`}>
                  <Icon className="w-8 h-8" />
                </div>
                <p className="text-sm  m-1 self-center text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
};

export default EurobankDashboard;
