import useStore from '../store/useStore';
import InfiniteVideoGrid from '../components/InfiniteVideoGrid';
import { Clock3 } from 'lucide-react';

export default function WatchLaterPage() {
  const videos = useStore((s) => s.videos);
  const watchLater = useStore((s) => s.watchLater);

  const items = watchLater.map((id) => videos.find((v) => v.id === id)).filter(Boolean) as typeof videos;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Clock3 size={24} />
        <h1 className="text-2xl font-bold">Watch Later</h1>
      </div>
      <InfiniteVideoGrid
        videos={items}
        pageSize={12}
        emptyState={<div className="text-center py-16 text-gray-500 dark:text-dark-text-muted"><Clock3 size={48} className="mx-auto mb-3 opacity-30" /><p className="text-lg">No videos in Watch Later</p><p className="text-sm mt-1">Use the three-dot menu on any video to save it here.</p></div>}
      />
    </div>
  );
}
