import { useSearchParams } from 'react-router-dom';
import useStore from '../store/useStore';
import InfiniteVideoGrid from '../components/InfiniteVideoGrid';
import { useLanguage } from '../i18n/LanguageContext';

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const videos = useStore((s) => s.videos);
  const { t } = useLanguage();

  const results = videos.filter(
    (v) =>
      v.visibility === 'public' &&
      (v.title.toLowerCase().includes(query.toLowerCase()) ||
        v.description.toLowerCase().includes(query.toLowerCase()) ||
        v.channelName.toLowerCase().includes(query.toLowerCase()) ||
        v.categories.some((cat) => cat.toLowerCase().includes(query.toLowerCase())))
  );

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">
        {t('searchResultsFor')}: <span className="text-blue-600 dark:text-blue-400">"{query}"</span>
      </h1>
      <p className="text-sm text-gray-500 dark:text-dark-text-muted mb-6">
        {results.length} {t('resultsFound')}
      </p>

      <InfiniteVideoGrid
        videos={results}
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
