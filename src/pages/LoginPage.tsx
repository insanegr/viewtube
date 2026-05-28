import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Play, Eye, EyeOff, LogIn, UserPlus, KeyRound } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import useStore from '../store/useStore';
import { setTokens } from '../api/client';
import { useToast } from '../components/Toast';

export default function LoginPage() {
  useLanguage();
  const navigate = useNavigate();
  const location = useLocation() as any;
  const { showToast } = useToast();
  const [isRegister, setIsRegister] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryIdentifier, setRecoveryIdentifier] = useState('');
  const [recoveryNote, setRecoveryNote] = useState('');

  const [usernameStatus, setUsernameStatus] = useState<{ checked: boolean; available: boolean; loading: boolean; msg?: string }>({ checked: false, available: false, loading: false });
  const [emailStatus, setEmailStatus] = useState<{ checked: boolean; available: boolean; loading: boolean; msg?: string }>({ checked: false, available: false, loading: false });
  const [nameStatus, setNameStatus] = useState<{ checked: boolean; available: boolean; loading: boolean; msg?: string }>({ checked: false, available: false, loading: false });

  const handleNameChange = async (val: string) => {
    setName(val);
    if (!val.trim()) {
      setNameStatus({ checked: false, available: false, loading: false });
      return;
    }
    if (val.trim().length < 2) {
      setNameStatus({ checked: true, available: false, loading: false, msg: 'Must be at least 2 characters' });
      return;
    }
    setNameStatus({ checked: false, available: false, loading: true });
    try {
      const { api } = await import('../api/client');
      const res = await api.checkName(val);
      if (res.available !== undefined) {
        setNameStatus({
          checked: true,
          available: res.available,
          loading: false,
          msg: res.available ? 'Channel name is available!' : (res.error || 'Channel name is already taken')
        });
      } else {
        setNameStatus({ checked: true, available: false, loading: false, msg: res.error || 'Invalid channel name' });
      }
    } catch {
      setNameStatus({ checked: false, available: false, loading: false });
    }
  };

  const handleUsernameChange = async (val: string) => {
    setUsername(val);
    if (!val.trim()) {
      setUsernameStatus({ checked: false, available: false, loading: false });
      return;
    }
    setUsernameStatus({ checked: false, available: false, loading: true });
    try {
      const { api } = await import('../api/client');
      const res = await api.checkUsername(val);
      if (res.available !== undefined) {
        setUsernameStatus({
          checked: true,
          available: res.available,
          loading: false,
          msg: res.available ? 'Username is available!' : (res.error || 'Username is already taken')
        });
      } else {
        setUsernameStatus({ checked: true, available: false, loading: false, msg: res.error || 'Invalid username' });
      }
    } catch {
      setUsernameStatus({ checked: false, available: false, loading: false });
    }
  };

  const handleEmailChange = async (val: string) => {
    setEmail(val);
    if (!val.trim()) {
      setEmailStatus({ checked: false, available: false, loading: false });
      return;
    }
    if (!val.includes('@')) {
      setEmailStatus({ checked: true, available: false, loading: false, msg: 'Please enter a valid email address' });
      return;
    }
    setEmailStatus({ checked: false, available: false, loading: true });
    try {
      const { api } = await import('../api/client');
      const res = await api.checkEmail(val);
      if (res.available !== undefined) {
        setEmailStatus({
          checked: true,
          available: res.available,
          loading: false,
          msg: res.available ? 'Email is available!' : (res.error || 'Email already connected to active account')
        });
      } else {
        setEmailStatus({ checked: true, available: false, loading: false, msg: res.error || 'Invalid email' });
      }
    } catch {
      setEmailStatus({ checked: false, available: false, loading: false });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { api } = await import('../api/client');
      if (isRegister) {
        if (!name.trim()) { setError('Channel name is required'); setLoading(false); return; }
        if (!username.trim()) { setError('Username is required'); setLoading(false); return; }
        
        // Wait elements to finish loading if typing and immediate press submit
        if (usernameStatus.loading || emailStatus.loading || nameStatus.loading) {
          setError('Checking username, email, or channel name availability...');
          setLoading(false);
          return;
        }

        if (nameStatus.checked && !nameStatus.available) {
          setError(nameStatus.msg || 'Channel name is already taken');
          setLoading(false);
          return;
        }

        if (usernameStatus.checked && !usernameStatus.available) {
          setError(usernameStatus.msg || 'Username is already taken');
          setLoading(false);
          return;
        }

        if (emailStatus.checked && !emailStatus.available) {
          setError(emailStatus.msg || 'Email is already taken');
          setLoading(false);
          return;
        }

        const res = await api.register(name.trim(), username.trim(), email.trim(), password);
        setTokens(res.accessToken, res.refreshToken);
        useStore.setState({ currentUser: { ...useStore.getState().currentUser, ...res.user, subscribers: [], password: '' } });
        navigate('/');
      } else {
        const res = await api.login(identifier.trim(), password);
        setTokens(res.accessToken, res.refreshToken);
        useStore.setState({ currentUser: { ...useStore.getState().currentUser, ...res.user, subscribers: [], password: '' } });
        if (res.user.mustChangePassword) {
          showToast('Temporary password used. Please change your password now.', 'warning');
          navigate('/settings?forcePassword=1');
        } else {
          navigate((location.state as any)?.from?.pathname || '/');
        }
      }
    } catch (err: any) {
      if (err.message?.includes('fetch') || err.message?.includes('Failed')) {
        setError('Server unavailable');
      } else setError(err.message || 'Something went wrong');
    }
    setLoading(false);
  };

  const submitRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryIdentifier.trim()) return;
    setLoading(true);
    try {
      const { api } = await import('../api/client');
      await api.requestReset(recoveryIdentifier.trim(), recoveryNote.trim());
      showToast('Recovery request sent to admin', 'success');
      setShowRecovery(false);
      setRecoveryIdentifier('');
      setRecoveryNote('');
    } catch (err: any) {
      setError(err.message || 'Could not send request');
    }
    setLoading(false);
  };

  const inputCls = "w-full border border-gray-300 dark:border-dark-border-light dark:bg-dark-input dark:text-dark-text rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:placeholder:text-dark-text-muted";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="bg-red-600 text-white rounded-xl p-2"><Play size={28} fill="white" /></div>
          <span className="text-3xl font-bold dark:text-white">ViewTube</span>
        </div>

        <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-2xl p-8 shadow-sm">
          {!showRecovery ? (
            <>
              <h1 className="text-2xl font-bold mb-1 dark:text-dark-text">{isRegister ? 'Create account' : 'Sign in'}</h1>
              <p className="text-sm text-gray-500 dark:text-dark-text-muted mb-6">{isRegister ? 'Join ViewTube today' : 'Sign in with your email or username'}</p>

              {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">{error}</div>}

              <form onSubmit={handleSubmit} className="space-y-4">
                {isRegister && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1.5 dark:text-dark-text-secondary">Channel name</label>
                      <input type="text" value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="My Channel" className={inputCls} required />
                      {nameStatus.loading && <p className="text-xs text-gray-400 dark:text-dark-text-muted mt-1">Checking channel name availability...</p>}
                      {nameStatus.checked && !nameStatus.loading && (
                        <p className={`text-xs mt-1 ${nameStatus.available ? 'text-green-600 dark:text-green-400 font-medium' : 'text-red-500 dark:text-red-400 font-medium'}`}>
                          {nameStatus.available ? '✓ ' : '✗ '}{nameStatus.msg}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5 dark:text-dark-text-secondary">Username</label>
                      <input type="text" value={username} onChange={(e) => handleUsernameChange(e.target.value)} placeholder="my-channel" className={inputCls} required minLength={3} />
                      {usernameStatus.loading && <p className="text-xs text-gray-400 dark:text-dark-text-muted mt-1">Checking username availability...</p>}
                      {usernameStatus.checked && !usernameStatus.loading && (
                        <p className={`text-xs mt-1 ${usernameStatus.available ? 'text-green-600 dark:text-green-400 font-medium' : 'text-red-500 dark:text-red-400 font-medium'}`}>
                          {usernameStatus.available ? '✓ ' : '✗ '}{usernameStatus.msg}
                        </p>
                      )}
                    </div>
                  </>
                )}

                {!isRegister ? (
                  <div>
                    <label className="block text-sm font-medium mb-1.5 dark:text-dark-text-secondary">Email or Username</label>
                    <input type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="you@example.com or my-username" className={inputCls} required />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium mb-1.5 dark:text-dark-text-secondary">Email Address</label>
                    <input type="email" value={email} onChange={(e) => handleEmailChange(e.target.value)} placeholder="you@example.com" className={inputCls} required />
                    {emailStatus.loading && <p className="text-xs text-gray-400 dark:text-dark-text-muted mt-1">Checking email availability...</p>}
                    {emailStatus.checked && !emailStatus.loading && (
                      <p className={`text-xs mt-1 ${emailStatus.available ? 'text-green-600 dark:text-green-400 font-medium' : 'text-red-500 dark:text-red-400 font-medium'}`}>
                        {emailStatus.available ? '✓ ' : '✗ '}{emailStatus.msg}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1.5 dark:text-dark-text-secondary">Password</label>
                  <div className="relative">
                    <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={inputCls + ' pr-10'} required minLength={4} />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-text-secondary">
                      {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {!isRegister && (
                  <div className="text-right">
                    <button type="button" onClick={() => { setShowRecovery(true); setError(''); }} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                      Forgot password / email?
                    </button>
                  </div>
                )}

                <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : isRegister ? <><UserPlus size={18} /> Create account</> : <><LogIn size={18} /> Sign in</>}
                </button>
              </form>

              <div className="mt-6 text-center text-sm">
                <span className="text-gray-500 dark:text-dark-text-muted">{isRegister ? 'Already have an account?' : "Don't have an account?"}</span>{' '}
                <button onClick={() => { 
                  setIsRegister(!isRegister); 
                  setError(''); 
                  setUsernameStatus({ checked: false, available: false, loading: false });
                  setEmailStatus({ checked: false, available: false, loading: false });
                  setNameStatus({ checked: false, available: false, loading: false });
                  setUsername('');
                  setEmail('');
                  setPassword('');
                  setName('');
                }} className="text-blue-600 dark:text-blue-400 font-medium hover:underline">
                  {isRegister ? 'Sign in' : 'Create account'}
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold mb-1 dark:text-dark-text">Account recovery</h1>
              <p className="text-sm text-gray-500 dark:text-dark-text-muted mb-6">No email system yet — send a request to the admin and they can issue a temporary password.</p>
              <form onSubmit={submitRecovery} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5 dark:text-dark-text-secondary">Email or Username</label>
                  <input type="text" value={recoveryIdentifier} onChange={(e) => setRecoveryIdentifier(e.target.value)} placeholder="you@example.com or my-username" className={inputCls} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 dark:text-dark-text-secondary">Note (optional)</label>
                  <textarea value={recoveryNote} onChange={(e) => setRecoveryNote(e.target.value)} rows={3} placeholder="Any detail that helps the admin identify your account" className={inputCls + ' resize-none'} />
                </div>
                <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><KeyRound size={18} /> Send recovery request</>}
                </button>
                <button type="button" onClick={() => setShowRecovery(false)} className="w-full py-2.5 bg-gray-100 dark:bg-dark-elevated dark:text-dark-text-secondary rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-dark-hover">Back to sign in</button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
