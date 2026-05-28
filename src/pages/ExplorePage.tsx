import { useState, useMemo } from 'react';
import InfiniteVideoGrid from '../components/InfiniteVideoGrid';
import { TrendingUp, Flame, Music, Gamepad2, GraduationCap } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import SortMenu from '../components/SortMenu';

export default function ExplorePage() {
  const [activeSection, setActiveSection] = useState('trending');
  const { t, language } = useLanguage();

  const SECTIONS = [
    { id: 'trending', labelKey: 'trending' as const, icon: Flame },
    { id: 'Music', labelKey: 'music' as const, icon: Music },
    { id: 'Gaming', labelKey: 'gaming' as const, icon: Gamepad2 },
    { id: 'Education', labelKey: 'learning' as const, icon: GraduationCap },
  ];

  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'popular' | 'likes'>('popular');

  const fetchParams = useMemo(() => ({
    category: activeSection === 'trending' ? undefined : activeSection,
    sortBy: sortBy,
    limit: 12
  }), [activeSection, sortBy]);

  const labels = language === 'el' ? {
    newest: 'Νεότερα',
    oldest: 'Παλαιότερα',
    popular: 'Δημοφιλή',
    likes: 'Αγαπημένα',
  } : {
    newest: 'Newest',
    oldest: 'Oldest',
    popular: 'Popular',
    likes: 'Most Liked',
  };

  const sortOptions = [
    { value: 'popular' as 'popular' | 'newest' | 'oldest' | 'likes', label: labels.popular },
    { value: 'newest' as 'popular' | 'newest' | 'oldest' | 'likes', label: labels.newest },
    { value: 'oldest' as 'popular' | 'newest' | 'oldest' | 'likes', label: labels.oldest },
    { value: 'likes' as 'popular' | 'newest' | 'oldest' | 'likes', label: labels.likes },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <TrendingUp size={24} className="text-red-600" />
          <h1 className="text-2xl font-bold">{t('explore')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <SortMenu 
            value={sortBy} 
            onChange={setSortBy} 
            options={sortOptions} 
          />
        </div>
      </div>

      <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
              activeSection === section.id
                ? 'bg-white dark:bg-dark-text text-gray-900 dark:text-dark-bg'
                : 'bg-gray-100 dark:bg-dark-card text-gray-700 dark:text-dark-text-secondary hover:bg-gray-200 dark:hover:bg-dark-hover'
            }`}
          >
            <section.icon size={16} />
            {t(section.labelKey)}
          </button>
        ))}
      </div>

      <InfiniteVideoGrid
        fetchParams={fetchParams}
        pageSize={12}
        emptyState={
          <div className="text-center py-16 text-gray-500 dark:text-dark-text-muted">
            <p className="text-lg">{t('noVideosInCategory')}</p>
          </div>
        }
      />
    </div>
  );
}
