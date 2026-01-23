import { useSettingsStore } from '../store/settingsStore';
import { useThemeStore } from '../store/themeStore';

export function SettingsPage() {
    const {
        albumArtStyle, setAlbumArtStyle,
        expandedArtMode, setExpandedArtMode,
        autoplay, setAutoplay
    } = useSettingsStore();
    const { colors } = useThemeStore();
    const { primary } = colors;

    return (
        <div className="flex-1 overflow-y-auto p-8">
            <h1 className="text-3xl font-bold text-white mb-8">Settings</h1>

            <div className="max-w-2xl flex flex-col gap-8">

                {/* Section: Minimal Player Appearance */}
                <section>
                    <h2 className="text-xl font-semibold text-white mb-4">Minimal Player</h2>
                    <div className="bg-white/5 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-base font-medium text-white">Album Art Style</h3>
                                <p className="text-sm text-white/50">Choose how the album art looks in the minimized player.</p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <OptionButton
                                label="Vinyl Style"
                                active={albumArtStyle === 'vinyl'}
                                onClick={() => setAlbumArtStyle('vinyl')}
                                accentColor={primary}
                            >
                                <div className="w-8 h-8 rounded-full bg-white/20 relative overflow-hidden animate-[spin_4s_linear_infinite]">
                                    <div className="absolute inset-0 border-2 border-white/20 rounded-full"></div>
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-black rounded-full"></div>
                                </div>
                            </OptionButton>

                            <OptionButton
                                label="Full Cover"
                                active={albumArtStyle === 'full'}
                                onClick={() => setAlbumArtStyle('full')}
                                accentColor={primary}
                            >
                                <div className="w-8 h-8 rounded bg-white/20"></div>
                            </OptionButton>
                        </div>
                    </div>
                </section>

                {/* Section: Expanded Player Appearance */}
                <section>
                    <h2 className="text-xl font-semibold text-white mb-4">Expanded Player</h2>
                    <div className="bg-white/5 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-base font-medium text-white">Layout Mode</h3>
                                <p className="text-sm text-white/50">Customize the layout when the player is expanded.</p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <OptionButton
                                label="Background Art"
                                active={expandedArtMode === 'background'}
                                onClick={() => setExpandedArtMode('background')}
                                accentColor={primary}
                            >
                                {/* Mini diagram of pill with bg art */}
                                <div className="w-16 h-8 rounded-full border border-white/20 relative overflow-hidden flex items-center">
                                    <div className="absolute left-0 top-0 bottom-0 w-1/2 bg-white/20 rounded-l-full"></div>
                                    <div className="w-2 h-2 bg-white/40 ml-auto mr-2 rounded-full"></div>
                                </div>
                            </OptionButton>

                            <OptionButton
                                label="Pill Art (Left)"
                                active={expandedArtMode === 'pill'}
                                onClick={() => setExpandedArtMode('pill')}
                                accentColor={primary}
                            >
                                {/* Mini diagram of pill with art on left */}
                                <div className="w-16 h-8 rounded-full border border-white/20 flex items-center p-1 gap-1">
                                    <div className="w-6 h-6 rounded-full bg-white/20"></div>
                                    <div className="flex-1 h-1 bg-white/10 rounded-full"></div>
                                </div>
                            </OptionButton>
                        </div>
                    </div>
                </section>

                {/* Section: Playback */}
                <section>
                    <h2 className="text-xl font-semibold text-white mb-4">Playback</h2>
                    <div className="bg-white/5 rounded-xl p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-medium text-white">Autoplay</h3>
                                <p className="text-sm text-white/50">Automatically play next track when current track ends.</p>
                            </div>
                            <ToggleSwitch
                                enabled={autoplay}
                                onChange={setAutoplay}
                                accentColor={primary}
                            />
                        </div>
                    </div>
                </section>

                {/* Info Section */}
                <section className="text-center pt-8 text-white/20 text-xs">
                    <p>VIBE-ON! v0.1.0</p>
                    <p>Created with Antigravity</p>
                </section>
            </div>
        </div>
    );
}

function OptionButton({
    label,
    active,
    onClick,
    accentColor,
    children
}: {
    label: string,
    active: boolean,
    onClick: () => void,
    accentColor: string,
    children?: React.ReactNode
}) {
    return (
        <button
            onClick={onClick}
            className={`flex-1 flex flex-col items-center gap-3 p-4 rounded-lg border transition-all duration-200 ${active
                ? 'bg-white/10 border-transparent'
                : 'bg-transparent border-white/10 hover:bg-white/5'
                }`}
            style={active ? { borderColor: accentColor, boxShadow: `0 0 0 1px ${accentColor}` } : {}}
        >
            <div className={`opacity-80 ${active ? 'text-white' : 'text-white/50'}`}>
                {children}
            </div>
            <span className={`text-sm font-medium ${active ? 'text-white' : 'text-white/60'}`}>
                {label}
            </span>
        </button>
    );
}

function ToggleSwitch({
    enabled,
    onChange,
    accentColor
}: {
    enabled: boolean,
    onChange: (value: boolean) => void,
    accentColor: string
}) {
    return (
        <button
            onClick={() => onChange(!enabled)}
            className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${enabled ? '' : 'bg-white/10'}`}
            style={enabled ? { backgroundColor: accentColor } : {}}
        >
            <div
                className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${enabled ? 'translate-x-6' : 'translate-x-1'}`}
            />
        </button>
    );
}
