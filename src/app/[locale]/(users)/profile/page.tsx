'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { signOut } from 'firebase/auth';
import { useCurrentUser } from '@/lib/auth/useCurrentUser';
import { createClient } from '@/utils/supabase/client';

import {
  User,
  Mail,
  Phone,
  CreditCard,
  LogOut,
  Copy,
  Star,
  Trophy,
  Layers,
} from 'lucide-react';

import { useRouter } from '@/i18n/routing';
import BottomNav from '@/lib/components/BottomNav';
import { auth } from '@/firebase/config';

const ProfilePage = () => {
  const t = useTranslations('ProfilePage');
  const router = useRouter();

  const [userData, setUserData] = useState({
    username: '',
    email: '',
    phone: 'N/A',
    memberSince: '',
    referralCode: '',
    level: 0,
    totalReferrals: 0,
    accountStatus: 'Active',
  });

  const user = useCurrentUser();
  const supabase = createClient();

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('users')
          .select(`
            email,
            created_at,
            referral_id,
            level,
            refferal_number
          `)
          .eq('id', user.supabaseId)
          .single();

        if (error) throw error;

        const formattedDate = data.created_at
          ? new Date(data.created_at).toLocaleDateString()
          : 'N/A';

        setUserData({
          username: data.email.split('@')[0],
          email: data.email,
          phone: 'N/A',
          memberSince: formattedDate,
          referralCode: data.referral_id || 'N/A',
          level: data.level || 0,
          totalReferrals: data.refferal_number || 0,
          accountStatus: 'Active',
        });
      } catch (err) {
        console.error(t('fetchError'), err);
      }
    };

    fetchUserData();
  }, [user, t, supabase]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      console.log('User signed out successfully');
      router.push('/auth/login'); // Redirect to login page
    } catch (error) {
      console.error('Error signing out:', error);
      if (error instanceof Error) {
        alert(t('logoutError', { error: error.message }));
      } else {
        alert(t('logoutError', { error: String(error) }));
      }
    }
  };

  const profileActions = [
    {
      icon: LogOut,
      label: t('logout'),
      color: 'text-red-400',
      action: handleLogout,
    },
  ];

  const profileStats = [
    {
      icon: Star,
      label: t('level'),
      value: userData.level,
      color: 'text-yellow-400',
    },
    {
      icon: Trophy,
      label: t('referrals'),
      value: userData.totalReferrals,
      color: 'text-blue-400',
    },
    {
      icon: Layers,
      label: t('status'),
      value: userData.accountStatus,
      color: 'text-green-400',
    },
  ];

  const copyToClipboard = (text:string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert(t('copied'));
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <div className="bg-secondary p-4 flex justify-between items-center mb-8 rounded-2xl">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.back()}
              className="text-muted-foreground hover:text-primary"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <h1 className="text-2xl text-primary font-bold">{t('profile')}</h1>
          </div>
        </div>

        <div className="bg-blue-900/50 backdrop-blur-md p-6 mb-8 rounded-2xl border border-blue-700/50 flex flex-col items-center">
          <div className="w-24 h-24 bg-primary-600 rounded-full flex items-center justify-center mb-4">
            <User className="w-12 h-12 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-bold text-primary mb-2">{userData.username}</h2>
          <p className="text-muted-foreground">{t('memberSince', { date: userData.memberSince })}</p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          {profileStats.map(({ icon: Icon, label, value, color }, index) => (
            <div
              key={index}
              className="bg-blue-800/50 backdrop-blur-md rounded-2xl p-4 border border-blue-700/50 flex flex-col items-center"
            >
              <Icon className={`${color} w-10 h-10 mb-2`} />
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-xl font-bold text-primary">{value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4">
          {profileActions.map(({ icon: Icon, label, color, action }, index) => (
            <div
              key={index}
              className="bg-accent-800/50 backdrop-blur-md rounded-2xl p-6 border border-blue-700/50 shadow-xl hover:bg-blue-700/50 transition-all cursor-pointer"
              onClick={action}
            >
              <div className="flex flex-col items-center">
                <Icon className={`${color} w-12 h-12 mb-4`} />
                <h3 className="text-lg font-semibold">{label}</h3>
              </div>
            </div>
          ))}
        </div>
        <div style={{ height: '100px' }}></div>

      </div>
      <BottomNav />
    </div>
  );
};

export default ProfilePage;
