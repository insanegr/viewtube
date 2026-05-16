import { useEffect, useMemo, useRef, useState } from 'react';
import VideoCard from './VideoCard';
import { Video } from '../store/useStore';

interface InfiniteVideoGridProps {
  videos: Video[];
  layout?: 'grid' | 'list';
  pageSize?: number;
  emptyState?: React.ReactNode;
  gridClassName?: string;
  listClassName?: string;
}

export default function InfiniteVideoGrid({
  videos,
  layout = 'grid',
  pageSize = 12,
  emptyState,
  gridClassName = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-6',
  listClassName = 'space-y-4',
}: InfiniteVideoGridProps) {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [videos, pageSize]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + pageSize, videos.length));
        }
      },
      {
        rootMargin: '300px 0px',
        threshold: 0,
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [videos.length, pageSize]);

  const visibleVideos = useMemo(() => videos.slice(0, visibleCount), [videos, visibleCount]);
  const hasMore = visibleCount < videos.length;

  if (videos.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <div>
      <div className={layout === 'grid' ? gridClassName : listClassName}>
        {visibleVideos.map((video) => (
          <VideoCard key={video.id} video={video} layout={layout} />
        ))}
      </div>

      <div ref={sentinelRef} className="h-12 flex items-center justify-center">
        {hasMore && (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-dark-text-muted">
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span>Loading more…</span>
          </div>
        )}
      </div>
    </div>
  );
}
