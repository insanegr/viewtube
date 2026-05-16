import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Upload, Menu, Play, User, ListVideo, Shield, Sun, Moon, Monitor, Settings, ChevronRight, Globe, Check, ArrowLeft, LogOut, Bell, ThumbsUp, MessageSquare, UserPlus } from 'lucide-react';
import useStore, { Theme } from '../store/useStore';
import Avatar from './Avatar';
import { useLanguage } from '../i18n/LanguageContext';
import { Language } from '../i18n/translations';
import { useTheme } from '../theme/ThemeContext';

interface HeaderProps {
  onToggleSidebar: () => void;
}

const languages: { code: Language; name: string; flag: string }[] = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'el', name: 'Ελληνικά', flag: '🇬🇷' },
];

const themeOptions: { value: Theme; icon: typeof Sun; labelKey: 'lightMode' | 'darkMode' | 'autoMode' }[] = [
  { value: 'light', icon: Sun, labelKey: 'lightMode' },
  { value: 'dark', icon: Moon, labelKey: 'darkMode' },
  { value: 'auto', icon: Monitor, labelKey: 'autoMode' },
];

type MenuView = 'main' | 'theme' | 'language';

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const notifications = useStore((s) => s.notifications);
  const markNotificationRead = useStore((s) => s.markNotificationRead);
  const markAllNotificationsRead = useStore((s) => s.markAllNotificationsRead);
  const { t } = useLanguage();
  const navigate = useNavigate();

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'comment': return <MessageSquare size={16} className="text-blue-500" />;
      case 'reply': return <MessageSquare size={16} className="text-green-500" />;
      case 'subscribe': return <UserPlus size={16} className="text-red-500" />;
      case 'like': return <ThumbsUp size={16} className="text-blue-500" />;
      default: return <Bell size={16} />;
    }
  };

  const getMessage = (n: typeof notifications[0]) => {
    switch (n.type) {
      case 'comment': return <><strong className="font-medium">{n.fromChannelName}</strong> {t('notifComment')} <strong className="font-medium">{n.videoTitle}</strong></>;
      case 'reply': return <><strong className="font-medium">{n.fromChannelName}</strong> {t('notifReply')} <strong className="font-medium">{n.videoTitle}</strong></>;
      case 'subscribe': return <><strong className="font-medium">{n.fromChannelName}</strong> {t('notifSubscribe')}</>;
      case 'like': return <><strong className="font-medium">{n.fromChannelName}</strong> {t('notifLike')} <strong className="font-medium">{n.videoTitle}</strong></>;
      default: return null;
    }
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-full relative text-gray-700 dark:text-dark-text-secondary">
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-80 sm:w-96 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl shadow-xl z-50 overflow-hidden max-h-[70vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-dark-border flex-shrink-0">
              <h3 className="font-semibold text-sm">{t('notificationsTitle')}</h3>
              {unreadCount > 0 && (
                <button onClick={markAllNotificationsRead} className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">{t('markAllRead')}</button>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-12 text-center text-gray-500 dark:text-dark-text-muted">
                  <Bell size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">{t('noNotifications')}</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      markNotificationRead(n.id);
                      setOpen(false);
                      if (n.videoId) navigate(`/watch/${n.videoId}`);
                      else if (n.type === 'subscribe') navigate(`/channel/${n.fromChannelId}`);
                    }}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-dark-hover transition text-sm ${
                      !n.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                    }`}
                  >
                    <div className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-full bg-gray-100 dark:bg-dark-elevated flex items-center justify-center">
                      {getIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] leading-snug dark:text-dark-text line-clamp-2">{getMessage(n)}</p>
                      {n.commentText && <p className="text-xs text-gray-500 dark:text-dark-text-muted mt-0.5 line-clamp-1">"{n.commentText}"</p>}
                      <p className="text-[11px] text-gray-400 dark:text-dark-text-muted mt-1">{n.date}</p>
                    </div>
                    {!n.read && <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1.5" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function Header({ onToggleSidebar }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [menuView, setMenuView] = useState<MenuView>('main');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.currentUser);
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme, effectiveTheme } = useTheme();

  const isLoggedIn = currentUser.id !== '';
  const currentLang = languages.find((l) => l.code === language) || languages[0];
  const ThemeIcon = effectiveTheme === 'dark' ? Moon : Sun;
  const currentTheme = themeOptions.find((o) => o.value === theme) || themeOptions[0];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setMobileSearchOpen(false);
    }
  };

  const closeMenu = () => { setShowUserMenu(false); setMenuView('main'); };

  // Mobile search overlay
  if (mobileSearchOpen) {
    return (
      <header className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-dark-surface border-b border-gray-200 dark:border-dark-border h-14 flex items-center px-3 gap-2">
        <button onClick={() => setMobileSearchOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-full">
          <ArrowLeft size={20} />
        </button>
        <form onSubmit={handleSearch} className="flex-1 flex">
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('search')} autoFocus
            className="flex-1 border border-gray-300 dark:border-dark-border-light dark:bg-dark-elevated dark:text-dark-text rounded-l-full px-4 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
          <button type="submit" className="px-4 bg-gray-100 dark:bg-dark-elevated border border-l-0 border-gray-300 dark:border-dark-border-light rounded-r-full hover:bg-gray-200 dark:hover:bg-dark-hover">
            <Search size={18} />
          </button>
        </form>
      </header>
    );
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-dark-surface border-b border-gray-200 dark:border-dark-border h-14 flex items-center px-2 sm:px-4 gap-2 sm:gap-4">
      <button onClick={onToggleSidebar} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-full text-gray-700 dark:text-dark-text flex-shrink-0">
        <Menu size={20} />
      </button>

      {/* Logo */}
      <Link to="/" className="flex items-center gap-1 flex-shrink-0">
        <div className="bg-red-600 text-white rounded-lg p-1">
          <Play size={16} fill="white" />
        </div>
        <span className="text-lg font-bold hidden sm:inline dark:text-white">ViewTube</span>
      </Link>

      {/* Desktop search bar */}
      <form onSubmit={handleSearch} className="flex-1 max-w-2xl mx-auto hidden sm:flex">
        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('search')}
          className="flex-1 border border-gray-300 dark:border-dark-border-light dark:bg-dark-elevated dark:text-dark-text rounded-l-full px-4 py-1.5 text-sm focus:outline-none focus:border-blue-500 placeholder:text-gray-400 dark:placeholder:text-dark-text-muted" />
        <button type="submit" className="px-5 bg-gray-100 dark:bg-dark-elevated border border-l-0 border-gray-300 dark:border-dark-border-light rounded-r-full hover:bg-gray-200 dark:hover:bg-dark-hover text-gray-700 dark:text-dark-text">
          <Search size={18} />
        </button>
      </form>

      <div className="flex items-center gap-1 ml-auto">
        {/* Mobile search icon */}
        <button onClick={() => setMobileSearchOpen(true)} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-full sm:hidden">
          <Search size={20} />
        </button>

        {/* Logged-in only: Upload + Notifications */}
        {isLoggedIn && (
          <>
            <Link to="/upload" className="p-2 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-full text-gray-700 dark:text-dark-text-secondary hidden sm:flex" title={t('upload')}>
              <Upload size={20} />
            </Link>
            <NotificationBell />
          </>
        )}

        {/* Sign In button for visitors */}
        {!isLoggedIn && (
          <Link to="/login" className="flex items-center gap-2 px-4 py-1.5 border border-gray-300 dark:border-dark-border-light text-blue-600 dark:text-blue-400 rounded-full text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20">
            <User size={16} /> {t('signIn')}
          </Link>
        )}

        {/* Avatar + unified menu — logged in only */}
        {isLoggedIn && <div className="relative">
          <button onClick={() => { setShowUserMenu(!showUserMenu); setMenuView('main'); }} className="p-0.5 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-full">
            <Avatar name={currentUser.name} src={currentUser.avatar} size="sm" />
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={closeMenu} />
              <div className="absolute right-0 top-full mt-1 w-72 sm:w-80 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl shadow-xl z-50 overflow-hidden">

                {/* ─── Main menu ─── */}
                {menuView === 'main' && (
                  <div>
                    {/* User info */}
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-dark-border flex items-center gap-3">
                      <Avatar name={currentUser.name} src={currentUser.avatar} size="md" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{currentUser.name}</p>
                        <p className="text-xs text-gray-500 dark:text-dark-text-muted truncate">{currentUser.email}</p>
                      </div>
                    </div>

                    {/* Links */}
                    <div className="py-1 border-b border-gray-100 dark:border-dark-border">
                      <Link to="/profile" className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-dark-hover" onClick={closeMenu}>
                        <User size={18} className="text-gray-500 dark:text-dark-text-muted" /> {t('myProfile')}
                      </Link>
                      <Link to="/profile?tab=playlists" className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-dark-hover" onClick={closeMenu}>
                        <ListVideo size={18} className="text-gray-500 dark:text-dark-text-muted" /> {t('myPlaylists')}
                      </Link>
                      {/* Mobile-only: Upload */}
                      <Link to="/upload" className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-dark-hover sm:hidden" onClick={closeMenu}>
                        <Upload size={18} className="text-gray-500 dark:text-dark-text-muted" /> {t('upload')}
                      </Link>
                      <Link to="/settings" className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-dark-hover" onClick={closeMenu}>
                        <Settings size={18} className="text-gray-500 dark:text-dark-text-muted" /> {t('settings')}
                      </Link>
                    </div>

                    {/* Theme & Language sub-menus */}
                    <div className="py-1 border-b border-gray-100 dark:border-dark-border">
                      <button onClick={() => setMenuView('theme')} className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-dark-hover">
                        <span className="flex items-center gap-3">
                          <ThemeIcon size={18} className="text-gray-500 dark:text-dark-text-muted" />
                          {t('theme')}: {t(currentTheme.labelKey)}
                        </span>
                        <ChevronRight size={16} className="text-gray-400" />
                      </button>
                      <button onClick={() => setMenuView('language')} className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-dark-hover">
                        <span className="flex items-center gap-3">
                          <Globe size={18} className="text-gray-500 dark:text-dark-text-muted" />
                          {t('language')}: {currentLang.name}
                        </span>
                        <ChevronRight size={16} className="text-gray-400" />
                      </button>
                    </div>

                    {/* Admin */}
                    {currentUser.role === 'admin' && (
                      <div className="py-1 border-b border-gray-100 dark:border-dark-border">
                        <Link to="/admin" className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-dark-hover text-red-600 dark:text-red-400" onClick={closeMenu}>
                          <Shield size={18} /> {t('admin')}
                        </Link>
                      </div>
                    )}

                    {/* Sign out */}
                    <div className="py-1">
                      <button
                        onClick={async () => {
                          try {
                            const { api, clearTokens } = await import('../api/client');
                            const refreshToken = localStorage.getItem('viewtube-refresh-token');
                            await api.logout(refreshToken || undefined).catch(() => {});
                            clearTokens();
                          } catch {
                            localStorage.removeItem('viewtube-token');
                            localStorage.removeItem('viewtube-refresh-token');
                          }
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
                          closeMenu();
                          navigate('/');
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-dark-hover text-gray-700 dark:text-dark-text-secondary"
                      >
                        <LogOut size={18} className="text-gray-500 dark:text-dark-text-muted" />
                        {t('signOut')}
                      </button>
                    </div>
                  </div>
                )}

                {/* ─── Theme sub-menu ─── */}
                {menuView === 'theme' && (
                  <div>
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-dark-border">
                      <button onClick={() => setMenuView('main')} className="p-1 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-full"><ArrowLeft size={18} /></button>
                      <span className="font-medium text-sm">{t('theme')}</span>
                    </div>
                    <div className="py-1">
                      {themeOptions.map((opt) => (
                        <button key={opt.value} onClick={() => { setTheme(opt.value); setMenuView('main'); }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-dark-hover ${theme === opt.value ? 'font-medium' : ''}`}>
                          <opt.icon size={18} className="text-gray-500 dark:text-dark-text-muted" />
                          <span className="flex-1 text-left">{t(opt.labelKey)}</span>
                          {theme === opt.value && <Check size={16} className="text-blue-600 dark:text-blue-400" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ─── Language sub-menu ─── */}
                {menuView === 'language' && (
                  <div>
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-dark-border">
                      <button onClick={() => setMenuView('main')} className="p-1 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-full"><ArrowLeft size={18} /></button>
                      <span className="font-medium text-sm">{t('language')}</span>
                    </div>
                    <div className="py-1">
                      {languages.map((lang) => (
                        <button key={lang.code} onClick={() => { setLanguage(lang.code); setMenuView('main'); }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-dark-hover ${language === lang.code ? 'font-medium' : ''}`}>
                          <span className="text-lg">{lang.flag}</span>
                          <span className="flex-1 text-left">{lang.name}</span>
                          {language === lang.code && <Check size={16} className="text-blue-600 dark:text-blue-400" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>}
      </div>
    </header>
  );
}
