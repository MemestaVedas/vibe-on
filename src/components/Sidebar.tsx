import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { usePlayerStore } from '../store/playerStore';

import {
    IconHome,
    IconAlbum,
    IconMicrophone,
    IconSettings,
    IconYoutube,
    IconPlus
} from './Icons';

interface SidebarProps {
    view: 'tracks' | 'albums' | 'artists' | 'settings' | 'ytmusic';
    onViewChange: (view: 'tracks' | 'albums' | 'artists' | 'settings' | 'ytmusic') => void;
}

export function Sidebar({ view, onViewChange }: SidebarProps) {
    const { scanFolder, currentFolder, library } = usePlayerStore();
    // Colors handled via CSS variables now
    const [isCollapsed, setIsCollapsed] = useState(false);

    const handleOpenFolder = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: 'Select Music Folder',
            });

            if (selected && typeof selected === 'string') {
                await scanFolder(selected);
            }
        } catch (e) {
            console.error('Failed to open folder:', e);
        }
    };

    return (
        <aside
            className={`
                h-full flex flex-col
                bg-surface-container 
                transition-all duration-300 ease-[var(--md-sys-motion-easing-emphasized)]
                ${isCollapsed ? 'w-[72px]' : 'w-64'}
                z-20 border-r border-transparent rounded-[2rem] overflow-hidden shadow-sm
            `}
        >
            {/* Logo / Brand / Toggle */}
            <div data-tauri-drag-region className="h-16 flex items-center px-4 justify-between shrink-0">
                {!isCollapsed && (
                    <h1 className="text-display-small font-bold text-primary tracking-tight truncate">VIBE-ON!</h1>
                )}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
                    title={isCollapsed ? "Expand" : "Collapse"}
                >
                    {/* Simple Hamburger/Menu Icon constructed with SVG since we might not have one imported */}
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
                    </svg>
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 flex flex-col gap-2 overflow-y-auto scrollbar-thin scrollbar-thumb-outline/20">

                {/* Library Section */}
                <div className="flex flex-col gap-1">
                    {!isCollapsed && <p className="px-4 py-2 text-label-medium font-medium text-on-surface-variant/80">Library</p>}

                    <NavItem
                        icon={<IconHome size={24} />}
                        label="Songs"
                        active={view === 'tracks'}
                        onClick={() => onViewChange('tracks')}
                        count={library.length}
                        collapsed={isCollapsed}
                    />
                    <NavItem
                        icon={<IconAlbum size={24} />}
                        label="Albums"
                        active={view === 'albums'}
                        onClick={() => onViewChange('albums')}
                        collapsed={isCollapsed}
                    />
                    <NavItem
                        icon={<IconMicrophone size={24} />}
                        label="Artists"
                        active={view === 'artists'}
                        onClick={() => onViewChange('artists')}
                        collapsed={isCollapsed}
                    />
                </div>

                <div className="my-2 h-px bg-transparent mx-2" />

                {/* Online Music Section */}
                <div className="flex flex-col gap-1">
                    {!isCollapsed && <p className="px-4 py-2 text-label-medium font-medium text-on-surface-variant/80">Online</p>}
                    <NavItem
                        icon={<IconYoutube size={24} />}
                        label="YouTube Music"
                        active={view === 'ytmusic'}
                        onClick={() => onViewChange('ytmusic')}
                        collapsed={isCollapsed}
                    />
                </div>

                <div className="my-2 h-px bg-transparent mx-2" />

                {/* Settings Section */}
                <div className="flex flex-col gap-1">
                    <NavItem
                        icon={<IconSettings size={24} />}
                        label="Settings"
                        active={view === 'settings'}
                        onClick={() => onViewChange('settings')}
                        collapsed={isCollapsed}
                    />
                </div>

            </nav>

            {/* Footer / Current Folder */}
            <div className="p-3 shrink-0 flex flex-col gap-2">
                {/* Current Folder Info */}
                {
                    !isCollapsed && currentFolder && (
                        <div className="px-4 py-2 bg-surface-container-high rounded-lg mb-2">
                            <p className="text-label-small text-on-surface-variant uppercase tracking-wider">Source</p>
                            <p className="text-body-small font-medium text-on-surface truncate" title={currentFolder}>
                                {currentFolder.split('\\').pop()}
                            </p>
                        </div>
                    )
                }

                {/* Add Folder Button - FAB style when collapsed, extended when expanded */}
                <button
                    onClick={handleOpenFolder}
                    className={`
                        flex items-center justify-center gap-3
                        bg-tertiary-container hover:bg-tertiary-container/80 text-on-tertiary-container
                        transition-all duration-300 shadow-elevation-1
                        ${isCollapsed ? 'h-14 w-14 rounded-2xl' : 'h-14 w-full rounded-2xl px-6'}
                    `}
                    title="Add Folder"
                >
                    <IconPlus size={24} />
                    {!isCollapsed && <span className="font-semibold text-label-large">Add Folder</span>}
                </button>
            </div>
        </aside>
    );
}

function NavItem({
    icon,
    label,
    active = false,
    onClick,
    count,
    collapsed,
}: {
    icon: React.ReactNode;
    label: string;
    active?: boolean;
    onClick?: () => void;
    count?: number;
    collapsed: boolean;
    accentColor?: string;
}) {
    return (
        <button
            onClick={onClick}
            className={`
                group flex items-center relative
                transition-all duration-200 ease-out
                ${collapsed ? 'justify-center w-14 h-14 rounded-full' : 'w-full h-14 px-4 rounded-full gap-4'}
                ${active
                    ? 'bg-secondary-container text-on-secondary-container font-semibold'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }
            `}
            title={collapsed ? label : undefined}
        >
            {/* Active Indicator (Overlay) - Optional for extra depth */}
            {active && (
                <div className="absolute inset-0 rounded-full bg-on-secondary-container/5 pointer-events-none" />
            )}

            <span className={`${collapsed ? '' : ''} z-10`}>{icon}</span>

            {!collapsed && (
                <span className="text-label-large whitespace-nowrap overflow-hidden text-ellipsis z-10 flex-1 text-left">
                    {label}
                </span>
            )}

            {!collapsed && count !== undefined && (
                <span className={`text-label-small z-10 ${active ? 'text-on-secondary-container/70' : 'text-on-surface-variant/60'}`}>
                    {count}
                </span>
            )}
        </button>
    );
}




