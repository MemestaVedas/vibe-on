import { usePlayerStore } from '../store/playerStore';
import { motion } from 'framer-motion';
import { useMemo } from 'react';

// Statistics/Chart icon
function IconStats({ size = 24 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
    );
}

// Music note icon
function IconMusicNote({ size = 24 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
        </svg>
    );
}

// Clock icon
function IconClock({ size = 24 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    );
}

// Artist icon
function IconArtist({ size = 24 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    );
}

interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    gradient: string;
}

function StatCard({ icon, label, value, gradient }: StatCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-3xl p-6 ${gradient} text-white`}
        >
            <div className="flex items-center gap-3 mb-4">
                {icon}
                <span className="text-body-medium opacity-80">{label}</span>
            </div>
            <p className="text-display-small font-bold">{value}</p>
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

    // Calculate statistics from history
    const stats = useMemo(() => {
        // Count plays per track
        const playCounts = new Map<string, number>();
        const artistPlayCounts = new Map<string, number>();
        let totalPlayTime = 0;

        history.forEach(track => {
            // Track play counts
            const current = playCounts.get(track.path) || 0;
            playCounts.set(track.path, current + 1);

            // Artist play counts
            const artistCount = artistPlayCounts.get(track.artist) || 0;
            artistPlayCounts.set(track.artist, artistCount + 1);

            // Total play time (estimate based on track duration)
            totalPlayTime += track.duration_secs;
        });

        // Get top tracks
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

        // Get top artists
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
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes} min`;
    };

    return (
        <div className="h-full overflow-y-auto">
            <div className="p-6 max-w-5xl mx-auto">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <h1 className="text-display-small font-bold text-on-surface mb-2">Your Statistics</h1>
                    <p className="text-body-large text-on-surface-variant">
                        See how you've been vibing ✨
                    </p>
                </motion.div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <StatCard
                        icon={<IconMusicNote size={24} />}
                        label="Total Songs"
                        value={stats.totalTracks.toString()}
                        gradient="bg-gradient-to-br from-primary to-primary/60"
                    />
                    <StatCard
                        icon={<IconStats size={24} />}
                        label="Times Played"
                        value={stats.totalPlays.toString()}
                        gradient="bg-gradient-to-br from-secondary to-secondary/60"
                    />
                    <StatCard
                        icon={<IconClock size={24} />}
                        label="Total Time"
                        value={formatDuration(stats.totalPlayTime)}
                        gradient="bg-gradient-to-br from-tertiary to-tertiary/60"
                    />
                    <StatCard
                        icon={<IconArtist size={24} />}
                        label="Artists"
                        value={stats.uniqueArtists.toString()}
                        gradient="bg-gradient-to-br from-error to-error/60"
                    />
                </div>

                {/* Top Tracks & Artists */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
