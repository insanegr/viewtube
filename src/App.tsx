import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { LanguageProvider } from './i18n/LanguageContext';
import { ThemeProvider } from './theme/ThemeContext';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmDialog';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import MiniPlayer from './components/MiniPlayer';
import HomePage from './pages/HomePage';
import WatchPage from './pages/WatchPage';
import UploadPage from './pages/UploadPage';
import ProfilePage from './pages/ProfilePage';
import PlaylistPage from './pages/PlaylistPage';
import SearchPage from './pages/SearchPage';
import ExplorePage from './pages/ExplorePage';
import SubscriptionsPage from './pages/SubscriptionsPage';
import LibraryPage from './pages/LibraryPage';
import LikedPage from './pages/LikedPage';
import AdminPage from './pages/AdminPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import ChannelPage from './pages/ChannelPage';
import HistoryPage from './pages/HistoryPage';
import AnalyticsPage from './pages/AnalyticsPage';
import QueuePage from './pages/QueuePage';
import WatchLaterPage from './pages/WatchLaterPage';
import ImportPage from './pages/ImportPage';
import BackupPage from './pages/BackupPage';
import RecoveryRequestsPage from './pages/RecoveryRequestsPage';
import useStore from './store/useStore';

// Wrapper that redirects to /login if not authenticated
function RequireAuth({ children }: { children: React.ReactNode }) {
  const currentUser = useStore((s) => s.currentUser);
  const isLoggedIn = currentUser.id !== '';
  const location = useLocation();
  if (!isLoggedIn) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

function AppContent() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();
  const miniPlayer = useStore((s) => s.miniPlayer);
  const updateMiniPlayer = useStore((s) => s.updateMiniPlayer);
  const prevPathRef = useRef(location.pathname + location.search);

  const isAuthPage = location.pathname === '/login';

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(true);
      else setSidebarOpen(false);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location.pathname, location.search, isMobile]);

  // Reliably activate mini player when leaving a watch page while playback is active.
  useEffect(() => {
    const prev = prevPathRef.current;
    const curr = location.pathname + location.search;
    const wasWatch = prev.startsWith('/watch/');
    const isWatch = location.pathname.startsWith('/watch/');

    if (wasWatch && !isWatch && miniPlayer.enabled && miniPlayer.videoId && miniPlayer.isPlaying && !isMobile) {
      updateMiniPlayer({ active: true });
    }

    prevPathRef.current = curr;
  }, [location.pathname, location.search, miniPlayer.enabled, miniPlayer.videoId, miniPlayer.isPlaying, isMobile, updateMiniPlayer]);

  if (isAuthPage) {
    return <Routes><Route path="/login" element={<LoginPage />} /></Routes>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg text-gray-900 dark:text-dark-text">
      <Header onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
      {isMobile && sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setSidebarOpen(false)} />}
      <Sidebar isOpen={sidebarOpen} isMobile={isMobile} />
      <main className={`pt-14 transition-all duration-200 ${!isMobile && sidebarOpen ? 'lg:ml-60' : !isMobile ? 'lg:ml-[72px]' : 'ml-0'} ${isMobile ? 'pb-14' : ''}`}>
        <div className="p-3 sm:p-4 lg:p-6">
          <Routes>
            {/* Public routes — anyone can browse and watch */}
            <Route path="/" element={<HomePage />} />
            <Route path="/watch/:id" element={<WatchPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/channel/:id" element={<ChannelPage />} />

            {/* Protected routes — require login */}
            <Route path="/upload" element={<RequireAuth><UploadPage /></RequireAuth>} />
            <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
            <Route path="/playlist/:id" element={<RequireAuth><PlaylistPage /></RequireAuth>} />
            <Route path="/subscriptions" element={<RequireAuth><SubscriptionsPage /></RequireAuth>} />
            <Route path="/library" element={<RequireAuth><LibraryPage /></RequireAuth>} />
            <Route path="/liked" element={<RequireAuth><LikedPage /></RequireAuth>} />
            <Route path="/admin" element={<RequireAuth><AdminPage /></RequireAuth>} />
            <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
            <Route path="/history" element={<RequireAuth><HistoryPage /></RequireAuth>} />
            <Route path="/analytics" element={<RequireAuth><AnalyticsPage /></RequireAuth>} />
            <Route path="/queue" element={<RequireAuth><QueuePage /></RequireAuth>} />
            <Route path="/watch-later" element={<RequireAuth><WatchLaterPage /></RequireAuth>} />
            <Route path="/import" element={<RequireAuth><ImportPage /></RequireAuth>} />
            <Route path="/backups" element={<RequireAuth><BackupPage /></RequireAuth>} />
            <Route path="/recovery-requests" element={<RequireAuth><RecoveryRequestsPage /></RequireAuth>} />
          </Routes>
        </div>
      </main>
      {isMobile && <MobileNav />}
      <MiniPlayer isMobile={isMobile} />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <ToastProvider>
          <ConfirmProvider>
            <BrowserRouter>
              <AppContent />
            </BrowserRouter>
          </ConfirmProvider>
        </ToastProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}
