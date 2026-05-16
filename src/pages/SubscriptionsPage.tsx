import useStore from '../store/useStore';
import InfiniteVideoGrid from '../components/InfiniteVideoGrid';
import Avatar from '../components/Avatar';
import { useLanguage } from '../i18n/LanguageContext';

export default function SubscriptionsPage() {
  const videos = useStore((s) => s.videos);
  const channels = useStore((s) => s.channels);
  const subscribedChannels = useStore((s) => s.subscribedChannels);
  const toggleSubscribe = useStore((s) => s.toggleSubscribe);
  const { t } = useLanguage();

  const subscribedVideos = videos.filter((v) => subscribedChannels.includes(v.channelId) && v.visibility === 'public');

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('subscriptions')}</h1>
      {subscribedChannels.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-dark-text-muted">
          <p className="text-lg">{t('noSubscriptionsYet')}</p>
          <p className="text-sm mt-1">{t('subscribeToChannels')}</p>
          <div className="mt-8">
            <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-4">{t('channelsToDiscover')}</h3>
            <div className="flex flex-wrap gap-4 justify-center">
              {channels.map((ch) => (
                <div key={ch.id} className="flex flex-col items-center gap-2 p-4 bg-gray-50 dark:bg-dark-card rounded-xl">
                  <Avatar name={ch.name} size="lg" />
                  <p className="font-medium text-sm">{ch.name}</p>
                  <button onClick={() => toggleSubscribe(ch.id)} className="px-4 py-1 bg-red-600 text-white text-sm rounded-full hover:bg-red-700">{t('subscribe')}</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
            {subscribedChannels.map((chId) => {
              const ch = channels.find((c) => c.id === chId);
              if (!ch) return null;
              return (
                <div key={ch.id} className="flex flex-col items-center gap-1 flex-shrink-0">
                  <Avatar name={ch.name} size="lg" />
                  <p className="text-xs font-medium text-center w-16 truncate">{ch.name}</p>
                </div>
              );
            })}
          </div>

          <InfiniteVideoGrid
            videos={subscribedVideos}
            pageSize={12}
            emptyState={
              <div className="text-center py-16 text-gray-500 dark:text-dark-text-muted">
                <p>{t('noVideosFromSubs')}</p>
              </div>
            }
          />
        </>
      )}
    </div>
  );
}
