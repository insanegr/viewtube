import useStore from '../store/useStore';
import InfiniteVideoGrid from '../components/InfiniteVideoGrid';
import PlaylistCard from '../components/PlaylistCard';
import { useLanguage } from '../i18n/LanguageContext';

export default function LibraryPage() {
  const videos = useStore((s) => s.videos);
  const playlists = useStore((s) => s.playlists);
  const currentUser = useStore((s) => s.currentUser);
  const { t } = useLanguage();
  const myVideos = videos.filter((v) => v.channelId === currentUser.id);
  const myPlaylists = playlists.filter((p) => p.channelId === currentUser.id);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('library')}</h1>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">{t('yourVideos')}</h2>
        <InfiniteVideoGrid
          videos={myVideos}
          pageSize={8}
          emptyState={<p className="text-gray-500 dark:text-dark-text-muted text-sm">{t('noUploadedVideos')}</p>}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">{t('yourPlaylists')}</h2>
        {myPlaylists.length === 0 ? (
          <p className="text-gray-500 dark:text-dark-text-muted text-sm">{t('noPlaylistsCreated')}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {myPlaylists.map((pl) => (
              <PlaylistCard key={pl.id} playlist={pl} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
