import { usePlayerStore } from '../store/playerStore';
import { useNavigationStore } from '../store/navigationStore';
import { usePlaylistStore } from '../store/playlistStore';
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WavySeparator } from './WavySeparator';
import type { AppView } from '../types';

import {
    IconHome,
    IconAlbum,
    IconMicrophone,
    IconSettings,
    IconDownload,
    IconHeart,
    IconStats,
    IconMusicNote,
} from './Icons';

interface SidebarProps {
    view: AppView;
    onViewChange: (view: AppView) => void;
}

const sidebarSpring = {
    type: "spring",
    stiffness: 1400,
    damping: 90,
    mass: 1
} as const;

export function Sidebar({ view, onViewChange }: SidebarProps) {
    const { library } = usePlayerStore();
    const { isLeftSidebarCollapsed, toggleLeftSidebar } = useNavigationStore();
    const isCollapsed = isLeftSidebarCollapsed; // Alias for cleaner code below

    useEffect(() => {
        usePlaylistStore.getState().fetchPlaylists();
    }, []);

    const playlists = usePlaylistStore(state => state.playlists);
    const recentlyAddedToPlaylist = usePlaylistStore(state => state.recentlyAddedToPlaylist);
    // Use store hook for reactivity instead of getState in render
    const currentView = useNavigationStore(state => state.view);
    const activePlaylistId = useNavigationStore(state => state.activePlaylistId);

    return (
        <motion.aside
            initial={false}
            animate={{ width: isCollapsed ? 88 : 320 }}
            transition={sidebarSpring}
            className={`
                h-full flex flex-col
                bg-surface-container 
                z-20 border-r border-transparent rounded-[2rem] overflow-hidden shadow-sm
            `}
        >
            {/* Toggle Button - Minimal header */}
            <div data-tauri-drag-region className={`h-14 flex items-center px-4 shrink-0 ${isCollapsed ? 'justify-center' : 'justify-end'}`}>
                <button
                    onClick={toggleLeftSidebar}
                    className="p-2.5 rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
                    title={isCollapsed ? "Expand" : "Collapse"}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
                    </svg>
                </button>
            </div>

            {/* Navigation - Centered in collapsed mode */}
            <nav className={`flex-1 px-4 py-2 flex flex-col gap-1 overflow-y-auto no-scrollbar ${isCollapsed ? 'items-center' : ''}`}>

                {/* Library Section */}
                <div className={`flex flex-col gap-1 ${isCollapsed ? 'items-center w-full' : ''}`}>
                    <NavItem
                        icon={<IconHome size={28} />}
                        label="Home"
                        active={view === 'home'}
                        onClick={() => onViewChange('home')}
                        collapsed={isCollapsed}
                    />
                    <NavItem
                        icon={<IconMusicNote size={28} />}
                        label="Songs"
                        active={view === 'tracks'}
                        onClick={() => onViewChange('tracks')}
                        count={library.length}
                        collapsed={isCollapsed}
                    />
                    <NavItem
                        icon={<IconAlbum size={28} />}
                        label="Albums"
                        active={view === 'albums'}
                        onClick={() => onViewChange('albums')}
                        collapsed={isCollapsed}
                    />
                    <NavItem
                        icon={<IconMicrophone size={28} />}
                        label="Artists"
                        active={view === 'artists'}
                        onClick={() => onViewChange('artists')}
                        collapsed={isCollapsed}
                    />
                    <NavItem
                        icon={<IconHeart size={24} filled={view === 'favorites'} />}
                        label="Favorites"
                        active={view === 'favorites'}
                        onClick={() => onViewChange('favorites')}
                        count={usePlayerStore.getState().favorites.size}
                        collapsed={isCollapsed}
                    />
                </div>

                {/* Wavy Separator */}
                {!isCollapsed && (
                    <div className="px-2">
                        <WavySeparator label="" color="var(--md-sys-color-outline-variant)" />
                    </div>
                )}
                {isCollapsed && <div className="my-3 w-8 h-px bg-outline-variant/30" />}



                {/* Settings Section */}
                <div className={`flex flex-col gap-1 ${isCollapsed ? 'items-center w-full' : ''}`}>
                    <NavItem
                        icon={
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="4" x2="4" y1="21" y2="14" />
                                <line x1="4" x2="4" y1="10" y2="3" />
                                <line x1="12" x2="12" y1="21" y2="12" />
                                <line x1="12" x2="12" y1="8" y2="3" />
                                <line x1="20" x2="20" y1="21" y2="16" />
                                <line x1="20" x2="20" y1="12" y2="3" />
                                <line x1="2" x2="6" y1="14" y2="14" />
                                <line x1="10" x2="14" y1="8" y2="8" />
                                <line x1="18" x2="22" y1="16" y2="16" />
                            </svg>
                        }
                        label="Equalizer"
                        active={false} // Modal does not affect view state
                        onClick={() => usePlayerStore.getState().setShowEq(true)}
                        collapsed={isCollapsed}
                    />
                    <NavItem
                        icon={<IconDownload size={24} />}
                        label="Downloads"
                        active={view === 'torrents'}
                        onClick={() => onViewChange('torrents')}
                        collapsed={isCollapsed}
                    />
                    <NavItem
                        icon={<IconStats size={24} />}
                        label="Statistics"
                        active={view === 'statistics'}
                        onClick={() => onViewChange('statistics')}
                        collapsed={isCollapsed}
                    />



                    <NavItem
                        icon={<IconSettings size={28} />}
                        label="Settings"
                        active={view === 'settings'}
                        onClick={() => onViewChange('settings')}
                        collapsed={isCollapsed}
                    />
                </div>

                {/* Wavy Separator */}
                {!isCollapsed && (
                    <div className="px-2 mt-2">
                        <WavySeparator label="" color="var(--md-sys-color-outline-variant)" />
                    </div>
                )}

                {/* Playlists Section */}
                <div className={`flex flex-col gap-1 mt-2 ${isCollapsed ? 'items-center w-full' : ''}`}>
                    {!isCollapsed && (
                        <div className="px-4 py-2 flex items-center justify-between">
                            <span className="text-label-large text-on-surface-variant font-medium">Playlists</span>
                            <button
                                onClick={() => {
                                    const name = prompt("Enter playlist name:");
                                    if (name) usePlaylistStore.getState().createPlaylist(name);
                                }}
                                className="p-1 hover:bg-surface-container-high rounded-full text-on-surface-variant"
                                title="Create Playlist"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>
                            </button>
                        </div>
                    )}

                    {playlists.map(playlist => (
                        <NavItem
                            key={playlist.id}
                            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" /></svg>}
                            label={playlist.name}
                            active={currentView === 'playlist' && activePlaylistId === playlist.id}
                            isGlowing={recentlyAddedToPlaylist === playlist.id}
                            onClick={() => useNavigationStore.getState().navigateToPlaylist(playlist.id)}
                            collapsed={isCollapsed}
                        />
                    ))}
                </div>

            </nav>

            {/* Footer / Current Folder */}
            <div className={`p-4 shrink-0 flex flex-col gap-3 ${isCollapsed ? 'items-center' : ''}`}>
                {/* Current Folder Info */}

            </div>
        </motion.aside>
    );
}

function NavItem({
    icon,
    label,
    active = false,
    onClick,
    count,
    collapsed,
    isGlowing = false,
}: {
    icon: React.ReactNode;
    label: string;
    active?: boolean;
    onClick?: () => void;
    count?: number;
    collapsed: boolean;
    isGlowing?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            className={`
                group flex items-center relative
                transition-colors duration-200
                ${collapsed ? 'justify-center w-14 h-14 rounded-full' : 'w-full h-14 px-5 rounded-full gap-5'}
                ${active
                    ? 'bg-secondary-container text-on-secondary-container font-semibold'
                    : isGlowing
                        ? 'text-primary font-bold'
                        : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }
            `}
            title={collapsed ? label : undefined}
        >
            {/* Active Indicator (Overlay) */}
            {active && (
                <motion.div
                    layoutId="activeNavParams"
                    className="absolute inset-0 rounded-full bg-on-secondary-container/5 pointer-events-none"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
            )}

            {/* Glow Animation */}
            {isGlowing && (
                <motion.div
                    layoutId="glowNavParams"
                    className="absolute inset-0 rounded-full bg-primary/20 pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                />
            )}

            {/* +1 Floating Animation */}
            <AnimatePresence>
                {isGlowing && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.5, x: 20 }}
                        animate={{ opacity: 1, y: 0, scale: 1.2, x: 20 }}
                        exit={{ opacity: 0, y: -20, scale: 0.8, x: 20 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        className="absolute right-8 top-4 z-50 text-primary font-bold text-title-medium pointer-events-none"
                    >
                        +1
                    </motion.div>
                )}
            </AnimatePresence>

            <span className="z-10 relative">{icon}</span>

            {!collapsed && (
                <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-title-medium whitespace-nowrap overflow-hidden text-ellipsis z-10 flex-1 text-left"
                >
                    {label}
                </motion.span>
            )}

            {!collapsed && count !== undefined && (
                <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`text-label-medium z-10 ${active ? 'text-on-secondary-container/70' : 'text-on-surface-variant/60'}`}
                >
                    {count}
                </motion.span>
            )}
        </button>
    );
}
