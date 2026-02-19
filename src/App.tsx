import { lazy, Suspense, useEffect } from 'react';
import { TrackList } from './components/TrackList';
import { PlayerBar } from './components/PlayerBar';
const SettingsPage = lazy(() => import('./components/SettingsPage').then(m => ({ default: m.SettingsPage })));
const StatisticsPage = lazy(() => import('./components/StatisticsPage').then(m => ({ default: m.StatisticsPage })));

// Lazy-loaded views — defers ~130KB JS parsing until first visit
const TorrentManager = lazy(() => import('./components/TorrentManager').then(m => ({ default: m.TorrentManager })));
import { ImmersiveView } from './components/ImmersiveView';
import { PlaylistView } from './components/PlaylistView';
import { SkeletonAlbumGrid, SkeletonTrackList } from './components/Skeleton';


import { GlobalEffects } from './components/GlobalEffects';
import { MiniPlayer } from './components/MiniPlayer';
import { useNavigationStore } from './store/navigationStore';
import { useShallow } from 'zustand/react/shallow';
import { useToastStore } from './store/toastStore';
import { PlaylistDialog } from './components/PlaylistDialog';
import { useMediaSession } from './hooks/useMediaSession';
import { usePlayerStore } from './store/playerStore';
import { AnimatePresence } from 'motion/react';
import { useSettingsStore } from './store/settingsStore';
import { ThemeManager } from './components/ThemeManager';
import { AmbientBackground } from './components/AmbientBackground';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { AlbumGrid } from './components/AlbumGrid';
import { ArtistList } from './components/ArtistList';
import { FavoritesView } from './components/FavoritesView';
import { RightPanel } from './components/RightPanel';
import { LyricsPanel } from './components/LyricsPanel';
import { Equalizer } from './components/Equalizer';
import { Toast } from './components/Toast';

function App() {
  useMediaSession(); // Initialize System Media Controls

  // OPTIMIZATION: Only subscribe to what affects LAYOUT or initial setup
  const { loadLibrary, syncAudioSettings, refreshStatus, immersiveMode, showEq } = usePlayerStore(
    useShallow(state => ({
      loadLibrary: state.loadLibrary,
      syncAudioSettings: state.syncAudioSettings,
      refreshStatus: state.refreshStatus,
      immersiveMode: state.immersiveMode,
      showEq: state.showEq
    }))
  );

  const { view, setView, isRightPanelOpen, setRightPanelOpen, isRightPanelCollapsed, setLeftSidebarCollapsed } = useNavigationStore();

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 1280) {
        setLeftSidebarCollapsed(true);
      } else {
        setLeftSidebarCollapsed(false);
      }

      if (width >= 1536) {
        setRightPanelOpen(true);
      } else {
        setRightPanelOpen(false);
      }
    };

    handleResize();
    loadLibrary();
    syncAudioSettings();
    refreshStatus();

    // Listen for library scan progress
    const showToast = useToastStore.getState().showToast;

    // Use type assertion for window to avoid TS errors with __TAURI__
    const tauriWindow = window as any;
    if (tauriWindow.__TAURI__) {
      let scanStarted = false;
      let lastProgressPct = -1;

      const unlistenProgress = tauriWindow.__TAURI__.event.listen('library-scan-progress', (event: any) => {
        const { processed, total } = event.payload;

        // Show a "scan started" toast on the very first event
        if (!scanStarted) {
          scanStarted = true;
          showToast(`Scanning library… (${total} files found)`);
        }

        // Show progress every ~10% of total (minimum every 50 songs)
        const step = Math.max(50, Math.floor(total * 0.1));
        const pct = Math.floor((processed / total) * 10); // 0-10 buckets
        if (pct !== lastProgressPct && processed % step === 0) {
          lastProgressPct = pct;
          showToast(`Library scan: ${processed} / ${total}`);
        }

        // Completion toast
        if (processed === total && total > 0) {
          showToast(`✓ Library scan complete — ${total} tracks processed`);
        }
      });

      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
        unlistenProgress.then((f: any) => f());
      };
    } else {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [loadLibrary, setRightPanelOpen, setLeftSidebarCollapsed, syncAudioSettings, refreshStatus]);

  const { expandedArtMode } = useSettingsStore();

  const miniPlayer = usePlayerStore(state => state.miniPlayer);

  if (miniPlayer) {
    return (
      <>
        <GlobalEffects />
        <ThemeManager />
        <MiniPlayer />
      </>
    )
  }

  return (
    <div>
      <GlobalEffects />
      <ThemeManager />
      <PlaylistDialog />
      {expandedArtMode === 'background' && <AmbientBackground />}
      <TitleBar />

      {/* Main Container - Floating Grid for Sidebar + Content + RightPanel */}
      <div className="fixed inset-0 top-10 flex p-3 gap-1 overflow-hidden text-on-surface">

        {/* Sidebar */}
        <div className="shrink-0 h-full z-20 bg-surface-container-low rounded-[2rem]">
          <Sidebar view={view} onViewChange={setView} />
        </div>

        {/* Center: Main Content Area (Floating Card) */}
        <div className="flex-1 flex flex-col min-w-0 relative bg-surface overflow-hidden z-10 transition-all duration-300 rounded-[2rem]">

          {/* Main Content Area */}
          <main className="flex-1 flex flex-col min-h-0 relative">
            {/* Header Area with drag region */}
            <div className="shrink-0">
              <Header view={view} onViewChange={setView} />
            </div>

            {/* Scrollable Content Container */}
            <div className="flex-1 overflow-hidden relative"> {/* Edge-to-edge: content flows behind pill */}
              {view === 'tracks' && <TrackList />}
              {view === 'albums' && <AlbumGrid />}
              {view === 'artists' && <ArtistList />}
              {view === 'favorites' && <FavoritesView />}
              {view === 'playlist' && <PlaylistView />}
              <Suspense fallback={
                <div className="flex-1 flex items-center justify-center text-on-surface-variant/50 p-6">
                  {view === 'albums' ? <SkeletonAlbumGrid /> : <SkeletonTrackList />}
                </div>
              }>
                {view === 'statistics' && <StatisticsPage />}
                {view === 'settings' && <SettingsPage />}
                {view === 'torrents' && <TorrentManager />}
              </Suspense>
            </div>

          </main>

          {/* Player Bar - Constrained to Middle Column */}
          <PlayerBar />

        </div>

        {/* Right Panel (Floating Card) */}
        {/* Responsive Logic:
            - xl+: Relative (pushes content), toggles width/opacity
            - <xl: Fixed/Absolute overlay, toggles translate/opacity
        */}
        <aside
          className={`
            bg-surface-container z-30 overflow-hidden transition-all duration-300 rounded-[2rem]
            fixed right-3 top-[3.25rem] bottom-28 shadow-2xl
            2xl:relative 2xl:right-auto 2xl:top-auto 2xl:bottom-auto 2xl:shadow-none 2xl:block

            ${isRightPanelOpen
              ? `translate-x-0 opacity-100 ${isRightPanelCollapsed ? 'w-[4.5rem]' : 'w-[25rem]'}`
              : 'translate-x-[110%] opacity-0 pointer-events-none 2xl:w-0 2xl:translate-x-0'
            }
          `}
        >
          <RightPanel />
        </aside>
      </div >



      {/* Lyrics Panel Overlay */}
      <LyricsPanel />
      <Toast />

      <AnimatePresence>
        {immersiveMode && (
          <ImmersiveView />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEq && (
          <Equalizer />
        )}
      </AnimatePresence>

    </div>

  );
}

export default App;
