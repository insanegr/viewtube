import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import useStore from '../store/useStore';
import InfiniteVideoGrid from '../components/InfiniteVideoGrid';
import { useLanguage } from '../i18n/LanguageContext';

export default function HomePage() {
  const { t, language } = useLanguage();
  const videos = useStore((s) => s.videos);
  const categories = useStore((s) => s.categories);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const selectedCategories = useStore((s) => s.selectedCategories);
  const matchAllCategories = useStore((s) => s.matchAllCategories);
  const clearCategoryFilters = useStore((s) => s.clearCategoryFilters);
  const toggleCategoryFilter = useStore((s) => s.toggleCategoryFilter);

  // Homepage chips remain single-select, but sidebar can multi-select.
  const activeCategory = selectedCategories.length === 1 ? selectedCategories[0] : null;

  const setActiveCategory = (cat: string | null) => {
    clearCategoryFilters();
    if (cat) toggleCategoryFilter(cat);
  };

  const publicVideos = videos.filter((v) => v.visibility === 'public');
  const filtered = selectedCategories.length === 0
    ? publicVideos
    : publicVideos.filter((v) => matchAllCategories
        ? selectedCategories.every((cat) => v.categories.includes(cat))
        : selectedCategories.some((cat) => v.categories.includes(cat))
      );

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeftArrow(scrollLeft > 10);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
  };

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
  };

  const handleChipClick = (catName: string) => {
    setActiveCategory(activeCategory === catName ? null : catName);
  };

  return (
    <div>
      {/* YouTube-style horizontal category chips — single select */}
      <div className="relative mb-5 -mx-4 sm:-mx-6 px-4 sm:px-6">
        {showLeftArrow && (
          <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center pl-4 sm:pl-6">
            <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-gray-50 dark:from-dark-bg to-transparent pointer-events-none" />
            <button onClick={() => scroll('left')} className="relative z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white dark:bg-dark-card shadow border border-gray-200 dark:border-dark-border-light hover:bg-gray-50 dark:hover:bg-dark-hover">
              <ChevronLeft size={18} />
            </button>
          </div>
        )}

        <div ref={scrollRef} onScroll={handleScroll} className="flex gap-2.5 overflow-x-auto scrollbar-hide py-1">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap flex-shrink-0 transition ${
              activeCategory === null
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                : 'bg-gray-100 dark:bg-dark-card text-gray-700 dark:text-dark-text-secondary hover:bg-gray-200 dark:hover:bg-dark-hover'
            }`}
          >
            {t('all')}
          </button>

          {categories.map((cat) => {
            const isActive = activeCategory === cat.name;
            const displayName = language === 'el' ? cat.nameEl : cat.name;
            return (
              <button
                key={cat.id}
                onClick={() => handleChipClick(cat.name)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap flex-shrink-0 transition ${
                  isActive
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                    : 'bg-gray-100 dark:bg-dark-card text-gray-700 dark:text-dark-text-secondary hover:bg-gray-200 dark:hover:bg-dark-hover'
                }`}
              >
                {displayName}
              </button>
            );
          })}
        </div>

        {showRightArrow && (
          <div className="absolute right-0 top-0 bottom-0 z-10 flex items-center pr-4 sm:pr-6">
            <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-gray-50 dark:from-dark-bg to-transparent pointer-events-none" />
            <button onClick={() => scroll('right')} className="relative z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white dark:bg-dark-card shadow border border-gray-200 dark:border-dark-border-light hover:bg-gray-50 dark:hover:bg-dark-hover">
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>

      <InfiniteVideoGrid
        videos={filtered}
        pageSize={12}
        emptyState={
          <div className="text-center py-20 text-gray-500 dark:text-dark-text-muted">
            <p className="text-lg">{t('noVideosFound')}</p>
            <p className="text-sm mt-1">{t('tryDifferentCategory')}</p>
          </div>
        }
      />
    </div>
  );
}
