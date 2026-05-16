import { Link, useNavigate } from 'react-router-dom';
import { Play, ListEnd, Trash2 } from 'lucide-react';
import useStore from '../store/useStore';
import { useLanguage } from '../i18n/LanguageContext';
import { formatDuration } from '../utils/format';

export default function QueuePage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const videos = useStore((s) => s.videos);
  const queue = useStore((s) => s.queue);
  const removeFromQueue = useStore((s) => s.removeFromQueue);
  const clearQueue = useStore((s) => s.clearQueue);

  const queueVideos = queue.map((id) => videos.find((v) => v.id === id)).filter(Boolean);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ListEnd size={26} className="text-blue-600 dark:text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold">{t('queue')}</h1>
            <p className="text-sm text-gray-500 dark:text-dark-text-muted">{queueVideos.length} videos</p>
          </div>
        </div>
        {queueVideos.length > 0 && (
          <div className="flex gap-2">
            <button onClick={() => navigate(`/watch/${(queueVideos[0] as any).id}`)} className="px-4 py-2 bg-white dark:bg-dark-text text-gray-900 dark:text-dark-bg rounded-full text-sm font-medium hover:opacity-90 flex items-center gap-2">
              <Play size={16} fill="currentColor" /> {t('playAll')}
            </button>
            <button onClick={clearQueue} className="px-4 py-2 bg-gray-100 dark:bg-dark-card text-gray-700 dark:text-dark-text-secondary rounded-full text-sm font-medium hover:bg-gray-200 dark:hover:bg-dark-hover flex items-center gap-2">
              <Trash2 size={16} /> {t('clearQueue')}
            </button>
          </div>
        )}
      </div>

      {queueVideos.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-dark-text-muted">
          <ListEnd size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg">Queue is empty</p>
          <p className="text-sm mt-1">Use the three-dot menu on videos to add them here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {queueVideos.map((video: any, index) => (
            <div key={video.id} className="flex items-center gap-3 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl p-3">
              <span className="text-xs text-gray-400 dark:text-dark-text-muted w-6 text-right">{index + 1}</span>
              <Link to={`/watch/${video.id}`} className="w-36 aspect-video bg-gray-200 dark:bg-dark-elevated rounded-lg overflow-hidden relative flex-shrink-0">
                {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Play size={18} className="text-gray-500" /></div>}
                <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 py-0.5 rounded">{formatDuration(video.duration)}</span>
              </Link>
              <div className="flex-1 min-w-0">
                <Link to={`/watch/${video.id}`} className="font-medium text-sm hover:text-blue-600 dark:hover:text-blue-400 line-clamp-2">{video.title}</Link>
                <p className="text-xs text-gray-500 dark:text-dark-text-muted mt-1">{video.channelName}</p>
              </div>
              <button onClick={() => removeFromQueue(video.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
