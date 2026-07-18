// frontend/src/pages/Dashboard.jsx
// MOBILE-RESPONSIVE VERSION - Optimized for all screen sizes

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getMyOvertimeBalance, getMyOvertimeRequests, getMyLeaveBalance } from '../api/client';
import AnnouncementBoard from '../components/AnnouncementBoard';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Fetch overtime balance with caching
  const { data: overtimeBalance, isLoading: balanceLoading } = useQuery({
    queryKey: ['overtimeBalance'],
    queryFn: getMyOvertimeBalance,
    staleTime: 3 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  });

  // Fetch leave balance with caching
  const { data: leaveBalance, isLoading: leaveBalanceLoading } = useQuery({
    queryKey: ['leaveBalance'],
    queryFn: getMyLeaveBalance,
    staleTime: 3 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  });

  // Fetch pending requests count with caching
  const { data: pendingRequests, isLoading: pendingLoading } = useQuery({
    queryKey: ['overtimeRequests', 'pending'],
    queryFn: () => getMyOvertimeRequests({ status: 'PENDING' }),
    staleTime: 2 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    select: (data) => data.length,
  });

  const loading = balanceLoading || pendingLoading || leaveBalanceLoading;

  // Sub-components with "Bold/Character" styling
  const StatCard = ({ label, value, unit, color, icon, footer, onClick }) => {
    const textColor = {
      blue: 'text-blue-600',
      green: 'text-green-600',
      orange: 'text-orange-600',
      purple: 'text-purple-600',
    }[color];

    return (
      <div 
        onClick={onClick}
        className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col h-full cursor-pointer hover:shadow-md transition-all active:scale-[0.97]"
      >
        {/* Top Section: Title and Icon remain at the top */}
        <div className="flex justify-between items-start gap-2 mb-4">
          <span className="text-sm sm:text-base font-bold text-gray-700 leading-tight">
            {label}
          </span>
          <div className={`flex-shrink-0 ${textColor}`}>
            {icon}
          </div>
        </div>

        {/* Lower Section: Pushed to the bottom of the card */}
        <div className="mt-auto">
          <div className="flex items-baseline gap-1">
            <span className={`text-2xl sm:text-3xl font-black ${textColor} font-bold tracking-tight`}>
              {value}
            </span>
            <span className="text-sm sm:text-base font-bold text-gray-400 lowercase">
              {unit}
            </span>
          </div>
          
          {/* Footer Text (e.g., Annual/TOIL) */}
          <p className="text-[10px] sm:text-xs text-gray-400 mt-1 font-medium leading-tight min-h-[1.25rem]">
            {footer}
          </p>

          {/* Action Link - Integrated into the bottom block */}
          <div className={`mt-2 pt-3 border-t border-gray-50 text-[11px] sm:text-xs font-bold flex items-center ${textColor}`}>
            Klik untuk melihat <span className="ml-1">→</span>
          </div>
        </div>
      </div>
    );
  };

  // Simple Icon Components (SVG wrappers)
  const CalendarIcon = () => (
    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );

  const ClockIcon = () => (
    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  const BellIcon = () => (
    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );

  const CreditCardIcon = () => (
    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z" />
    </svg>
  );

  const InfoRow = ({ label, value, isHighlight }) => (
    <div className="group">
      <dt className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 group-hover:text-blue-500 transition-colors">{label}</dt>
      <dd className={`text-base font-semibold ${isHighlight ? 'text-blue-600' : 'text-gray-900'} break-all`}>
        {value || '—'}
      </dd>
    </div>
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-1">
      {/* Welcome Header */}
      <header className="py-2">
        {/* <p className="text-[11px] font-bold text-blue-600 uppercase tracking-widest mb-1">
          {t('dashboard.overview')}
        </p> */}
        <h1 className="text-2xl sm:text-4xl font-black text-gray-900 tracking-tight">
          {t('dashboard.welcomeBack', { name: user?.name?.split(' ')[0] })} 👋
        </h1>
      </header>

      <AnnouncementBoard />

      {/* 2x2 Grid on Mobile, 4 columns on Desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard 
          label={t('dashboard.leaveBalance')}
          value={loading ? '...' : `${(leaveBalance?.annualRemaining || 0) + (leaveBalance?.toilBalance || 0)}`}
          unit={t('dashboard.days')}
          color="blue"
          icon={<CalendarIcon />}
          footer={`Annual: ${leaveBalance?.annualRemaining || 0} | TOIL: ${leaveBalance?.toilBalance || 0}`}
          onClick={() => navigate('/leave/history')}
        />
        <StatCard 
          label={t('dashboard.overtimeBalance')}
          value={loading ? '...' : overtimeBalance?.currentBalance.toFixed(1)}
          unit={t('dashboard.hrs')}
          color="green"
          icon={<ClockIcon />}
          footer={t('dashboard.hoursApproved')}
          onClick={() => navigate('/overtime/history')}
        />
        <StatCard 
          label={t('dashboard.pendingRequests')}
          value={loading ? '...' : pendingRequests || 0}
          // unit={t('dashboard.items')}
          color="orange"
          icon={<BellIcon />}
          footer={t('dashboard.awaitingApproval')}
          onClick={() => navigate('/overtime/history')}
        />
        <StatCard 
          label={t('dashboard.payslips')}
          value="0"
          // unit={t('dashboard.docs')}
          color="purple"
          icon={<CreditCardIcon />}
          footer={t('dashboard.availableToDownload')}
          onClick={() => navigate('/payslips/my-payslips')}
        />
      </div>

      {/* Profile Section */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            {t('dashboard.profileInformation')}
          </h2>
        </div>
        <div className="p-6">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <InfoRow label={t('dashboard.username')} value={user?.username} />
            <InfoRow label={t('dashboard.email')} value={user?.email} />
            {user?.supervisor && (
              <div className="sm:col-span-2 border-t border-gray-50">
                <InfoRow label={t('dashboard.supervisor')} value={user.supervisor.name} isHighlight />
              </div>
            )}
          </dl>
        </div>
      </section>
    </div>
  );
}