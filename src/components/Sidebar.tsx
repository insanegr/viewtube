import { useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Compass, PlaySquare, ThumbsUp, ListVideo, User, Plus, Minus, X, ChevronDown, ChevronUp, FolderOpen, History, BarChart3, ListEnd, Clock3, Menu } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import useStore from '../store/useStore';
import { socialLinks, siteName, copyrightYear } from '../config/site';
import { GithubIcon, DiscordIcon, YoutubeIcon, FacebookIcon, InstagramIcon, SteamIcon } from './SocialIcons';

interface SidebarProps {
  isOpen: boolean;
  onToggle?: () => void;
}

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const location = useLocation();
  const { t, language } = useLanguage();
  const currentUser = useStore((s) => s.currentUser);
  const isLoggedIn = currentUser.id !== '';
  const categories = useStore((s) => s.categories);
  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const aName = language === 'el' ? a.nameEl : a.name;
      const bName = language === 'el' ? b.nameEl : b.name;
      return aName.localeCompare(bName, language);
    });
  }, [categories, language]);
  const selectedCategories = useStore((s) => s.selectedCategories);
  const matchAllCategories = useStore((s) => s.matchAllCategories);
  const toggleCategoryFilter = useStore((s) => s.toggleCategoryFilter);
  const clearCategoryFilters = useStore((s) => s.clearCategoryFilters);
  const setMatchAllCategories = useStore((s) => s.setMatchAllCategories);
  const subscribedChannels = useStore((s) => s.subscribedChannels);
  const channels = useStore((s) => s.channels);
  const queue = useStore((s) => s.queue);
  const navigate = useNavigate();

  const [categoriesExpanded, setCategoriesExpanded] = useState(true);
  const [subscriptionsExpanded, setSubscriptionsExpanded] = useState(false);
  const [youExpanded, setYouExpanded] = useState(false);

  const socials = [
    { url: socialLinks.github, Icon: GithubIcon, label: 'GitHub' },
    { url: socialLinks.discord, Icon: DiscordIcon, label: 'Discord' },
    { url: socialLinks.youtube, Icon: YoutubeIcon, label: 'YouTube' },
    { url: socialLinks.facebook, Icon: FacebookIcon, label: 'Facebook' },
    { url: socialLinks.instagram, Icon: InstagramIcon, label: 'Instagram' },
    { url: socialLinks.steam, Icon: SteamIcon, label: 'Steam' },
  ];

  const isActive = (path: string) => {
    const currentPath = location.pathname;
    const currentSearch = location.search;
    const [targetPath, targetSearch] = path.split('?');
    if (targetSearch) return currentPath === targetPath && currentSearch === `?${targetSearch}`;
    if (targetPath === '/') return currentPath === '/';
    return currentPath === targetPath && !currentSearch;
  };

  const NavItem = ({ to, icon: Icon, label, compact }: { to: string; icon: typeof Home; label: string; compact?: boolean }) => {
    const active = isActive(to);
    if (compact) {
      return (
        <Link to={to} className={`flex flex-col items-center justify-center gap-0.5 w-full px-0 py-2.5 rounded-lg text-[10px] leading-tight hover:bg-gray-100 dark:hover:bg-dark-hover ${active ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-dark-text-secondary'}`}>
          <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
          <span className="text-center w-full truncate px-1">{label}</span>
        </Link>
      );
    }
    return (
      <Link to={to} className={`flex items-center gap-5 px-3 py-2 rounded-xl text-sm hover:bg-gray-100 dark:hover:bg-dark-hover ${active ? 'bg-gray-100 dark:bg-dark-card font-medium text-gray-900 dark:text-white' : 'text-gray-700 dark:text-dark-text-secondary'}`}>
        <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
        <span>{label}</span>
      </Link>
    );
  };

  // Main sidebar content (for both mini and full)
  const subscribedChs = subscribedChannels.map((id) => channels.find((c) => c.id === id)).filter(Boolean);

  return (
    <>
      {/* Full expanded overlay sidebar */}
      <aside className={`fixed top-0 left-0 bottom-0 w-60 bg-white dark:bg-dark-bg flex flex-col z-50 shadow-2xl transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Header inside sidebar (to match main header height and add close button if needed) */}
        <div className="h-14 flex items-center px-2 sm:px-4 border-b border-gray-100 dark:border-dark-border/50 gap-2 sm:gap-4">
          <button onClick={onToggle} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-full text-gray-700 dark:text-dark-text flex-shrink-0" title="Close sidebar">
            <Menu size={20} />
          </button>
          <Link to="/" className="flex items-center gap-1 font-bold text-xl tracking-tighter">
            <span className="text-red-600">View</span>Tube
          </Link>
        </div>
        
        <div className="flex-1 overflow-y-auto px-3 py-2 scrollbar-thin">
        {/* Main Nav Items: Home, Explore, Subscriptions, You */}
        <div className="pb-3 border-b border-gray-200 dark:border-dark-border mb-1 space-y-0.5">
          <NavItem to="/" icon={Home} label={t('home')} />
          <NavItem to="/explore" icon={Compass} label={t('explore')} />

          {/* Subscriptions as collapsible dropdown if logged in */}
          {isLoggedIn ? (
            <div>
              <button
                onClick={() => setSubscriptionsExpanded(!subscriptionsExpanded)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-dark-hover text-gray-700 dark:text-dark-text-secondary ${
                  subscriptionsExpanded ? 'bg-gray-100 dark:bg-dark-card font-medium text-gray-900 dark:text-white' : ''
                }`}
              >
                <span className="flex items-center gap-5">
                  <PlaySquare size={22} strokeWidth={subscriptionsExpanded ? 2.5 : 1.8} />
                  <span>{t('subscriptions')}</span>
                </span>
                {subscriptionsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {subscriptionsExpanded && (
                <div className="mt-1 ml-4 pl-3 border-l border-gray-200 dark:border-dark-border/50 space-y-0.5">
                  {subscribedChs.map((ch) => ch && (
                    <Link
                      key={ch.id}
                      to="/subscriptions"
                      className="flex items-center gap-3 px-3 py-1.5 rounded-xl text-xs hover:bg-gray-100 dark:hover:bg-dark-hover text-gray-700 dark:text-dark-text-secondary"
                    >
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0 ${
                        ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500'][ch.name.charCodeAt(0) % 5]
                      }`}>
                        {ch.name[0]}
                      </div>
                      <span className="truncate">{ch.name}</span>
                    </Link>
                  ))}
                  <NavItem to="/subscriptions" icon={PlaySquare} label={subscribedChs.length > 0 ? t('subscriptions') : t('subscribeToChannels')} />
                </div>
              )}
            </div>
          ) : (
            <NavItem to="/subscriptions" icon={PlaySquare} label={t('subscriptions')} />
          )}

          {/* You as collapsible dropdown if logged in */}
          {isLoggedIn ? (
            <div>
              <button
                onClick={() => setYouExpanded(!youExpanded)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-dark-hover text-gray-700 dark:text-dark-text-secondary ${
                  youExpanded ? 'bg-gray-100 dark:bg-dark-card font-medium text-gray-900 dark:text-white' : ''
                }`}
              >
                <span className="flex items-center gap-5">
                  <User size={22} strokeWidth={youExpanded ? 2.5 : 1.8} />
                  <span>{t('you')}</span>
                </span>
                {youExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {youExpanded && (
                <div className="mt-1 ml-4 pl-3 border-l border-gray-200 dark:border-dark-border/50 space-y-0.5">
                  <NavItem to="/profile" icon={User} label={t('yourChannel')} />
                  <NavItem to="/history" icon={History} label={t('history')} />
                  {queue.length > 0 && <NavItem to="/queue" icon={ListEnd} label={t('queue')} />}
                  <NavItem to="/watch-later" icon={Clock3} label="Watch Later" />
                  <NavItem to="/library" icon={FolderOpen} label={t('library')} />
                  <NavItem to="/liked" icon={ThumbsUp} label={t('likedVideos')} />
                  <NavItem to="/profile?tab=playlists" icon={ListVideo} label={t('playlists')} />
                  <NavItem to="/analytics" icon={BarChart3} label={t('analytics')} />
                </div>
              )}
            </div>
          ) : (
            <NavItem to="/profile" icon={User} label={t('you')} />
          )}
        </div>

        {/* Categories */}
        <div className="py-3 border-b border-gray-200 dark:border-dark-border mb-1">
          <button onClick={() => setCategoriesExpanded(!categoriesExpanded)} className="w-full flex items-center justify-between px-3 py-1.5 text-base font-medium mb-1 hover:bg-gray-50 dark:hover:bg-dark-hover rounded-lg">
            <span className="flex items-center gap-2">
              {t('categories')}
              {selectedCategories.length > 0 && <span className="bg-blue-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{selectedCategories.length}</span>}
            </span>
            {categoriesExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {categoriesExpanded && (
            <div>
              {/* Match ALL / ANY checkbox — visible whenever categories are selected */}
              {selectedCategories.length > 0 && (
                <div className="mx-1 mb-2 p-2 bg-gray-50 dark:bg-dark-elevated rounded-lg space-y-1.5">
                  <label className="flex items-start gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={matchAllCategories} onChange={(e) => setMatchAllCategories(e.target.checked)} className="w-3.5 h-3.5 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0" />
                    <span className="text-xs leading-snug dark:text-dark-text">
                      {matchAllCategories ? t('matchAll') : t('matchAny')}
                    </span>
                  </label>
                  <p className="text-[10px] text-gray-400 dark:text-dark-text-muted leading-tight pl-5.5">
                    {matchAllCategories
                      ? (language === 'el' ? 'Εμφάνιση βίντεο που ανήκουν σε ΟΛΕΣ τις κατηγορίες' : 'Show videos that match ALL selected categories')
                      : (language === 'el' ? 'Εμφάνιση βίντεο που ανήκουν σε ΟΠΟΙΑΔΗΠΟΤΕ κατηγορία' : 'Show videos that match ANY selected category')
                    }
                  </p>
                </div>
              )}
              {/* Clear all */}
              {selectedCategories.length > 0 && (
                <button onClick={() => { clearCategoryFilters(); navigate('/'); }} className="w-full flex items-center justify-center gap-1 mb-1 px-2 py-1.5 text-xs text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"><X size={12} /> {t('clearFilters')}</button>
              )}
              {/* Category list — +/- icon on LEFT side */}
              <div className="space-y-0.5">
                {sortedCategories.map((cat) => {
                  const isSel = selectedCategories.includes(cat.name);
                  return (
                    <button key={cat.id} onClick={() => { toggleCategoryFilter(cat.name); navigate('/'); }} className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-sm transition group ${isSel ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-medium' : 'hover:bg-gray-100 dark:hover:bg-dark-hover text-gray-700 dark:text-dark-text-secondary'}`}>
                      <span className={`flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full transition ${isSel ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-dark-elevated text-gray-500 dark:text-dark-text-muted group-hover:bg-blue-500 group-hover:text-white'}`}>
                        {isSel ? <Minus size={12} strokeWidth={2.5} /> : <Plus size={12} strokeWidth={2.5} />}
                      </span>
                      <span className="truncate text-left">{language === 'el' ? cat.nameEl : cat.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 dark:border-dark-border/50 px-4 py-4 flex-shrink-0">
        <div className="flex items-center justify-center gap-4 mb-3">
          {socials.map((s) => (
            <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer" title={s.label} className="text-gray-400 dark:text-dark-text-muted hover:text-gray-700 dark:hover:text-white transition transform hover:scale-110"><s.Icon size={16} /></a>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 dark:text-dark-text-muted text-center font-medium opacity-80 uppercase tracking-widest">© {copyrightYear} {siteName}</p>
      </div>
    </aside>
    </>
  );
}
