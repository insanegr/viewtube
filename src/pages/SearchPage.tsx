import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import InfiniteVideoGrid from '../components/InfiniteVideoGrid';
import { useLanguage } from '../i18n/LanguageContext';
import SortMenu from '../components/SortMenu';

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const { t, language } = useLanguage();

  const [sortBy, setSortBy] = useState<'relevance' | 'newest' | 'popular' | 'likes'>('relevance');

  const fetchParams = useMemo(() => ({
    search: query || undefined,
    sortBy: sortBy === 'relevance' ? 'newest' : sortBy,
    limit: 10
  }), [query, sortBy]);

  const labels = language === 'el' ? {
    relevance: 'Σχετικότητα',
    newest: 'Νεότερα',
    popular: 'Δημοφιλή',
    likes: 'Αγαπημένα',
  } : {
    relevance: 'Relevance',
    newest: 'Newest',
    popular: 'Popular',
    likes: 'Most Liked',
  };

  const sortOptions = [
    { value: 'relevance' as 'relevance' | 'newest' | 'popular' | 'likes', label: labels.relevance },
    { value: 'newest' as 'relevance' | 'newest' | 'popular' | 'likes', label: labels.newest },
    { value: 'popular' as 'relevance' | 'newest' | 'popular' | 'likes', label: labels.popular },
    { value: 'likes' as 'relevance' | 'newest' | 'popular' | 'likes', label: labels.likes },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold mb-1">
            {t('searchResultsFor')}: <span className="text-blue-600 dark:text-blue-400">"{query}"</span>
          </h1>
          <p className="text-sm text-gray-500 dark:text-dark-text-muted">
            {t('resultsFound')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SortMenu 
            value={sortBy} 
            onChange={setSortBy} 
            options={sortOptions} 
          />
        </div>
      </div>

      <InfiniteVideoGrid
        fetchParams={fetchParams}
        layout="list"
        pageSize={10}
        emptyState={
          <div className="text-center py-16 text-gray-500 dark:text-dark-text-muted">
            <p className="text-lg">{t('noResultsFound')}</p>
            <p className="text-sm mt-1">{t('tryDifferentKeywords')}</p>
          </div>
        }
      />
    </div>
  );
}
