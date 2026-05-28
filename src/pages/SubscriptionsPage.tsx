import { Link } from 'react-router-dom';
import useStore from '../store/useStore';
import Avatar from '../components/Avatar';
import { useLanguage } from '../i18n/LanguageContext';
import { Users, UserMinus } from 'lucide-react';

export default function SubscriptionsPage() {
  const channels = useStore((s) => s.channels);
  const subscribedChannels = useStore((s) => s.subscribedChannels);
  const toggleSubscribe = useStore((s) => s.toggleSubscribe);
  const { t } = useLanguage();

  const formatSCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      <div className="flex items-center gap-3 mb-6">
        <Users size={28} className="text-gray-700 dark:text-dark-text" />
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-dark-text">{t('subscriptions')}</h1>
      </div>

      {subscribedChannels.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border-light rounded-2xl shadow-sm p-8">
          <p className="text-lg text-gray-700 dark:text-dark-text font-medium">{t('noSubscriptionsYet')}</p>
          <p className="text-sm mt-1 text-gray-500 dark:text-dark-text-muted">{t('subscribeToChannels')}</p>
          <div className="mt-8 border-t border-gray-100 dark:border-dark-border pt-8 max-w-4xl mx-auto">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-dark-text-secondary mb-6">{t('channelsToDiscover')}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {channels.map((ch) => (
                <div key={ch.id} className="flex flex-col items-center gap-3 p-4 bg-gray-50 dark:bg-dark-elevated rounded-2xl border border-gray-100 dark:border-dark-border-light transition hover:shadow-md">
                  <Link to={`/channel/${ch.id}`} className="flex flex-col items-center gap-2 group">
                    <Avatar name={ch.name} src={ch.avatar} size="lg" className="transition group-hover:scale-105" />
                    <p className="font-semibold text-sm text-gray-900 dark:text-dark-text text-center line-clamp-1 truncate">{ch.name}</p>
                  </Link>
                  <button onClick={() => toggleSubscribe(ch.id)} className="w-full py-1.5 bg-red-600 text-white text-xs font-medium rounded-full hover:bg-red-700 transition">{t('subscribe')}</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {subscribedChannels.map((chId) => {
            const ch = channels.find((c) => c.id === chId);
            if (!ch) return null;
            return (
              <div key={ch.id} className="flex flex-col items-center text-center gap-3 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-2xl p-4 shadow-sm transition-all hover:shadow-md duration-200 relative group">
                <Link to={`/channel/${ch.id}`} className="flex flex-col items-center gap-2.5 w-full">
                  <Avatar name={ch.name} src={ch.avatar} size="lg" className="transition duration-300 group-hover:scale-105" />
                  <div className="w-full px-1">
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-dark-text truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">{ch.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-dark-text-muted mt-0.5">{formatSCount(ch.subscriberCount)} {t('subscribers')}</p>
                  </div>
                </Link>
                <div className="w-full pt-1">
                  <button 
                    onClick={() => toggleSubscribe(ch.id)} 
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-gray-100 dark:bg-dark-elevated text-gray-700 dark:text-dark-text text-xs font-semibold rounded-full hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20 dark:hover:text-red-400 transition-colors duration-200"
                    title={t('unsubscribe') || 'Unsubscribe'}
                  >
                    <UserMinus size={13} />
                    <span>Subscribed</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
