import { useEffect, useMemo, useRef, useState } from 'react';
import VideoCard from './VideoCard';
import { Video } from '../store/useStore';
import { api } from '../api/client';

interface InfiniteVideoGridProps {
  videos?: Video[];
  layout?: 'grid' | 'list';
  pageSize?: number;
  emptyState?: React.ReactNode;
  gridClassName?: string;
  listClassName?: string;
  fetchParams?: {
    category?: string;
    categories?: string;
    matchAll?: boolean;
    subscribed?: boolean;
    search?: string;
    visibility?: string;
    channelId?: string;
    sortBy?: string;
    limit?: number;
    excludeVideoId?: string;
  };
  maxItems?: number;
  compact?: boolean;
}

export default function InfiniteVideoGrid({
  videos,
  layout = 'grid',
  pageSize = 12,
  emptyState,
  gridClassName = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-6',
  listClassName = 'space-y-4',
  fetchParams,
  maxItems,
  compact = false,
}: InfiniteVideoGridProps) {
  const [localVideos, setLocalVideos] = useState<Video[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const [visibleCount, setVisibleCount] = useState(pageSize);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // If using local array/prop mode
  const isLocalMode = !fetchParams;

  // Track dependency version of fetch params
  const serializedFetchParams = fetchParams ? JSON.stringify(fetchParams) : '';

  useEffect(() => {
    if (isLocalMode) {
      setVisibleCount(pageSize);
    }
  }, [videos, pageSize, isLocalMode]);

  useEffect(() => {
    if (isLocalMode) return;

    // Reset list and set loading
    setLocalVideos([]);
    setCurrentPage(1);
    setHasMore(true);
    setLoading(true);

    api.getVideos({
      page: 1,
      limit: fetchParams.limit || pageSize,
      category: fetchParams.category,
      categories: fetchParams.categories,
      matchAll: fetchParams.matchAll ? 'true' : 'false',
      subscribed: fetchParams.subscribed ? 'true' : undefined,
      search: fetchParams.search,
      visibility: fetchParams.visibility,
      channelId: fetchParams.channelId,
      sortBy: fetchParams.sortBy,
      excludeId: fetchParams.excludeVideoId,
    })
      .then((res) => {
        let vids = res.videos || [];
        if (fetchParams.excludeVideoId) {
          vids = vids.filter((v: Video) => v.id !== fetchParams.excludeVideoId);
        }

        if (maxItems !== undefined && vids.length >= maxItems) {
          vids = vids.slice(0, maxItems);
          setHasMore(false);
        } else {
          setHasMore(res.hasMore ?? false);
        }

        setLocalVideos(vids);
      })
      .catch((err) => {
        console.error('Error fetching paginated videos:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [serializedFetchParams, isLocalMode, pageSize, maxItems]);

  // Handler for loading the NEXT page
  const loadNextPage = async () => {
    if (isLocalMode || loading || !hasMore || !fetchParams) return;

    setLoading(true);
    const nextPage = currentPage + 1;

    try {
      const res = await api.getVideos({
        page: nextPage,
        limit: fetchParams.limit || pageSize,
        category: fetchParams.category,
        categories: fetchParams.categories,
        matchAll: fetchParams.matchAll ? 'true' : 'false',
        subscribed: fetchParams.subscribed ? 'true' : undefined,
        search: fetchParams.search,
        visibility: fetchParams.visibility,
        channelId: fetchParams.channelId,
        sortBy: fetchParams.sortBy,
        excludeId: fetchParams.excludeVideoId,
      });

      let newVids = res.videos || [];
      if (fetchParams.excludeVideoId) {
        newVids = newVids.filter((v: Video) => v.id !== fetchParams.excludeVideoId);
      }

      const nextTotal = localVideos.length + newVids.length;

      if (maxItems !== undefined && nextTotal >= maxItems) {
        const allowed = maxItems - localVideos.length;
        if (allowed > 0) {
          newVids = newVids.slice(0, allowed);
        } else {
          newVids = [];
        }
        setHasMore(false);
      } else {
        setHasMore(res.hasMore ?? false);
      }

      setLocalVideos((prev) => [...prev, ...newVids]);
      setCurrentPage(nextPage);
    } catch (err) {
      console.error('Failed to load next page:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting) {
          if (isLocalMode) {
            setVisibleCount((prev) => Math.min(prev + pageSize, (videos || []).length));
          } else {
            loadNextPage();
          }
        }
      },
      {
        rootMargin: '300px 0px',
        threshold: 0,
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [videos?.length, pageSize, isLocalMode, hasMore, loading, currentPage, serializedFetchParams]);

  const visibleVideos = useMemo(() => {
    if (isLocalMode) {
      const vids = videos || [];
      if (maxItems !== undefined) {
        return vids.slice(0, Math.min(visibleCount, maxItems));
      }
      return vids.slice(0, visibleCount);
    }
    return localVideos;
  }, [isLocalMode, videos, visibleCount, localVideos, maxItems]);

  const isShowMoreIndicator = isLocalMode
    ? (maxItems !== undefined
        ? visibleCount < Math.min((videos || []).length, maxItems)
        : visibleCount < (videos || []).length)
    : hasMore || loading;

  const totalLength = isLocalMode ? (videos || []).length : visibleVideos.length;

  if (totalLength === 0 && !loading) {
    return <>{emptyState}</>;
  }

  return (
    <div>
      <div className={layout === 'grid' ? gridClassName : listClassName}>
        {visibleVideos.map((video) => (
          <VideoCard key={video.id} video={video} layout={layout} compact={compact} />
        ))}
      </div>

      <div ref={sentinelRef} className="h-12 flex items-center justify-center mt-4">
        {isShowMoreIndicator && (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-dark-text-muted">
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span>Loading more…</span>
          </div>
        )}
      </div>
    </div>
  );
}
