import { lazy, Suspense, useEffect } from 'react';
import { TrackList } from '@/components/library/TrackList';
import { PlayerBar } from '@/components/playback/PlayerBar';
const loadSettingsPage = () => import('@/components/system/SettingsPage').then(m => ({ default: m.SettingsPage }));
const loadStatistics2 = () => import('@/components/stats/Statistics2').then(m => ({ default: m.Statistics2 }));
const loadTorrentManager = () => import('@/components/torrent/TorrentManager').then(m => ({ default: m.TorrentManager }));

const SettingsPage = lazy(loadSettingsPage);
const Statistics2 = lazy(loadStatistics2);

// Lazy-loaded views — defers ~130KB JS parsing until first visit
const TorrentManager = lazy(loadTorrentManager);
import { ImmersiveView } from '@/components/playback/ImmersiveView';
import { PlaylistView } from '@/components/playlist/PlaylistView';
import { HomeView } from '@/components/library/HomeView';
import { SkeletonAlbumGrid, SkeletonTrackList } from '@/components/common/Skeleton';


import { GlobalEffects } from '@/components/system/GlobalEffects';
import { MiniPlayer } from '@/components/playback/MiniPlayer';
import { useNavigationStore } from './store/navigationStore';
import { useShallow } from 'zustand/react/shallow';
import { useToastStore } from './store/toastStore';
import { PlaylistDialog } from '@/components/playlist/PlaylistDialog';
import { useMediaSession } from './hooks/useMediaSession';
import { usePlayerStore } from './store/playerStore';
import { AnimatePresence } from 'motion/react';
import { useSettingsStore } from './store/settingsStore';
import { ThemeManager } from '@/components/system/ThemeManager';
import { AmbientBackground } from '@/components/layout/AmbientBackground';
import { TitleBar } from '@/components/layout/TitleBar';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { AlbumGrid } from '@/components/library/AlbumGrid';
import { ArtistList } from '@/components/library/ArtistList';
import { FavoritesView } from '@/components/library/FavoritesView';
import { RightPanel } from '@/components/layout/RightPanel';
import { LyricsPanel } from '@/components/playback/LyricsPanel';
import { Equalizer } from '@/components/playback/Equalizer';
import { Toast } from '@/components/system/Toast';
import { PlaylistCreationWizard } from '@/components/playlist/PlaylistCreationWizard';
import { usePlaylistStore } from './store/playlistStore';

type LibraryScanProgressPayload = {
  processed: number;
  total: number;
};

type TauriListenEvent<TPayload> = {
  payload: TPayload;
};

type TauriWindowBridge = Window & {
  __TAURI__?: {
    event?: {
      listen: (
        eventName: string,
        handler: (event: TauriListenEvent<LibraryScanProgressPayload>) => void
      ) => Promise<() => void>;
    };
  };
};

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

  const { view, setView, isRightPanelOpen, setRightPanelOpen, isRightPanelCollapsed, setLeftSidebarCollapsed } = useNavigationStore(
    useShallow(state => ({
      view: state.view,
      setView: state.setView,
      isRightPanelOpen: state.isRightPanelOpen,
      setRightPanelOpen: state.setRightPanelOpen,
      isRightPanelCollapsed: state.isRightPanelCollapsed,
      setLeftSidebarCollapsed: state.setLeftSidebarCollapsed,
    }))
  );

  // Playlist wizard state
  const { isCreateWizardOpen, closeCreateWizard, createPlaylist } = usePlaylistStore(
    useShallow(state => ({
      isCreateWizardOpen: state.isCreateWizardOpen,
      closeCreateWizard: state.closeCreateWizard,
      createPlaylist: state.createPlaylist,
    }))
  );
  const library = usePlayerStore(s => s.library);
  const expandedArtMode = useSettingsStore(state => state.expandedArtMode);
  const rightPanelBg = useSettingsStore(state => state.rightPanelBg);
  const miniPlayer = usePlayerStore(state => state.miniPlayer);

  useEffect(() => {
    const preloadLazyViews = () => {
      void loadSettingsPage();
      void loadStatistics2();
      void loadTorrentManager();
    };

    const browserWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (browserWindow.requestIdleCallback) {
      const idleId = browserWindow.requestIdleCallback(preloadLazyViews, { timeout: 1800 });
      return () => {
        browserWindow.cancelIdleCallback?.(idleId);
      };
    }

    const timeoutId = window.setTimeout(preloadLazyViews, 1200);
    return () => window.clearTimeout(timeoutId);
  }, []);

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

    const tauriWindow = window as TauriWindowBridge;
    if (tauriWindow.__TAURI__?.event) {
      let scanStarted = false;
      let lastProgressPct = -1;

      const unlistenProgress = tauriWindow.__TAURI__.event.listen('library-scan-progress', (event) => {
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
        unlistenProgress.then((unlisten) => unlisten());
      };
    } else {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [loadLibrary, setRightPanelOpen, setLeftSidebarCollapsed, syncAudioSettings, refreshStatus]);

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
      <PlaylistCreationWizard 
        isOpen={isCreateWizardOpen}
        allSongs={library}
        onCreatePlaylist={createPlaylist}
        onClose={closeCreateWizard}
      />
      {expandedArtMode === 'background' && <AmbientBackground />}
      {!immersiveMode && <TitleBar />}

      {/* Main Container - Clean 3-column shell */}
      <div className="pc-shell-stage fixed inset-0 top-10 text-on-surface bg-black/20">
        <div className="pc-shell-row">

        {/* Left column */}
        <div className="pc-shell-left-slot shrink-0 overflow-hidden bg-surface-container">
          {/* Sidebar background tint to harmonize with dynamic right panel */}
          {rightPanelBg === 'dynamic' && (
            <div className="absolute inset-0 z-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.06), rgba(0,0,0,0.06))' }} />
          )}
          <Sidebar view={view} onViewChange={setView} />
        </div>

        {/* Center panel */}
        <div className="pc-shell-center flex flex-col relative bg-surface overflow-hidden transition-all duration-300">

          {/* Main Content Area */}
          <main className="flex-1 flex flex-col min-h-0 relative">
            {/* Header Area with drag region */}
            <div className="shrink-0">
              <Header view={view} onViewChange={setView} />
            </div>

            {/* Scrollable Content Container */}
            <div className="flex-1 overflow-hidden relative"> {/* Edge-to-edge: content flows behind pill */}
              {view === 'home' && <HomeView />}
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
                {view === 'statistics2' && <Statistics2 />}
                {view === 'settings' && <SettingsPage />}
                {view === 'torrents' && <TorrentManager />}
              </Suspense>
            </div>

          </main>

          {/* Player Bar - Constrained to Middle Column */}
          <PlayerBar />

        </div>

        {/* Right column */}
        <aside
          className={`
            pc-shell-right-slot bg-surface-container overflow-hidden transition-all duration-300

            ${isRightPanelOpen
              ? `opacity-100 ${isRightPanelCollapsed ? 'w-18' : 'w-100'}`
              : 'w-0 opacity-0 pointer-events-none'
            }
          `}
        >
          <RightPanel />
        </aside>
        </div>
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
