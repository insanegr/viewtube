import { Link, useLocation } from 'react-router-dom';
import { Home, Compass, PlusSquare, PlaySquare, FolderOpen } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export default function MobileNav() {
  const location = useLocation();
  const { t } = useLanguage();

  const items = [
    { to: '/', icon: Home, label: t('home') },
    { to: '/explore', icon: Compass, label: t('explore') },
    { to: '/upload', icon: PlusSquare, label: t('upload') },
    { to: '/subscriptions', icon: PlaySquare, label: t('subscriptions') },
    { to: '/library', icon: FolderOpen, label: t('library') },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-dark-surface border-t border-gray-200 dark:border-dark-border lg:hidden">
      <div className="flex items-center justify-around h-12">
        {items.map((item) => {
          const isActive = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full ${
                isActive ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-dark-text-muted'
              }`}
            >
              <item.icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className="text-[10px] leading-tight truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
