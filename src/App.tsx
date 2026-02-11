import { TrackList } from './components/TrackList';
import { PlayerBar } from './components/PlayerBar';
// import './App.css'; // Removed styling

import { useMediaSession } from './hooks/useMediaSession';
import { useEffect, useRef, lazy, Suspense } from 'react';
import { usePlayerStore } from './store/playerStore';
import { useMobileStore } from './store/mobileStore';
import { useSettingsStore } from './store/settingsStore';
import { useLyricsStore } from './store/lyricsStore';

import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { RightPanel } from './components/RightPanel';
import { AlbumGrid } from './components/AlbumGrid';
import { ArtistList } from './components/ArtistList';
import { LyricsPanel } from './components/LyricsPanel';
import { ThemeManager } from './components/ThemeManager';
import { FavoritesView } from './components/FavoritesView';
import { AmbientBackground } from './components/AmbientBackground';
import { AnimatePresence } from 'motion/react';

// Lazy-loaded views — defers ~130KB JS parsing until first visit
const SettingsPage = lazy(() => import('./components/SettingsPage').then(m => ({ default: m.SettingsPage })));
const YouTubeMusic = lazy(() => import('./components/YouTubeMusic').then(m => ({ default: m.YouTubeMusic })));
const TorrentManager = lazy(() => import('./components/TorrentManager').then(m => ({ default: m.TorrentManager })));
const StatisticsPage = lazy(() => import('./components/StatisticsPage').then(m => ({ default: m.StatisticsPage })));
import { ImmersiveView } from './components/ImmersiveView';


import { useNavigationStore } from './store/navigationStore';

function App() {
  useMediaSession(); // Initialize System Media Controls
  const { loadLibrary, status, pause, resume, playFile, immersiveMode } = usePlayerStore();
  const { view, setView } = useNavigationStore();

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  const { fetchLyrics } = useLyricsStore();

  // Global Lyrics Fetcher — Ensure lyrics start loading as soon as track changes, regardless of current view
  useEffect(() => {
    if (status.track?.path) {
      console.log('[Lyrics] Global trigger for:', status.track.title);
      fetchLyrics(
        status.track.artist || '',
        status.track.title || '',
        status.track.duration_secs || 0,
        status.track.path
      );
    }
  }, [status.track?.path, status.track?.title, status.track?.artist, fetchLyrics]);

  // Restore Volume
  useEffect(() => {
    const { savedVolume, setVolume } = usePlayerStore.getState();
    setVolume(savedVolume);
  }, []);

  // Global spacebar play/pause handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault(); // Prevent page scroll
        if (status.state === 'Playing') {
          pause();
        } else if (status.state === 'Paused') {
          resume();
        } else if (status.state === 'Stopped' && status.track) {
          playFile(status.track.path);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status.state, status.track, pause, resume, playFile]);

  // Listen for Native Windows Media Events
  useEffect(() => {
    import('@tauri-apps/api/event').then(({ listen }) => {
      const unlisten = Promise.all([
        listen('media:play', () => resume()),
        listen('media:pause', () => pause()),
        listen('media:next', () => usePlayerStore.getState().nextTrack()), // Use getState to avoid dependency cycle/stale closure
        listen('media:prev', () => usePlayerStore.getState().prevTrack()),
        listen('media:toggle', () => {
          const store = usePlayerStore.getState();
          if (store.status.state === 'Playing') store.pause();
          else store.resume();
        }),
        listen('media:stop', () => usePlayerStore.getState().stop()),

        // Listen for Mobile Connection Events
        listen('mobile_client_connected', (event: any) => {
          console.log('[Mobile] Client connected event:', event.payload);
          const { client_id, client_name } = event.payload;
          // Update store
          const device = {
            id: client_id,
            name: client_name || 'Mobile Device',
            ip: 'unknown',
            port: 0,
            connectedAt: Date.now(),
            platform: 'android', // assume android for now or get from payload if available
          };

          // Use the store instance to update state
          useMobileStore.getState().setConnectedDevice(device);
        }),

        listen('mobile_client_disconnected', (event: any) => {
          console.log('[Mobile] Client disconnected event:', event.payload);
          useMobileStore.getState().disconnect();
        }),

        // Listen for player state refreshes (e.g. from mobile remote control)
        listen('refresh-player-state', () => {
          console.log('[Native] Refreshing player state from backend event');
          usePlayerStore.getState().refreshStatus();
        }),

        // Listen for output changes (triggered from mobile or PC UI)
        listen('output-changed', (event: any) => {
          console.log('[Output] Output changed:', event.payload);
          const { output } = event.payload;
          const playerStore = usePlayerStore.getState();

          if (output === 'mobile') {
            // Mobile playback starting - pause PC
            console.log('[Output] Switching to mobile playback');
            playerStore.pause();
          } else if (output === 'desktop') {
            // Desktop playback resuming
            console.log('[Output] Switching to desktop playback');
            // Note: resume is handled by the mobile app stopping, not here
          }
        }),
      ]);

      return () => {
        unlisten.then(unlisteners => unlisteners.forEach(u => u()));
      };
    });
  }, [resume, pause]); // Dependencies logic handled inside or via getState

  // Autoplay: when track ends, play next track if enabled (respects repeat mode)
  const autoplay = useSettingsStore(state => state.autoplay);
  const lastTrackPathRef = useRef<string | null>(null);

  useEffect(() => {
    // Only trigger autoplay for local source
    const store = usePlayerStore.getState();
    if (status.state !== 'Playing' || !status.track || store.activeSource !== 'local') {
      return;
    }

    const duration = status.track.duration_secs;
    const position = status.position_secs;

    // Check if track has ended (position within 0.5s of duration)
    if (duration > 0 && position >= duration - 0.5) {
      // Prevent double-triggers for same track
      if (lastTrackPathRef.current === status.track.path) {
        return;
      }

      // Mark as triggered
      lastTrackPathRef.current = status.track.path;

      // Small delay to allow state to settle?
      setTimeout(() => {
        const { repeatMode, nextTrack, getCurrentTrackIndex } = usePlayerStore.getState();

        console.log('[Autoplay] Track ended. Repeat:', repeatMode);

        if (repeatMode === 'one') {
          // handled by PlayerBar effect logic usually, but here for safety
          usePlayerStore.getState().playFile(status.track!.path);
        } else if (repeatMode === 'all') {
          nextTrack();
        } else if (repeatMode === 'off') {
          // If 'off', we still want to play next track in queue/playlist, 
          // but stop if we are at the end of the queue.
          // However, standard player behavior usually plays next in queue even if repeat is off, 
          // unless it's the very last track.
          const currentIndex = getCurrentTrackIndex();
          if (currentIndex >= store.queue.length - 1) {
            // End of queue
            console.log('[Autoplay] End of queue reached.');
            if (autoplay) {
              console.log('[Autoplay] Autoplay enabled, picking random album...');
              store.playRandomAlbum();
            } else {
              store.pause(); // Just stop
            }
          } else {
            nextTrack();
          }
        } else if (autoplay) {
          // Normal autoplay (no repeat)
          const currentIndex = getCurrentTrackIndex();
          if (currentIndex >= store.queue.length - 1) {
            // Queue ended! Play a random album as requested
            console.log('[Autoplay] Queue ended! Picking a random album...');
            store.playRandomAlbum();
          } else {
            nextTrack();
          }
        }
      }, 300);
    }
  }, [status.position_secs, status.state, status.track, autoplay]);

  // Reset lastTrackPath when track changes
  useEffect(() => {
    if (status.track?.path && status.track.path !== lastTrackPathRef.current) {
      lastTrackPathRef.current = null;
    }
  }, [status.track?.path]);

  const { expandedArtMode } = useSettingsStore();

  return (
    <div>
      <ThemeManager />
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
              <Suspense fallback={<div className="flex-1 flex items-center justify-center text-on-surface-variant/50"><div className="animate-pulse">Loading...</div></div>}>
                {view === 'statistics' && <StatisticsPage />}
                {view === 'settings' && <SettingsPage />}
                {view === 'ytmusic' && <YouTubeMusic />}
                {view === 'torrents' && <TorrentManager />}
              </Suspense>
            </div>

          </main>

          {/* Player Bar - Constrained to Middle Column */}
          <PlayerBar />

        </div>

        {/* Right Panel (Floating Card) */}
        <aside className="w-[25rem] bg-surface-container z-20 hidden xl:block overflow-hidden transition-all duration-300 rounded-[2rem]">
          <RightPanel />
        </aside>
      </div >



      {/* Lyrics Panel Overlay */}
      <LyricsPanel />

      <AnimatePresence>
        {immersiveMode && (
          <ImmersiveView />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
