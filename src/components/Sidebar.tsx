import { open } from '@tauri-apps/plugin-dialog';
import { usePlayerStore } from '../store/playerStore';

interface SidebarProps {
    view: 'tracks' | 'albums';
    onViewChange: (view: 'tracks' | 'albums') => void;
}

export function Sidebar({ view, onViewChange }: SidebarProps) {
    const { scanFolder, currentFolder, library } = usePlayerStore();

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
        <aside className="w-[220px] h-full flex flex-col bg-black/20 border-r border-white/5">
            {/* Logo / Brand */}
            <div data-tauri-drag-region className="px-5 pt-6 pb-4">
                <h1 className="text-xl font-bold text-white tracking-tight">Vibe</h1>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 overflow-y-auto">
                {/* Menu Section */}
                <div className="mb-6">
                    <p className="px-3 mb-2 text-[10px] font-semibold text-white/40 uppercase tracking-wider">Menu</p>
                    <NavItem icon="🏠" label="Home" active />
                </div>

                {/* Library Section */}
                <div className="mb-6">
                    <p className="px-3 mb-2 text-[10px] font-semibold text-white/40 uppercase tracking-wider">Library</p>
                    <NavItem
                        icon="🎵"
                        label="Songs"
                        active={view === 'tracks'}
                        onClick={() => onViewChange('tracks')}
                        count={library.length}
                    />
                    <NavItem
                        icon="💿"
                        label="Albums"
                        active={view === 'albums'}
                        onClick={() => onViewChange('albums')}
                    />
                    <NavItem icon="🎤" label="Artists" />
                </div>

                {/* Current Folder */}
                {currentFolder && (
                    <div className="mb-6">
                        <p className="px-3 mb-2 text-[10px] font-semibold text-white/40 uppercase tracking-wider">Folder</p>
                        <div className="px-3 py-2 rounded-lg bg-white/5">
                            <p className="text-xs text-white/70 truncate">{currentFolder.split('\\').pop()}</p>
                            <p className="text-[10px] text-white/40 mt-0.5">{library.length} tracks</p>
                        </div>
                    </div>
                )}
            </nav>

            {/* Add Folder Button */}
            <div className="p-4 border-t border-white/5">
                <button
                    className="w-full py-2.5 rounded-lg bg-indigo-500/20 text-indigo-400 text-sm font-medium hover:bg-indigo-500/30 transition-colors flex items-center justify-center gap-2"
                    onClick={handleOpenFolder}
                >
                    <span>+</span> Add Folder
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
    count
}: {
    icon: string;
    label: string;
    active?: boolean;
    onClick?: () => void;
    count?: number;
}) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${active
                    ? 'bg-white/10 text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
        >
            <span className="text-base">{icon}</span>
            <span className="flex-1 text-left">{label}</span>
            {count !== undefined && (
                <span className="text-xs text-white/40">{count}</span>
            )}
        </button>
    );
}
