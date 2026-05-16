import { useState } from 'react';
import useStore from '../store/useStore';
import InfiniteVideoGrid from '../components/InfiniteVideoGrid';
import { TrendingUp, Flame, Music, Gamepad2, GraduationCap } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export default function ExplorePage() {
  const [activeSection, setActiveSection] = useState('trending');
  const videos = useStore((s) => s.videos);
  const { t } = useLanguage();
  const publicVideos = videos.filter((v) => v.visibility === 'public');

  const SECTIONS = [
    { id: 'trending', labelKey: 'trending' as const, icon: Flame },
    { id: 'Music', labelKey: 'music' as const, icon: Music },
    { id: 'Gaming', labelKey: 'gaming' as const, icon: Gamepad2 },
    { id: 'Education', labelKey: 'learning' as const, icon: GraduationCap },
  ];

  const filtered =
    activeSection === 'trending'
      ? [...publicVideos].sort((a, b) => b.views - a.views)
      : publicVideos.filter((v) => v.categories.includes(activeSection));

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp size={24} className="text-red-600" />
        <h1 className="text-2xl font-bold">{t('explore')}</h1>
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
        videos={filtered}
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
