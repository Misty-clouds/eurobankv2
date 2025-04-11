'use client';
import './Admin.css'
import { createClient } from '@/utils/supabase/client';
import { supabase } from '@/lib/db';
import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Search,
  Wallet,
  Copy,
  Filter
} from 'lucide-react';

interface WithdrawalRequest {
  id: string;
  user_id?: string;
  username?: string;
  amount: number;
  status: 'pending' | 'delayed' | 'completed' | 'cancelled';
  requestDate: string;
  method: string;
  wallet_address: string;
}

// Toast Component
const Toast = ({ message, type = 'success', onClose }: { 
  message: string; 
  type?: 'success' | 'error'; 
  onClose: () => void;
}) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${
      type === 'success' ? 'bg-green-600' : 'bg-red-600'
    } text-white px-6 py-3 rounded-lg shadow-lg`}>
      {message}
    </div>
  );
};

// Dialog Component
const Dialog = ({ 
  open, 
  onClose, 
  title, 
  description, 
  children, 
  footer 
}: { 
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg max-w-md w-full p-6 shadow-xl">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          {description && (
            <p className="mt-2 text-gray-300">{description}</p>
          )}
        </div>
        {children}
        <div className="mt-6 flex justify-end space-x-3">
          {footer}
        </div>
      </div>
    </div>
  );
};


function WalletList() {
  const supabase = createClient();
  const [walletAddresses, setWalletAddresses] = useState<string[]>([]);

  useEffect(() => {
    const fetchWalletList = async () => {
      const { data, error } = await supabase.from('pending_withdrawal_addresses').select('*');
      if (error) {
        console.error(error);
        return;
      }
      setWalletAddresses(data.map(item => item.wallet_address));
    };
    
    fetchWalletList();
  });

  return (
    <div className="bg-gray-800 shadow-lg rounded-lg p-4 mb-4  border-l-4 border-blue-500 mt-8">
      <h1 className="text- font-bold text-white mb-4">Unique Wallet Address List</h1>
      <div className="space-y-3">
        {walletAddresses.map((address, index) => (
          <div key={index} className="flex items-center justify-between bg-gray-700/50 p-3 rounded-lg">
            <div className="flex items-center space-x-2">
              <Wallet className=" text-blue-400" />
              <span className="text-gray-200 text-sm truncate max-w-sm">{address}</span>
            </div>
            <button
              onClick={() => copyToClipboard(address)}
              className="text-blue-400 hover:text-blue-300 p-2"
              title="Copy address"
            >
              <Copy size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const copyToClipboard = async (address: string) => {
  try {
    await navigator.clipboard.writeText(address);
    alert('Wallet address copied to clipboard');
  } catch (err) {
    alert('Failed to copy address');
  }
};




const WithdrawalRequestCard = ({ request, onUpdateStatus }: {
  request: WithdrawalRequest;
  onUpdateStatus: (id: string, newStatus: 'completed' | 'delayed' | 'cancelled') => void;
}) => {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showBalanceDialog, setShowBalanceDialog] = useState(false);  // Control dialog visibility
  const [balanceChange, setBalanceChange] = useState<number>(0);  // New balance change
  const [loading, setLoading] = useState(false);  // Loading state
  const [userBalance, setUserBalance] = useState<number | null>(null); // Current user's balance

  // Fetch the user's balance when the component mounts
  useEffect(() => {
    const fetchUserBalance = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('profit_balance')
          .eq('id', request.user_id)
          .single(); 

        if (error) throw new Error(error.message);

        setUserBalance(data?.profit_balance ?? 0);
      } catch (err) {
        setToast({ message: 'Failed to fetch user balance', type: 'error' });
      }
    };

    fetchUserBalance();
  }, [request.user_id]);

  // Show toast message
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  // Handle status update (Completed, Delayed, Cancelled)
  const initiateStatusUpdate = (status: 'completed' | 'delayed' | 'cancelled') => {
    onUpdateStatus(request.id, status);
    showToast(`Request ${status} successfully`);
  };

  // Handle balance update logic (Increase or Decrease)
  const handleBalanceUpdate = async () => {
    setLoading(true);
    try {
      if (balanceChange === 0) {
        throw new Error('Balance change cannot be zero');
      }

      const newBalance = userBalance! + balanceChange; // Ensure userBalance is not null

      const { error } = await supabase
        .from('users')
        .update({ profit_balance: newBalance })
        .eq('id', request.user_id);

      if (error) throw new Error(error.message);

      setUserBalance(newBalance); // Update the local balance after successful update
      showToast(`Balance updated successfully to ${newBalance.toLocaleString()}`, 'success');
      setShowBalanceDialog(false);  // Close the dialog after successful update
    } catch (err) {
      if (err instanceof Error) {
        showToast(err.message || 'Failed to update balance', 'error');
      } else {
        showToast('Failed to update balance', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Copy wallet address to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Address copied to clipboard', 'success');
  };

  return (
    <>
      <div className="bg-gray-800 shadow-lg rounded-lg p-4 mb-4 border-l-4 border-blue-500">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
          <div className="flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-4 mb-2 md:mb-0">
            <span className="font-bold text-lg text-blue-400">UID: {request.user_id || 'N/A'}</span>
            <span className={`px-2 py-1 rounded text-xs ${
              request.status === 'pending' ? 'bg-yellow-900 text-yellow-300' :
              request.status === 'delayed' ? 'bg-orange-900 text-orange-300' :
              request.status === 'completed' ? 'bg-green-900 text-green-300' :
              'bg-red-900 text-red-300'
            }`}>
              {request.status.toUpperCase()}
            </span>
          </div>
          <div className="text-gray-400 text-sm">{request.requestDate}</div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
          <div className="w-full md:w-auto">
            <div className="flex items-center space-x-2 mb-2">
              <Wallet className="w-4 h-4" />
              <div className="text-gray-300 text-sm font-semibold truncate max-w-xs">
                {request.wallet_address}
              </div>
              <button 
                onClick={() => copyToClipboard(request.wallet_address)}
                className="text-blue-400 hover:text-blue-300"
                title="Copy address"
              >
                <Copy size={16} />
              </button>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-blue-400 font-bold text-xl">${request.amount.toLocaleString()}</div>
            </div>

            {userBalance !== null && (
              <div className="mt-2 text-gray-400">
                <span className="font-semibold">Current Balance:</span> ${userBalance.toLocaleString()}
              </div>
            )}
          </div>

            {(request.status !== 'cancelled' && request.status !== 'completed') && (
            <div className="flex space-x-2 w-full md:w-auto justify-end">
              <>
                <button 
                onClick={() => initiateStatusUpdate('completed')}
                disabled={loading}
                className={`bg-green-600 text-white p-2 rounded-full hover:bg-green-700 transition ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                <CheckCircle color='green' size={20} />
                </button>
                <button 
                onClick={() => initiateStatusUpdate('delayed')}
                disabled={loading}
                className={`bg-orange-600 text-white p-2 rounded-full hover:bg-orange-700 transition ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                <Clock color='orange' size={20} />
                </button>
              </>
              <button 
              onClick={() => initiateStatusUpdate('cancelled')}
              disabled={loading}
              className={`bg-red-600 text-white p-2 rounded-full hover:bg-red-700 transition ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
              <XCircle color='red' size={20} />
              </button>
              <button 
              onClick={() => setShowBalanceDialog(true)}  // Open balance update dialog
              disabled={loading}
              className={`bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
              Update Balance
              </button>
            </div>
            )}
          </div>
          </div>

      {/* Balance Update Dialog */}
      <Dialog 
        open={showBalanceDialog} 
        onClose={() => setShowBalanceDialog(false)} 
        title="Update Balance"
        description="Enter the amount to increase or decrease the balance."
      >
        <div className="space-y-4">
          <input
            type="number"
            value={balanceChange}
            onChange={(e) => setBalanceChange(Number(e.target.value))}
            className="w-full p-3 bg-gray-800 rounded-lg text-white border border-gray-700"
            placeholder="Enter amount (positive or negative)"
          />
          <div className="flex space-x-4 justify-end">
            <button
              onClick={handleBalanceUpdate}
              disabled={loading}
              className="bg-green-600 text-white p-2 rounded-full disabled:bg-gray-600"
            >
              {loading ? 'Updating...' : 'Update Balance'}
            </button>
            <button
              onClick={() => setShowBalanceDialog(false)}
              className="bg-gray-600 text-white p-2 rounded-full"
            >
              Cancel
            </button>
          </div>
        </div>
      </Dialog>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
};



const WithdrawalsPage = () => {
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const supabase = createClient();
  const [filter, setFilter] = useState<'all' | 'pending' | 'delayed' | 'completed' | 'cancelled'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);

  // Fetch the initial toggle state from Supabase
  useEffect(() => {
    const getSavedState = async () => {
      try {
        const { data, error } = await supabase
          .from('automatic')
          .select('enabled')
          .eq('id', 1)
          .single();

        if (error) {
          console.error('Error fetching state:', error);
          return;
        }

        setIsEnabled(data?.enabled ?? false);
      } catch (err) {
        console.error('Error fetching initial toggle state:', err);
      }
    };

    getSavedState();
  }, [supabase]);

  const handleToggle = async () => {
    const newState = !isEnabled;
    setIsEnabled(newState);

    try {
      const { error } = await supabase
        .from('automatic')
        .update({ enabled: newState })
        .eq('id', 1);

      if (error) {
        console.error('Error updating toggle state:', error);
        alert('Failed to update the state. Please try again.');
        setIsEnabled(!newState); // Revert state on failure
      }
    } catch (err) {
      console.error('Error updating state:', err);
      alert('An error occurred while updating the state.');
      setIsEnabled(!newState); // Revert state on failure
    }
  };

  // Fetch withdrawal requests
  useEffect(() => {
    const fetchWithdrawals = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/admin/withdrawals/pending');
        const data = await response.json();
        if (response.ok) {
          setRequests(data.withdrawals);
        } else {
          setError(data.error || 'Failed to fetch withdrawals');
        }
      } catch (error) {
        setError('Network error. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchWithdrawals();
  }, []);

  const updateRequestStatus = async (id: string, newStatus: 'completed' | 'delayed' | 'cancelled') => {
    try {
      const request = requests.find(req => req.id === id);
      if (!request) {
        throw new Error('Request not found');
      }

      const response = await fetch('/api/admin/withdrawals/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status: newStatus,
          userId: request.user_id,
          amount: request.amount,
          reason: newStatus === 'delayed' || newStatus === 'cancelled' ? 'Admin decision' : undefined,
          wallet_address: request.wallet_address
        }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || 'Failed to update withdrawal status');
      }

      setRequests(requests.map(req => 
        req.id === id ? { ...req, status: newStatus } : req
      ));
    } catch (err) {
      console.error(err);
      alert((err as Error).message || 'Failed to update request');
    }
  };

  const filteredRequests = requests.filter((request) => {
    const matchesFilter = filter === 'all' || request.status === filter;   
    return matchesFilter ;
  });

  const statusCounts = {
    all: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    delayed: requests.filter(r => r.status === 'delayed').length,
    completed: requests.filter(r => r.status === 'completed').length,
    cancelled: requests.filter(r => r.status === 'cancelled').length,
  };



  return (
    <div className="min-h-screen  bg-gray-900 p-4 md:p-6">
      <div className="container mx-auto max-w-7xl">
        {loading ? (
          <div className="text-center text-gray-400">Loading...</div>
        ) : error ? (
          <div className="text-center text-red-400">{error}</div>
        ) : (
          <>
            {/* Search and Filter Controls */}
            <div className="mb-6 space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by username or user ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full p-3 pl-10 bg-gray-800 rounded-lg text-white border border-gray-700 focus:border-blue-500 focus:outline-none"
                />
                <Search className="absolute left-3 top-3.5 text-gray-400" size={20} />
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="md:hidden absolute right-3 top-3 text-gray-400 hover:text-white"
                >
                  <Filter size={20} />
                </button>
              </div>

              {/* Status Filters - Desktop */}
              <div className="overflow-x-hidden">
              <div className="status-grid">
                {Object.entries(statusCounts).map(([status, count]) => (
                <button
                key={status}
                onClick={() => setFilter(status as typeof filter)}
                className={`status-button ${filter === status ? 'active' : ''}`}
                >
                <div className="status-count">{count}</div>
                <div className="status-label">{status}</div>
                </button>
                ))}
                </div>
              </div>
               


              {/* Status Filters - Mobile */}
              {showFilters && (
                <div className="md:hidden grid grid-cols-2 gap-2">
                  {Object.entries(statusCounts).map(([status, count]) => (
                    <button
                      key={status}
                      onClick={() => {
                        setFilter(status as typeof filter);
                        setShowFilters(false);
                      }}
                      className={`
                        p-3 rounded-lg text-center transition 
                        ${filter === status 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}
                      `}
                    >
                      <div className="text-lg font-bold">{count}</div>
                      <div className="text-xs uppercase">{status}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Current Filter Indicator - Mobile */}
            <div className="md:hidden mb-4 text-gray-400">
              Showing: <span className="text-white font-semibold uppercase">{filter}</span>
            </div>

            {/* Global Toggle Switch */}
            <div className="mb-6 bg-gray-800 shadow-lg rounded-lg p-4 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-white">Automatic Processing</span>
                <button
                  onClick={handleToggle}
                  className={`flex items-center px-3 py-1 rounded-full transition-colors duration-200 focus:outline-none ${
                    isEnabled ? 'bg-green-600' : 'bg-gray-600'
                  }`}
                >
                  <div
                    className={`relative w-6 h-6 rounded-full transition-transform duration-200 transform ${
                      isEnabled ? 'translate-x-3 bg-primary' : '-translate-x-3 bg-mute'
                    }`}
                  />
                  <span className="ml-2 text-sm text-white">
                    {isEnabled ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>
            </div>

            {/* Withdrawal Requests List */}
            <div className="space-y-4">
              {filteredRequests.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  No withdrawal requests found
                </div>
              ) : (
                filteredRequests.map(request => (
                  <WithdrawalRequestCard 
                    key={request.id} 
                    request={request}
                    onUpdateStatus={updateRequestStatus}
                  />
                ))
              )}
            </div>

            <WalletList />
          </>
        )}
      </div>
    </div>
  );
};

export default WithdrawalsPage;


