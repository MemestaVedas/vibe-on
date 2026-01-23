import { usePlayerStore } from '../store/playerStore';
import { useThemeStore } from '../store/themeStore';
import { motion } from 'framer-motion';
import { useMemo } from 'react';

// ============================================================================
// Icons
// ============================================================================

function IconStats({ size = 24 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
    );
}

function IconMusicNote({ size = 24 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
        </svg>
    );
}

function IconClock({ size = 24 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    );
}

function IconArtist({ size = 24 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    );
}

// ============================================================================
// Assets
// ============================================================================

// M3 Expressive Blob Shape
const SVGShapePath = "M261.856 41.2425C272.431 41.9625 277.718 42.3226 281.991 44.1826C288.175 46.8926 293.111 51.8325 295.816 58.0125C297.685 62.2825 298.044 67.5725 298.762 78.1425L300.402 102.273C300.693 106.553 300.838 108.693 301.303 110.733C301.975 113.683 303.142 116.503 304.754 119.063C305.869 120.843 307.279 122.453 310.097 125.683L326.001 143.903C332.97 151.893 336.455 155.882 338.155 160.222C340.615 166.512 340.615 173.493 338.155 179.783C336.455 184.123 332.97 188.112 326.001 196.102L310.097 214.322C307.279 217.552 305.869 219.162 304.754 220.942C303.142 223.502 301.975 226.323 301.303 229.273C300.838 231.313 300.693 233.452 300.402 237.732L298.762 261.863C298.044 272.433 297.685 277.723 295.816 281.993C293.111 288.173 288.175 293.112 281.991 295.822C277.718 297.682 272.431 298.043 261.856 298.763L237.725 300.403C233.448 300.693 231.31 300.843 229.267 301.303C226.316 301.973 223.499 303.143 220.937 304.753C219.164 305.873 217.549 307.283 214.319 310.103L196.097 326.003C188.111 332.973 184.119 336.453 179.775 338.153C173.491 340.623 166.509 340.623 160.225 338.153C155.881 336.453 151.889 332.973 143.903 326.003L125.681 310.103C122.451 307.283 120.836 305.873 119.063 304.753C116.501 303.143 113.684 301.973 110.733 301.303C108.69 300.843 106.552 300.693 102.275 300.403L78.1438 298.763C67.5694 298.043 62.2822 297.682 58.0088 295.822C51.8252 293.112 46.8887 288.173 44.1844 281.993C42.3154 277.723 41.9561 272.433 41.2375 261.863L39.5977 237.732C39.3071 233.452 39.1618 231.313 38.6969 229.273C38.0251 226.323 36.8584 223.502 35.2463 220.942C34.1306 219.162 32.7213 217.552 29.9027 214.322L13.999 196.102C7.02996 188.112 3.54542 184.123 1.84516 179.783C-0.615054 173.493 -0.615053 166.512 1.84516 160.222C3.54542 155.882 7.02996 151.893 13.999 143.903L29.9027 125.683C32.7213 122.453 34.1306 120.843 35.2463 119.063C36.8584 116.503 38.0251 113.683 38.6969 110.733C39.1618 108.693 39.3071 106.553 39.5977 102.273L41.2375 78.1425C41.9561 67.5725 42.3154 62.2825 44.1844 58.0125C46.8887 51.8325 51.8252 46.8926 58.0088 44.1826C62.2823 42.3226 67.5694 41.9625 78.1438 41.2425L102.275 39.6025C106.552 39.3125 108.69 39.1625 110.733 38.7025C113.684 38.0325 116.501 36.8625 119.063 35.2525C120.836 34.1325 122.451 32.7225 125.681 29.9025L143.903 14.0025C151.889 7.03252 155.881 3.5525 160.225 1.8525C166.509 -0.6175 173.491 -0.6175 179.775 1.8525C184.119 3.5525 188.111 7.03252 196.097 14.0025L214.319 29.9025C217.549 32.7225 219.164 34.1325 220.937 35.2525C223.499 36.8625 226.316 38.0325 229.267 38.7025C231.31 39.1625 233.448 39.3125 237.725 39.6025L261.856 41.2425Z";

// ============================================================================
// Components
// ============================================================================

interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    startColor: string;
    endColor: string;
}

function StatCard({ icon, label, value, startColor, endColor }: StatCardProps) {
    const gradientId = `stat-grad-${label.replace(/\s/g, '-').toLowerCase()}`;
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative aspect-square"
        >
            {/* SVG Background */}
            <svg
                viewBox="0 0 340 340"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="absolute inset-0 w-full h-full"
                style={{ filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.3))' }}
            >
                <defs>
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={startColor} />
                        <stop offset="100%" stopColor={endColor} />
                    </linearGradient>
                </defs>
                <path
                    d={SVGShapePath}
                    fill={`url(#${gradientId})`}
                />
            </svg>

            {/* Content overlay */}
            <div className="absolute inset-[12%] flex flex-col justify-between p-4 text-white z-10">
                <div className="flex items-center gap-2">
                    {icon}
                    <span className="text-body-small opacity-90">{label}</span>
                </div>
                <p className="text-display-small font-bold">{value}</p>
            </div>
        </motion.div>
    );
}

interface TopTrack {
    path: string;
    title: string;
    artist: string;
    playCount: number;
}

export function StatisticsPage() {
    const { library, history, favorites } = usePlayerStore();
    const { colors } = useThemeStore();

    // Calculate statistics from history
    const stats = useMemo(() => {
        const playCounts = new Map<string, number>();
        const artistPlayCounts = new Map<string, number>();
        let totalPlayTime = 0;

        history.forEach(track => {
            playCounts.set(track.path, (playCounts.get(track.path) || 0) + 1);
            artistPlayCounts.set(track.artist, (artistPlayCounts.get(track.artist) || 0) + 1);
            totalPlayTime += track.duration_secs;
        });

        const topTracks: TopTrack[] = [];
        playCounts.forEach((count, path) => {
            const track = library.find(t => t.path === path);
            if (track) {
                topTracks.push({
                    path,
                    title: track.title,
                    artist: track.artist,
                    playCount: count
                });
            }
        });
        topTracks.sort((a, b) => b.playCount - a.playCount);

        const topArtists: { name: string; playCount: number }[] = [];
        artistPlayCounts.forEach((count, name) => {
            topArtists.push({ name, playCount: count });
        });
        topArtists.sort((a, b) => b.playCount - a.playCount);

        return {
            totalTracks: library.length,
            totalPlays: history.length,
            totalPlayTime,
            favoriteCount: favorites.size,
            uniqueArtists: new Set(library.map(t => t.artist)).size,
            topTracks: topTracks.slice(0, 5),
            topArtists: topArtists.slice(0, 5)
        };
    }, [library, history, favorites]);

    const formatDuration = (secs: number) => {
        const hours = Math.floor(secs / 3600);
        const minutes = Math.floor((secs % 3600) / 60);
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes} min`;
    };

    return (
        <div className="h-full overflow-y-auto">
            <div className="p-8 max-w-5xl mx-auto">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-10"
                >
                    <h1 className="text-display-small font-bold text-on-surface mb-2">Your Statistics</h1>
                    <p className="text-body-large text-on-surface-variant">
                        See how you've been vibing ✨
                    </p>
                </motion.div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
                    <StatCard
                        icon={<IconMusicNote size={28} />}
                        label="Total Songs"
                        value={stats.totalTracks.toString()}
                        startColor={colors.primary}
                        endColor={colors.primaryContainer}
                    />
                    <StatCard
                        icon={<IconStats size={28} />}
                        label="Times Played"
                        value={stats.totalPlays.toString()}
                        startColor={colors.secondary}
                        endColor={colors.secondaryContainer}
                    />
                    <StatCard
                        icon={<IconClock size={28} />}
                        label="Total Time"
                        value={formatDuration(stats.totalPlayTime)}
                        startColor={colors.tertiary}
                        endColor={colors.tertiaryContainer}
                    />
                    <StatCard
                        icon={<IconArtist size={28} />}
                        label="Artists"
                        value={stats.uniqueArtists.toString()}
                        startColor={colors.primary}
                        endColor={colors.tertiary}
                    />
                </div>

                {/* Top Tracks & Artists */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Top Tracks */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="rounded-3xl bg-surface-container p-6"
                    >
                        <h2 className="text-title-large font-bold text-on-surface mb-4">🎵 Top Tracks</h2>
                        {stats.topTracks.length > 0 ? (
                            <div className="flex flex-col gap-3">
                                {stats.topTracks.map((track, index) => (
                                    <div key={track.path} className="flex items-center gap-3">
                                        <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-label-medium font-medium flex items-center justify-center">
                                            {index + 1}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-body-medium font-medium text-on-surface truncate">{track.title}</p>
                                            <p className="text-body-small text-on-surface-variant truncate">{track.artist}</p>
                                        </div>
                                        <span className="text-body-small text-on-surface-variant tabular-nums">
                                            {track.playCount} {track.playCount === 1 ? 'play' : 'plays'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-body-medium text-on-surface-variant">
                                Start playing music to see your top tracks!
                            </p>
                        )}
                    </motion.div>

                    {/* Top Artists */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="rounded-3xl bg-surface-container p-6"
                    >
                        <h2 className="text-title-large font-bold text-on-surface mb-4">🎤 Top Artists</h2>
                        {stats.topArtists.length > 0 ? (
                            <div className="flex flex-col gap-3">
                                {stats.topArtists.map((artist, index) => (
                                    <div key={artist.name} className="flex items-center gap-3">
                                        <span className="w-6 h-6 rounded-full bg-secondary/20 text-secondary text-label-medium font-medium flex items-center justify-center">
                                            {index + 1}
                                        </span>
                                        <p className="flex-1 text-body-medium font-medium text-on-surface truncate">{artist.name}</p>
                                        <span className="text-body-small text-on-surface-variant tabular-nums">
                                            {artist.playCount} {artist.playCount === 1 ? 'play' : 'plays'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-body-medium text-on-surface-variant">
                                Play some music to see your top artists!
                            </p>
                        )}
                    </motion.div>
                </div>

                {/* Favorites Summary */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mt-6 rounded-3xl bg-gradient-to-br from-error/10 to-error/5 border border-error/20 p-6"
                >
                    <h2 className="text-title-large font-bold text-on-surface mb-2">❤️ Favorites</h2>
                    <p className="text-body-large text-on-surface-variant">
                        You have <span className="font-bold text-error">{stats.favoriteCount}</span> favorite {stats.favoriteCount === 1 ? 'song' : 'songs'}
                    </p>
                </motion.div>
            </div>
        </div>
    );
}
