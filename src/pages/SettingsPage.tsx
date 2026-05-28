import { useState } from 'react';
import { Settings, User, Lock, Bell, AlertTriangle } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import { useLanguage } from '../i18n/LanguageContext';
import Avatar from '../components/Avatar';
import { useToast } from '../components/Toast';

const COUNTRIES = ['US', 'UK', 'GR', 'DE', 'FR', 'ES', 'IT', 'JP', 'KR', 'BR', 'CA', 'AU', 'IN', 'Other'];

export default function SettingsPage() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.currentUser);
  const updateProfile = useStore((s) => s.updateProfile);

  const [editUsername, setEditUsername] = useState(currentUser.username || '');
  const [email, setEmail] = useState(currentUser.email);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [displayName, setDisplayName] = useState(currentUser.name);
  const [description, setDescription] = useState(currentUser.description);
  const [notifications, setNotifications] = useState(currentUser.notificationsEnabled);
  const [siteNotifications, setSiteNotifications] = useState(currentUser.siteNotificationsEnabled !== false);
  const [bellEnabled, setBellEnabled] = useState(currentUser.bellEnabled !== false);
  const [audioChimeEnabled, setAudioChimeEnabled] = useState(currentUser.audioChimeEnabled !== false);
  const [country, setCountry] = useState(currentUser.country);
  const forcePassword = currentUser.mustChangePassword || searchParams.get('forcePassword') === '1';
  const [activeSection, setActiveSection] = useState(forcePassword ? 'password' : 'account');
  const { showToast } = useToast();
 
  const handleSaveAccount = async () => {
    const cleanUsername = editUsername.trim().toLowerCase();
    if (currentUser.id === 'ch-admin') {
      if (cleanUsername.length < 3) {
        showToast('Username must be at least 3 characters long', 'error');
        return;
      }
      if (!/^[a-z0-9_-]+$/.test(cleanUsername)) {
        showToast('Username can only contain alphanumeric characters, hyphens (-) or underscores (_)', 'error');
        return;
      }
    }

    try {
      const { api } = await import('../api/client');
      const fd = new FormData();
      if (currentUser.id === 'ch-admin') {
        fd.append('username', cleanUsername);
      }
      fd.append('email', email.trim());
      fd.append('country', country);
      fd.append('notificationsEnabled', String(notifications));
      fd.append('siteNotificationsEnabled', String(siteNotifications));
      fd.append('bellEnabled', String(siteNotifications ? bellEnabled : false));
      fd.append('audioChimeEnabled', String(siteNotifications ? audioChimeEnabled : false));

      const res = await api.updateProfile(fd);
      updateProfile({ 
        username: res.username || (currentUser.id === 'ch-admin' ? cleanUsername : currentUser.username),
        email: email.trim(), 
        notificationsEnabled: notifications, 
        country, 
        siteNotificationsEnabled: siteNotifications,
        bellEnabled: siteNotifications ? bellEnabled : false, 
        audioChimeEnabled: siteNotifications ? audioChimeEnabled : false 
      } as any);
      showToast(t('settingsSaved'), 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update account settings', 'error');
    }
  };

  const handleSaveProfile = async () => {
    const cleanName = displayName.trim();
    if (!cleanName) {
      showToast('Profile name cannot be empty', 'error');
      return;
    }
    try {
      const { api } = await import('../api/client');
      const fd = new FormData();
      fd.append('name', cleanName);
      fd.append('description', description.trim() || '');
      const res = await api.updateProfile(fd);
      updateProfile({ name: res.name || cleanName, description: res.description || description.trim() });
      showToast(t('settingsSaved'), 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update profile settings', 'error');
    }
  };

  const handleChangePassword = () => {
    if (newPassword !== confirmPw) { showToast(t('passwordMismatch'), 'error'); return; }
    if (!newPassword.trim()) return;
    updateProfile({ password: newPassword, mustChangePassword: false } as any);
    import('../api/client').then(({ api }) => {
      const fd = new FormData();
      fd.append('password', newPassword);
      return api.updateProfile(fd).catch(() => {});
    });
    setCurrentPassword(''); setNewPassword(''); setConfirmPw('');
    setSearchParams({});
    showToast(t('passwordChanged'), 'success');
  };

  const handleDeleteAccount = async () => {
    if (currentUser.id === 'ch-admin') {
      showToast('Main server admin account cannot be deleted', 'error');
      return;
    }

    if (!window.confirm("Are you sure you want to delete your account? This action is permanent and cannot be undone.")) {
      return;
    }

    try {
      const { api, clearTokens } = await import('../api/client');
      await api.deleteProfile();
      clearTokens();
      
      // Reset local auth-related state immediately
      useStore.setState({
        currentUser: { id: '', name: '', username: '', email: '', password: '', avatar: '', bannerImage: '', description: '', subscriberCount: 0, subscribers: [], role: 'user', notificationsEnabled: false, mustChangePassword: false, country: 'US' },
        subscribedChannels: [],
        likedVideos: [],
        dislikedVideos: [],
        playlists: [],
        notifications: [],
        queue: [],
        watchHistory: [],
      });
      
      showToast('Account deleted successfully', 'success');
      navigate('/');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete account', 'error');
    }
  };

  const inputCls = "w-full border border-gray-300 dark:border-dark-border-light dark:bg-dark-input dark:text-dark-text dark:placeholder:text-dark-text-muted rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  const sections = [
    { id: 'account', label: t('accountSettings'), icon: User },
    { id: 'profile', label: t('profileSettings'), icon: Settings },
    { id: 'password', label: t('changePassword'), icon: Lock },
    { id: 'notifications', label: t('notifications'), icon: Bell },
    { id: 'danger', label: t('dangerZone'), icon: AlertTriangle },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Settings size={28} className="text-gray-700 dark:text-dark-text-secondary" />
        <h1 className="text-2xl font-bold">{t('settings')}</h1>
      </div>

      <div className="flex gap-6">
        {/* Settings Sidebar */}
        <div className="w-56 flex-shrink-0 hidden md:block">
          <nav className="space-y-1 sticky top-20">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => { if (!forcePassword || s.id === 'password') setActiveSection(s.id); }}
                disabled={forcePassword && s.id !== 'password'}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition ${
                  activeSection === s.id
                    ? 'bg-gray-100 dark:bg-dark-card font-medium text-gray-900 dark:text-white'
                    : 'text-gray-600 dark:text-dark-text-secondary hover:bg-gray-50 dark:hover:bg-dark-hover'
                } ${s.id === 'danger' ? 'text-red-600 dark:text-red-400' : ''} ${forcePassword && s.id !== 'password' ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <s.icon size={18} />
                {s.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Settings Content */}
        <div className="flex-1 space-y-6">
          {/* Mobile section tabs */}
          <div className="md:hidden flex gap-2 overflow-x-auto pb-2">
            {sections.map((s) => (
              <button key={s.id} onClick={() => { if (!forcePassword || s.id === 'password') setActiveSection(s.id); }} disabled={forcePassword && s.id !== 'password'}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${activeSection === s.id ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-dark-card text-gray-700 dark:text-dark-text-secondary'} ${forcePassword && s.id !== 'password' ? 'opacity-40 cursor-not-allowed' : ''}`}>
                {s.label}
              </button>
            ))}
          </div>

          {/* Account Settings */}
          {activeSection === 'account' && (
            <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">{t('accountSettings')}</h2>
              {forcePassword && (
                <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-700 dark:text-yellow-400">
                  You logged in with a temporary password. Please change your password before continuing.
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-dark-text-secondary">Username</label>
                  <input 
                    type="text" 
                    value={currentUser.id === 'ch-admin' ? editUsername : currentUser.username} 
                    onChange={(e) => {
                      if (currentUser.id === 'ch-admin') {
                        setEditUsername(e.target.value);
                      }
                    }}
                    disabled={currentUser.id !== 'ch-admin'}
                    className={inputCls + (currentUser.id === 'ch-admin' ? "" : " opacity-60 cursor-not-allowed bg-gray-50 dark:bg-dark-hover")} 
                  />
                  {currentUser.id === 'ch-admin' ? (
                    <p className="text-[10px] text-green-600 dark:text-green-400 mt-1 font-medium">As the MAIN ADMIN, you can change your username for security reasons.</p>
                  ) : (
                    <p className="text-[10px] text-gray-400 mt-1">Usernames cannot be changed after registration.</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-dark-text-secondary">{t('emailAddress')}</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-dark-text-secondary">{t('country')}</label>
                  <select value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls}>
                    {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="pt-2">
                  <button onClick={handleSaveAccount} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">{t('saveChanges')}</button>
                </div>
              </div>
            </div>
          )}

          {/* Profile Settings */}
          {activeSection === 'profile' && (
            <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">{t('profileSettings')}</h2>
              <div className="space-y-4">
                <div className="flex items-center gap-4 mb-2">
                  <Avatar name={currentUser.name} src={currentUser.avatar} size="lg" />
                  <div>
                    <p className="font-medium">{currentUser.name}</p>
                    <p className="text-sm text-gray-500 dark:text-dark-text-muted">{currentUser.email}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-dark-text-secondary">{t('title')}</label>
                  <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-dark-text-secondary">{t('description')}</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputCls + " resize-none"} />
                </div>
                <div className="pt-2">
                  <button onClick={handleSaveProfile} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">{t('saveChanges')}</button>
                </div>
              </div>
            </div>
          )}

          {/* Change Password */}
          {activeSection === 'password' && (
            <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Lock size={20} />{t('changePassword')}</h2>
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-dark-text-secondary">{t('currentPassword')}</label>
                  <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-dark-text-secondary">{t('newPassword')}</label>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-dark-text-secondary">{t('confirmPassword')}</label>
                  <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className={inputCls} />
                </div>
                <div className="pt-2">
                  <button onClick={handleChangePassword} disabled={!newPassword.trim() || !currentPassword.trim()} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">{t('changePassword')}</button>
                </div>
              </div>
            </div>
          )}

          {/* Notifications */}
          {activeSection === 'notifications' && (
            <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Bell size={20} />{t('notifications')}</h2>
              <div className="space-y-6">
                
                {/* Email Notifications */}
                <div>
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover transition duration-200">
                    <input type="checkbox" checked={notifications} onChange={(e) => setNotifications(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-dark-text">{t('enableNotifications')}</p>
                      <p className="text-xs text-gray-500 dark:text-dark-text-muted">Receive email updates about new subscribers, comments, and likes</p>
                    </div>
                  </label>
                </div>

                <div className="border-t border-gray-100 dark:border-dark-border pt-4">
                  {/* Site Notifications */}
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover transition duration-200">
                    <input type="checkbox" checked={siteNotifications} onChange={(e) => setSiteNotifications(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-dark-text">Site Notifications</p>
                      <p className="text-xs text-gray-500 dark:text-dark-text-muted">Enable on-site notification hub alerts and activity bell</p>
                    </div>
                  </label>

                  {/* Subs to Site Notifications */}
                  <div className="pl-8 mt-3 space-y-3 border-l-2 border-gray-100 dark:border-dark-border ml-5">
                    <label className={`flex items-start gap-3 cursor-pointer p-2.5 rounded-lg transition duration-200 ${!siteNotifications ? 'opacity-40 cursor-not-allowed select-none' : 'hover:bg-gray-50 dark:hover:bg-dark-hover'}`}>
                      <input 
                        type="checkbox" 
                        disabled={!siteNotifications}
                        checked={siteNotifications && bellEnabled} 
                        onChange={(e) => setBellEnabled(e.target.checked)} 
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5 disabled:cursor-not-allowed" 
                      />
                      <div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-dark-text">Enable Notification Bell</p>
                        <p className="text-xs text-gray-500 dark:text-dark-text-muted">Display the notification bell icon in the top header on the site</p>
                      </div>
                    </label>

                    <label className={`flex items-start gap-3 cursor-pointer p-2.5 rounded-lg transition duration-200 ${!siteNotifications ? 'opacity-40 cursor-not-allowed select-none' : 'hover:bg-gray-50 dark:hover:bg-dark-hover'}`}>
                      <input 
                        type="checkbox" 
                        disabled={!siteNotifications}
                        checked={siteNotifications && audioChimeEnabled} 
                        onChange={(e) => setAudioChimeEnabled(e.target.checked)} 
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5 disabled:cursor-not-allowed" 
                      />
                      <div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-dark-text">Notification Audio Chime</p>
                        <p className="text-xs text-gray-500 dark:text-dark-text-muted">Play a pleasant alert audio sound whenever a new notification is received</p>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-dark-border">
                  <button onClick={handleSaveAccount} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition">{t('saveChanges')}</button>
                </div>
              </div>
            </div>
          )}

          {/* Danger Zone */}
          {activeSection === 'danger' && (
            <div className="bg-white dark:bg-dark-card border border-red-200 dark:border-red-900/50 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-2 text-red-600 dark:text-red-400 flex items-center gap-2"><AlertTriangle size={20} />{t('dangerZone')}</h2>
              {currentUser.id === 'ch-admin' ? (
                <div className="text-sm text-red-600 dark:text-red-400 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg font-medium border border-red-200 dark:border-red-900/30">
                  The main server admin account is permanent and cannot be deleted.
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-600 dark:text-dark-text-muted mb-4">{t('deleteAccountWarning')}</p>
                  <button onClick={handleDeleteAccount} className="px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">{t('deleteAccount')}</button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
