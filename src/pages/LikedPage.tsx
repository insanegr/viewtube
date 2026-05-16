import useStore from '../store/useStore';
import InfiniteVideoGrid from '../components/InfiniteVideoGrid';
import { useLanguage } from '../i18n/LanguageContext';

export default function LikedPage() {
  const videos = useStore((s) => s.videos);
  const likedVideos = useStore((s) => s.likedVideos);
  const { t } = useLanguage();
  const liked = videos.filter((v) => likedVideos.includes(v.id));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('likedVideos')}</h1>
      <InfiniteVideoGrid
        videos={liked}
        pageSize={12}
        emptyState={
          <div className="text-center py-16 text-gray-500 dark:text-dark-text-muted">
            <p className="text-lg">{t('noLikedVideos')}</p>
            <p className="text-sm mt-1">{t('likedVideosAppear')}</p>
          </div>
        }
      />
    </div>
  );
}
