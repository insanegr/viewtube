import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Eye, ThumbsUp, MessageSquare, Play } from 'lucide-react';
import useStore from '../store/useStore';
import { formatCount, formatViews } from '../utils/format';
import { useLanguage } from '../i18n/LanguageContext';

interface TimelinePoint { day: string; count: number }

// ── Pure CSS timeline chart — no external library ──
function TimelineChart({ data, color, label }: { data: TimelinePoint[]; color: string; label: string }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const total = data.reduce((a, d) => a + d.count, 0);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm">{label}</h3>
        <span className="text-xs text-gray-500 dark:text-dark-text-muted">{formatCount(total)} total</span>
      </div>

      {/* Chart area */}
      <div className="relative h-36 flex items-end gap-px">
        {data.map((d, i) => {
          const pct = max > 0 ? (d.count / max) * 100 : 0;
          const isHovered = hoveredIdx === i;
          return (
            <div
              key={d.day}
              className="flex-1 relative group cursor-pointer"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div
                className={`w-full rounded-t transition-all duration-150 ${color} ${isHovered ? 'opacity-100' : 'opacity-70'}`}
                style={{ height: `${Math.max(pct, 1)}%`, minHeight: d.count > 0 ? '4px' : '1px' }}
              />
              {/* Tooltip */}
              {isHovered && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 dark:bg-dark-elevated text-white text-[10px] rounded shadow-lg whitespace-nowrap z-10 pointer-events-none">
                  <div className="font-medium">{d.count.toLocaleString()}</div>
                  <div className="text-gray-300">{new Date(d.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between mt-2 text-[10px] text-gray-400 dark:text-dark-text-muted">
        <span>{data.length > 0 && new Date(data[0].day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
        <span>{data.length > 0 && new Date(data[data.length - 1].day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { t } = useLanguage();
  const currentUser = useStore((s) => s.currentUser);
  const videos = useStore((s) => s.videos);
  const comments = useStore((s) => s.comments);

  const [timelineDays, setTimelineDays] = useState(30);
  const [apiData, setApiData] = useState<{ views: TimelinePoint[]; likes: TimelinePoint[]; subscribers: TimelinePoint[]; topVideos: any[] } | null>(null);
  const [loadingApi, setLoadingApi] = useState(false);

  const myVideos = useMemo(() => videos.filter((v) => v.channelId === currentUser.id), [videos, currentUser.id]);

  // Try to load timeline from API
  useEffect(() => {
    setLoadingApi(true);
    import('../api/client').then(({ api }) =>
      api.getAnalytics(timelineDays)
        .then((data: any) => setApiData(data))
        .catch(() => setApiData(null))
        .finally(() => setLoadingApi(false))
    );
  }, [timelineDays]);

  // Fallback: generate local timeline from video upload dates
  const localTimeline = useMemo(() => {
    const days: TimelinePoint[] = [];
    for (let i = timelineDays - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const dayViews = myVideos.filter((v) => v.uploadDate === key).reduce((a, v) => a + v.views, 0);
      days.push({ day: key, count: dayViews });
    }
    return days;
  }, [myVideos, timelineDays]);

  const viewsTimeline = apiData?.views || localTimeline;
  const likesTimeline = apiData?.likes || localTimeline.map((d) => ({ ...d, count: 0 }));
  const subsTimeline = apiData?.subscribers || localTimeline.map((d) => ({ ...d, count: 0 }));

  // Totals
  const totalViews = myVideos.reduce((a, v) => a + v.views, 0);
  const totalLikes = myVideos.reduce((a, v) => a + v.likes, 0);
  const totalComments = comments.filter((c) => myVideos.some((v) => v.id === c.videoId)).length;

  // Top videos
  const topVideos = apiData?.topVideos || [...myVideos].sort((a, b) => b.views - a.views).slice(0, 10);
  const maxViews = topVideos[0]?.views || 1;

  const statCards = [
    { icon: Eye, label: t('totalViews'), value: formatCount(totalViews), color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { icon: ThumbsUp, label: t('totalLikes'), value: formatCount(totalLikes), color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
    { icon: MessageSquare, label: t('totalComments'), value: formatCount(totalComments), color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    { icon: Play, label: t('videos'), value: myVideos.length.toString(), color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
  ];

  const dayOptions = [7, 14, 30, 90];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BarChart3 size={28} className="text-blue-600 dark:text-blue-400" />
          <h1 className="text-2xl font-bold">{t('analytics')}</h1>
        </div>
        {/* Time range selector */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-dark-card rounded-lg p-0.5">
          {dayOptions.map((d) => (
            <button key={d} onClick={() => setTimelineDays(d)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${timelineDays === d ? 'bg-white dark:bg-dark-elevated shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-dark-text-muted hover:text-gray-700 dark:hover:text-dark-text-secondary'}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((s) => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
            <s.icon size={20} className={s.color} />
            <p className="text-2xl font-bold mt-2">{s.value}</p>
            <p className="text-xs text-gray-500 dark:text-dark-text-muted mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {myVideos.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-dark-text-muted">
          <BarChart3 size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg">{t('noVideosUploaded')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Timeline Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <TimelineChart data={viewsTimeline} color="bg-blue-500" label={`📈 ${t('totalViews')}`} />
            <TimelineChart data={likesTimeline} color="bg-green-500" label={`👍 ${t('totalLikes')}`} />
            <TimelineChart data={subsTimeline} color="bg-red-500" label={`👥 ${t('subscribers')}`} />
          </div>

          {/* Top Videos Table */}
          <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl p-5">
            <h2 className="font-semibold mb-4 flex items-center gap-2"><Eye size={18} className="text-blue-500" /> {t('topByViews')}</h2>
            <div className="space-y-2.5">
              {topVideos.map((v: any, i: number) => (
                <div key={v.id} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 dark:text-dark-text-muted w-5 text-right font-medium">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link to={`/watch/${v.id}`} className="text-sm font-medium truncate hover:text-blue-600 dark:hover:text-blue-400">{v.title}</Link>
                      <span className="text-xs text-gray-500 dark:text-dark-text-muted flex-shrink-0">{formatViews(v.views)}</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-dark-elevated rounded-full overflow-hidden h-1.5">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(v.views / maxViews) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {loadingApi && (
        <div className="fixed bottom-4 right-4 bg-gray-800 dark:bg-dark-card text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Loading analytics...
        </div>
      )}
    </div>
  );
}
