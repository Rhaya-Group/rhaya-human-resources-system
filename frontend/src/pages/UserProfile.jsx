// frontend/src/pages/UserProfile.jsx
// MOBILE-RESPONSIVE VERSION - Responsive grid, cards, and forms

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import apiClient from '../api/client';
import { User, Briefcase, Gift, ShieldCheck, Eye, EyeOff, FileText } from 'lucide-react';
import DocumentsList from '../components/DocumentsList';
import MyPersonalDocuments from '../components/MyPersonalDocuments';
import EmergencyContacts from '../components/EmergencyContacts';
import { PERSONAL_TYPE_VALUES } from '../utils/documentTypes';

export default function UserProfile() {
  const { t } = useTranslation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    phone: '',
    address: ''
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    password: '',
    confirmPassword: ''
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/users/profile');
      setUser(response.data.data);
      setEditData({
        phone: response.data.data.phone || '',
        address: response.data.data.address || ''
      });
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      alert(t('profile.failedToLoadProfile'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      await apiClient.put('/users/profile', editData);
      alert(t('profile.profileUpdated'));
      setEditing(false);
      fetchProfile();
    } catch (error) {
      console.error('Update error:', error);
      alert(error.response?.data?.error || t('profile.failedToUpdate'));
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    if (passwordData.password !== passwordData.confirmPassword) {
      alert(t('profile.passwordsDoNotMatch'));
      return;
    }

    if (passwordData.password.length < 6) {
      alert(t('profile.passwordTooShort'));
      return;
    }

    try {
      await apiClient.put('/users/profile', {
        currentPassword: passwordData.currentPassword,
        password: passwordData.password
      });
      alert(t('profile.passwordChanged'));
      setChangingPassword(false);
      setPasswordData({
        currentPassword: '',
        password: '',
        confirmPassword: ''
      });
    } catch (error) {
      console.error('Password change error:', error);
      alert(error.response?.data?.error || t('profile.failedToChangePassword'));
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      'PKWTT': 'bg-green-100 text-green-800',
      'PKWT': 'bg-blue-100 text-blue-800',
      'INTERNSHIP': 'bg-purple-100 text-purple-800',
      'FREELANCE': 'bg-yellow-100 text-yellow-800',
      'PROBATION': 'bg-orange-100 text-orange-800',
      'INACTIVE': 'bg-gray-100 text-gray-800'
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-base sm:text-lg text-gray-600">{t('profile.loadingProfile')}</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-base sm:text-lg text-red-600">{t('profile.failedToLoad')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-1 pb-20">
      {/* 1. Header Section */}
      <header className="py-2">
        {/* <p className="text-[11px] font-bold text-blue-600 uppercase tracking-[0.2em] mb-1">
          {t('profile.account')}
        </p> */}
        <h1 className="text-2xl sm:text-4xl font-black text-gray-900 tracking-tight">
          {t('profile.myProfile')}
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">{t('profile.viewManage')}</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        
        {/* LEFT COLUMN: Profile & Quick Stats */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-8 text-center">
            <div className="relative inline-block mb-6">
              <div className="w-24 h-24 sm:w-32 sm:h-32 mx-auto bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-3xl sm:text-5xl font-black shadow-lg shadow-blue-100">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className={`absolute bottom-1 right-1 w-6 h-6 border-4 border-white rounded-full ${user.employeeStatus === 'INACTIVE' ? 'bg-gray-400' : 'bg-green-500'}`} />
            </div>
            
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight break-words">{user.name}</h2>
            <p className="text-sm font-bold text-gray-400 mt-1 tracking-tighter uppercase">{user.nip || t('profile.noNip')}</p>
            
            <div className="mt-8 grid grid-cols-2 gap-4 pt-8 border-t border-gray-50">
              <div className="text-left">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{t('profile.leaveBalance')}</p>
                <p className="text-lg font-black text-blue-600 leading-none">
                  {user.leaveBalance?.annualRemaining || 0} <span className="text-[10px] text-gray-400 uppercase">{t('profile.days')}</span>
                </p>
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{t('profile.overtimeBalance')}</p>
                <p className="text-lg font-black text-green-600 leading-none">
                  {user.overtimeBalance?.currentBalance?.toFixed(1) || 0} <span className="text-[10px] text-gray-400 uppercase">{t('profile.hours')}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Details Form & Security */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Personal Info Card */}
          <SectionCard title={t('profile.personalInformation')} icon={<User size={18} />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-8">
              <InfoField label={t('profile.fullName')} value={user.name} />
              <InfoField label={t('profile.email')} value={user.email} isBreakAll />
              <InfoField label={t('profile.gender')} value={user.gender || t('profile.notSpecified')} />
              <InfoField label={t('profile.dateOfBirth')} value={formatDate(user.dateOfBirth)} />
              
              <div className="sm:col-span-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{t('profile.phone')}</p>
                {editing ? (
                  <input
                    type="tel"
                    value={editData.phone}
                    onChange={(e) => setEditData({...editData, phone: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-sm font-bold text-gray-900">{user.phone || '-'}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{t('profile.address')}</p>
                {editing ? (
                  <textarea
                    value={editData.address}
                    onChange={(e) => setEditData({...editData, address: e.target.value})}
                    rows={3}
                    className="w-full px-4 py-2 bg-gray-50 border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-sm font-bold text-gray-900 leading-relaxed whitespace-pre-line">{user.address || '-'}</p>
                )}
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-50">
              {editing ? (
                <div className="flex gap-3">
                  <button onClick={handleUpdateProfile} className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-100">{t('profile.saveChanges')}</button>
                  <button onClick={() => setEditing(false)} className="flex-1 py-3 bg-gray-100 text-gray-500 rounded-xl text-xs font-black uppercase tracking-widest">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setEditing(true)} className="w-full sm:w-auto px-8 py-3 bg-gray-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all">
                  {t('profile.editProfile')}
                </button>
              )}
            </div>
          </SectionCard>

          {/* Employment Card */}
          <SectionCard title={t('profile.employmentInformation')} icon={<Briefcase size={18} />}>
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-x-4 gap-y-8">
              <InfoField label={t('profile.employeeId')} value={user.nip} />
              <InfoField label={t('profile.status')} value={user.employeeStatus} isHighlight />
              <InfoField label={t('profile.division')} value={user.division?.name} />
              <InfoField label={t('profile.role')} value={user.role?.name} />
              <InfoField label={t('profile.joinDate')} value={formatDate(user.joinDate)} />
              {user.supervisor && (
                <div className="col-span-2 pt-4 border-t border-gray-50">
                  <InfoField label={t('profile.supervisor')} value={`${user.supervisor.name} (${user.supervisor.email})`} />
                </div>
              )}
            </div>
          </SectionCard>

          {/* Benefits Card */}
          <SectionCard title={t('profile.benefitsInformation')} icon={<Gift size={18} />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-8">
              <InfoField label={t('profile.bpjsHealth')} value={user.bpjsHealth} />
              <InfoField label={t('profile.bpjsEmployment')} value={user.bpjsEmployment} />
              <div className="sm:col-span-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{t('profile.overtimeRate')}</p>
                <p className="text-xl font-black text-gray-900 tracking-tighter">
                  {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(user.overtimeRate)}
                  <span className="text-xs text-gray-400 ml-1 font-bold lowercase">/ 8 {t('profile.hours')}</span>
                </p>
              </div>
            </div>
          </SectionCard>

          {/* Emergency Contacts (self-editable) */}
          <EmergencyContacts userId={user.id} canEdit={true} />

          {/* My Contracts (read-only — HR managed) */}
          <SectionCard title="My Contracts" icon={<FileText size={18} />}>
            <DocumentsList
              userId={user.id}
              excludeTypes={['Payslip', ...PERSONAL_TYPE_VALUES]}
            />
          </SectionCard>

          {/* My Personal Documents (self-upload) */}
          <MyPersonalDocuments userId={user.id} />

          {/* Security Card */}
          <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden">
             <div className="px-6 py-4 border-b border-gray-50 flex justify-between items-center">
                <div className="flex items-center space-x-2 text-red-600">
                  <ShieldCheck size={18} />
                  <h3 className="text-xs font-black uppercase tracking-widest">{t('profile.security')}</h3>
                </div>
                {!changingPassword && (
                  <button onClick={() => setChangingPassword(true)} className="text-[10px] font-black uppercase text-red-600 hover:underline tracking-widest">
                    {t('profile.changePassword')}
                  </button>
                )}
             </div>
             
             <div className="p-6">
                {changingPassword ? (
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <PasswordField label={t('profile.currentPassword')} value={passwordData.currentPassword} show={showCurrentPassword} setShow={setShowCurrentPassword} onChange={(val) => setPasswordData({...passwordData, currentPassword: val})} />
                    <PasswordField label={t('profile.newPassword')} value={passwordData.password} show={showNewPassword} setShow={setShowNewPassword} onChange={(val) => setPasswordData({...passwordData, password: val})} />
                    <PasswordField label={t('profile.confirmNewPassword')} value={passwordData.confirmPassword} show={showConfirmPassword} setShow={setShowConfirmPassword} onChange={(val) => setPasswordData({...passwordData, confirmPassword: val})} />
                    <div className="flex gap-3 pt-4">
                      <button type="submit" className="flex-1 py-3 bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-red-100">{t('profile.updatePassword')}</button>
                      <button type="button" onClick={() => setChangingPassword(false)} className="flex-1 py-3 bg-gray-100 text-gray-500 rounded-xl text-xs font-black uppercase tracking-widest">Cancel</button>
                    </div>
                  </form>
                ) : (
                  <InfoField label={t('profile.lastPasswordChange')} value={user.lastPasswordChange ? formatDate(user.lastPasswordChange) : t('profile.never')} />
                )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// SHARED SUB-COMPONENTS
const SectionCard = ({ title, icon, children }) => (
  <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden">
    <div className="px-6 py-4 border-b border-gray-50 flex items-center space-x-2 text-gray-400">
      {icon}
      <h3 className="text-xs font-black uppercase tracking-widest">{title}</h3>
    </div>
    <div className="p-6">{children}</div>
  </div>
);

const InfoField = ({ label, value, isHighlight, isBreakAll }) => (
  <div>
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
    <p className={`text-sm font-bold ${isHighlight ? 'text-blue-600' : 'text-gray-900'} ${isBreakAll ? 'break-all' : 'break-words'}`}>
      {value || '—'}
    </p>
  </div>
);

const PasswordField = ({ label, value, show, setShow, onChange }) => (
  <div>
    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">{label}</label>
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2 bg-gray-50 border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 pr-10"
        required
      />
      <button type="button" onClick={() => setShow(!show)} className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600">
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  </div>
);