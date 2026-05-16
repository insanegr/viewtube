import useStore from '../store/useStore';
import InfiniteVideoGrid from '../components/InfiniteVideoGrid';
import { useLanguage } from '../i18n/LanguageContext';
import { useConfirm } from '../components/ConfirmDialog';
import { Clock, Trash2 } from 'lucide-react';

export default function HistoryPage() {
  const { t } = useLanguage();
  const videos = useStore((s) => s.videos);
  const watchHistory = useStore((s) => s.watchHistory);
  const clearHistory = useStore((s) => s.clearHistory);
  const confirm = useConfirm();

  const historyVideos = watchHistory
    .map((h) => videos.find((v) => v.id === h.videoId))
    .filter((v): v is NonNullable<typeof v> => !!v);

  const handleClear = async () => {
    const ok = await confirm({ title: t('clearHistory'), message: t('clearHistoryDesc'), confirmText: t('clearHistory'), danger: true });
    if (ok) clearHistory();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Clock size={24} />
          <h1 className="text-2xl font-bold">{t('watchHistory')}</h1>
        </div>
        {watchHistory.length > 0 && (
          <button onClick={handleClear} className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition">
            <Trash2 size={16} /> {t('clearHistory')}
          </button>
        )}
      </div>

      <InfiniteVideoGrid
        videos={historyVideos}
        pageSize={12}
        emptyState={
          <div className="text-center py-20 text-gray-500 dark:text-dark-text-muted">
            <Clock size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-lg">{t('noHistory')}</p>
            <p className="text-sm mt-1">{t('noHistoryDesc')}</p>
          </div>
        }
      />
    </div>
  );
}
