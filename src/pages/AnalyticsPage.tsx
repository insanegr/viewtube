import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  BarChart3, Eye, ThumbsUp, MessageSquare, Play, Calendar, Tv, Tag, 
  RotateCcw, FileSpreadsheet, FileJson, Award, TrendingUp 
} from 'lucide-react';
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
    <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm text-gray-800 dark:text-dark-text">{label}</h3>
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
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 dark:bg-dark-elevated text-white text-[10px] rounded shadow-lg whitespace-nowrap z-10 pointer-events-none border border-gray-700">
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
  const [selectedVideoId, setSelectedVideoId] = useState('');
  const [selectedCategoryName, setSelectedCategoryName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [apiData, setApiData] = useState<{ 
    views: TimelinePoint[]; 
    likes: TimelinePoint[]; 
    subscribers: TimelinePoint[]; 
    totals: { 
      views: number; 
      likes: number; 
      comments: number; 
      videos: number; 
      avgProgress?: number; 
      subscribers?: number; 
    }; 
    topVideos: any[];
    meta?: {
      startDate: string;
      endDate: string;
      calculatedDaysDiff: number;
    };
  } | null>(null);

  const [loadingApi, setLoadingApi] = useState(false);

  const myVideos = useMemo(() => videos.filter((v) => v.channelId === currentUser.id), [videos, currentUser.id]);

  // Load dynamically filtered analytics from endpoint
  useEffect(() => {
    setLoadingApi(true);
    import('../api/client').then(({ api }) =>
      api.getAnalytics({
        days: timelineDays,
        videoId: selectedVideoId || undefined,
        category: selectedCategoryName || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      })
        .then((data: any) => setApiData(data))
        .catch(() => setApiData(null))
        .finally(() => setLoadingApi(false))
    );
  }, [timelineDays, selectedVideoId, selectedCategoryName, startDate, endDate]);

  // Fallback local timeline generators
  const localTimeline = useMemo(() => {
    const days = timelineDays;
    const daysArray: TimelinePoint[] = [];
    const end = endDate ? new Date(endDate) : new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const dayViews = myVideos.filter((v) => v.uploadDate === key).reduce((a, v) => a + v.views, 0);
      daysArray.push({ day: key, count: dayViews });
    }
    return daysArray;
  }, [myVideos, timelineDays, endDate]);

  const viewsTimeline = apiData?.views || localTimeline;
  const likesTimeline = apiData?.likes || localTimeline.map((d) => ({ ...d, count: 0 }));
  const subsTimeline = apiData?.subscribers || localTimeline.map((d) => ({ ...d, count: 0 }));

  // Dynamic Totals calculation
  const totalViews = apiData?.totals?.views !== undefined 
    ? apiData.totals.views 
    : myVideos.reduce((a, v) => a + v.views, 0);

  const totalLikes = apiData?.totals?.likes !== undefined 
    ? apiData.totals.likes 
    : myVideos.reduce((a, v) => a + v.likes, 0);

  const totalComments = apiData?.totals?.comments !== undefined 
    ? apiData.totals.comments 
    : comments.filter((c) => myVideos.some((v) => v.id === c.videoId)).length;

  const numVideos = apiData?.totals?.videos !== undefined
    ? apiData.totals.videos
    : myVideos.length;

  const avgProgress = apiData?.totals?.avgProgress !== undefined
    ? apiData.totals.avgProgress
    : 0;

  const subscribersGained = apiData?.totals?.subscribers !== undefined
    ? apiData.totals.subscribers
    : 0;

  const engagementRatio = totalViews > 0 
    ? ((totalLikes + totalComments) / totalViews) * 100 
    : 0;

  // Render metrics definitions
  const statCards = [
    { icon: Eye, label: t('totalViews') + ' (Gained)', value: formatCount(totalViews), color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { icon: ThumbsUp, label: t('totalLikes') + ' (Gained)', value: formatCount(totalLikes), color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
    { icon: MessageSquare, label: 'Comments Posted', value: formatCount(totalComments), color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    { icon: Play, label: 'Subscribers Gained', value: `+${formatCount(subscribersGained)}`, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
    { icon: Award, label: 'Avg Watch Progress', value: `${avgProgress}%`, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
    { icon: TrendingUp, label: 'Audience Engagement', value: `${engagementRatio.toFixed(1)}%`, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-900/20' },
  ];

  // Top videos sorted with fallback
  const topVideos = apiData?.topVideos || [...myVideos].sort((a, b) => b.views - a.views).slice(0, 10);
  const maxViews = Math.max(...topVideos.map((v) => v.views), 1);

  const dayOptions = [7, 14, 30, 90];

  // --- Export Report handlers ---
  const handleExportCSV = () => {
    const lines = [
      'ViewTube Creator Analytics Export',
      `Date Range: ${apiData?.meta?.startDate || startDate || 'N/A'} to ${apiData?.meta?.endDate || endDate || 'N/A'}`,
      `Video Filter: ${selectedVideoId ? myVideos.find(v => v.id === selectedVideoId)?.title || selectedVideoId : 'All Videos'}`,
      `Category Filter: ${selectedCategoryName || 'All Categories'}`,
      '',
      'DAILY METRICS',
      'Date,Views,Likes,Subscribers'
    ];

    const maxLength = Math.max(viewsTimeline.length, likesTimeline.length, subsTimeline.length);
    for (let i = 0; i < maxLength; i++) {
      const day = viewsTimeline[i]?.day || likesTimeline[i]?.day || subsTimeline[i]?.day || '';
      const viewCount = viewsTimeline[i]?.count || 0;
      const likeCount = likesTimeline[i]?.count || 0;
      const subCount = subsTimeline[i]?.count || 0;
      lines.push(`${day},${viewCount},${likeCount},${subCount}`);
    }

    lines.push('');
    lines.push('SUMMARY TOTALS');
    lines.push(`Total Views Gained,${totalViews}`);
    lines.push(`Total Likes Gained,${totalLikes}`);
    lines.push(`Total Comments Posted,${totalComments}`);
    lines.push(`Subscribers Gained,${subscribersGained}`);
    lines.push(`Average View Completion %,${avgProgress}%`);
    lines.push(`Videos Count in Filter,${numVideos}`);

    lines.push('');
    lines.push('TOP PERFORMING VIDEOS');
    lines.push('Video ID,Title,Views Gained,Lifetime Likes');
    topVideos.forEach((v: any) => {
      lines.push(`"${v.id}","${v.title.replace(/"/g, '""')}",${v.views},${v.likes || 0}`);
    });

    const csvContent = "data:text/csv;charset=utf-8," + lines.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `creator_analytics_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    const reportObj = {
      title: 'ViewTube Creator Analytics Report',
      exportedAt: new Date().toISOString(),
      filters: {
        timelineDays,
        selectedVideoId,
        selectedCategoryName,
        startDate: apiData?.meta?.startDate || startDate || null,
        endDate: apiData?.meta?.endDate || endDate || null
      },
      totals: {
        viewsGained: totalViews,
        likesGained: totalLikes,
        commentsGained: totalComments,
        subscribersGained,
        averageCompletionPercent: avgProgress,
        totalVideosAudited: numVideos
      },
      timeline: viewsTimeline.map((v, i) => ({
        date: v.day,
        views: v.count,
        likes: likesTimeline[i]?.count || 0,
        subscribers: subsTimeline[i]?.count || 0
      })),
      topVideos: topVideos.map((v: any) => ({
        id: v.id,
        title: v.title,
        viewsGained: v.views,
        likes: v.likes || 0
      }))
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(reportObj, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", dataStr);
    link.setAttribute("download", `creator_analytics_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Title/Action cluster */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-dark-border-light pb-5">
        <div className="flex items-center gap-3">
          <BarChart3 size={28} className="text-blue-600 dark:text-blue-400" />
          <h1 className="text-2xl font-bold tracking-tight">{t('analytics')}</h1>
        </div>

        {/* Preset & Export Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {!startDate && !endDate && (
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-dark-card rounded-lg p-0.5 border border-gray-200/50 dark:border-dark-border">
              {dayOptions.map((d) => (
                <button 
                  key={d} 
                  onClick={() => setTimelineDays(d)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                    timelineDays === d 
                      ? 'bg-white dark:bg-dark-elevated shadow text-gray-900 dark:text-white' 
                      : 'text-gray-500 dark:text-dark-text-muted hover:text-gray-700 dark:hover:text-dark-text'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card rounded-lg text-xs font-medium text-gray-700 dark:text-dark-text flex items-center gap-1 hover:bg-gray-50 dark:hover:bg-dark-elevated shadow-sm transition hover:text-green-600"
              title="Export Report CSV"
            >
              <FileSpreadsheet size={14} className="text-green-600" /> Export CSV
            </button>
            <button
              onClick={handleExportJSON}
              className="px-3 py-1.5 border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card rounded-lg text-xs font-medium text-gray-700 dark:text-dark-text flex items-center gap-1 hover:bg-gray-50 dark:hover:bg-dark-elevated shadow-sm transition hover:text-orange-500"
              title="Export Payload JSON"
            >
              <FileJson size={14} className="text-orange-500" /> Export JSON
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Controls & Filters Panel */}
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100 dark:border-dark-border-light">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-dark-text-muted flex items-center gap-1.5">
            <TrendingUp size={14} className="text-blue-500" /> Refine Creator Dashboard
          </h3>
          {(selectedVideoId || selectedCategoryName || startDate || endDate) && (
            <button
              onClick={() => {
                setSelectedVideoId('');
                setSelectedCategoryName('');
                setStartDate('');
                setEndDate('');
              }}
              className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 font-medium transition"
              title="Reset Filters"
            >
              <RotateCcw size={13} /> Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Video Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-dark-text-muted mb-1.5 flex items-center gap-1">
              <Tv size={13} /> Specific Video
            </label>
            <select
              value={selectedVideoId}
              onChange={(e) => {
                setSelectedVideoId(e.target.value);
                if (e.target.value) {
                  setSelectedCategoryName('');
                }
              }}
              className="w-full text-xs rounded-lg border border-gray-200 dark:border-dark-border-light bg-transparent p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700 dark:text-dark-text"
            >
              <option value="">All Uploaded Videos</option>
              {myVideos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-dark-text-muted mb-1.5 flex items-center gap-1">
              <Tag size={13} /> Category
            </label>
            <select
              value={selectedCategoryName}
              onChange={(e) => {
                setSelectedCategoryName(e.target.value);
                if (e.target.value) {
                  setSelectedVideoId('');
                }
              }}
              className="w-full text-xs rounded-lg border border-gray-200 dark:border-dark-border-light bg-transparent p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700 dark:text-dark-text"
            >
              <option value="">All Categories</option>
              {Array.from(new Set(myVideos.flatMap(v => v.categories || []))).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Start Date */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-dark-text-muted mb-1.5 flex items-center gap-1">
              <Calendar size={13} /> Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-xs rounded-lg border border-gray-200 dark:border-dark-border-light bg-transparent p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700 dark:text-dark-text"
            />
          </div>

          {/* Custom End Date */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-dark-text-muted mb-1.5 flex items-center gap-1">
              <Calendar size={13} /> End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-xs rounded-lg border border-gray-200 dark:border-dark-border-light bg-transparent p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700 dark:text-dark-text"
            />
          </div>
        </div>
      </div>

      {myVideos.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-dark-text-muted bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl">
          <BarChart3 size={48} className="mx-auto mb-3 opacity-30 animate-pulse" />
          <p className="text-lg">{t('noVideosUploaded')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Premium High-Contrast Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            {statCards.map((s) => (
              <div key={s.label} className={`${s.bg} rounded-xl p-4 shadow-sm border border-black/5 dark:border-white/5 transition hover:scale-[1.02]`}>
                <s.icon size={20} className={s.color} />
                <p className="text-xl font-bold mt-2 tracking-tight text-gray-900 dark:text-white">{s.value}</p>
                <p className="text-[10px] uppercase font-bold text-gray-500 dark:text-dark-text-muted mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Timeline Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <TimelineChart data={viewsTimeline} color="bg-blue-500" label={`📈 ${t('totalViews')} (${viewsTimeline.length} Days)`} />
            <TimelineChart data={likesTimeline} color="bg-green-500" label={`👍 ${t('totalLikes')}`} />
            <TimelineChart data={subsTimeline} color="bg-red-500" label={`👥 ${t('subscribers')} Trend`} />
          </div>

          {/* Top Videos Table */}
          <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl p-5 shadow-sm">
            <h2 className="font-semibold mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2"><Eye size={18} className="text-blue-500" /> {t('topByViews')} (Selected Period)</span>
              <span className="text-xs text-gray-400 font-normal">Max views gained in list: {formatViews(maxViews)}</span>
            </h2>
            <div className="space-y-4">
              {topVideos.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No view analytics events found matching this active timeline selection.</p>
              ) : (
                topVideos.map((v: any, i: number) => (
                  <div key={v.id} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 dark:text-dark-text-muted w-5 text-right font-medium">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <Link to={`/watch/${v.id}`} className="text-sm font-medium truncate hover:text-blue-600 dark:hover:text-blue-400 text-gray-800 dark:text-dark-text">{v.title}</Link>
                        <span className="text-xs text-gray-500 dark:text-dark-text-muted flex-shrink-0 font-medium">{formatViews(v.views)} views gained</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-dark-elevated rounded-full overflow-hidden h-1.5 border border-black/5 dark:border-white/5">
                        <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${(v.views / maxViews) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {loadingApi && (
        <div className="fixed bottom-4 right-4 bg-gray-800 dark:bg-dark-card text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-2xl z-50 border border-gray-700">
          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Fetching real-time updates...
        </div>
      )}
    </div>
  );
}
