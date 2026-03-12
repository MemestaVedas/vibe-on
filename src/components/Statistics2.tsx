import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { motion } from 'motion/react';
import { IconAlbum, IconClock, IconMusicNote, IconStats } from './Icons';
import { useCoverArt } from '../hooks/useCoverArt';
import { M3SquircleImage } from './ShapeComponents';

type StatsTimeRange = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'ALL';

interface TimelineEntry {
    label: string;
    totalDurationMs: number;
    playCount: number;
}

interface SongPlaybackSummary {
    songId: string;
    title: string;
    artist: string;
    albumArtUrl?: string | null;
    totalDurationMs: number;
    playCount: number;
}

interface ArtistPlaybackSummary {
    artist: string;
    totalDurationMs: number;
    playCount: number;
    uniqueSongs: number;
}

interface GenrePlaybackSummary {
    genre: string;
    totalDurationMs: number;
    playCount: number;
    uniqueArtists: number;
}

interface AlbumPlaybackSummary {
    album: string;
    albumArtUrl?: string | null;
    totalDurationMs: number;
    playCount: number;
    uniqueSongs: number;
}

interface DailyListeningBucket {
    startMinute: number;
    endMinuteExclusive: number;
    totalDurationMs: number;
}

interface DayListeningDistribution {
    bucketSizeMinutes: number;
    buckets: DailyListeningBucket[];
    maxBucketDurationMs: number;
}

interface PlaybackStatsSummaryV2 {
    range: StatsTimeRange;
    rangeDisplayName: string;
    totalDurationMs: number;
    totalPlayCount: number;
    uniqueSongs: number;
    activeDays: number;
    longestStreakDays: number;
    totalSessions: number;
    averageSessionDurationMs: number;
    averageSessionsPerDay: number;
    peakDayLabel?: string | null;
    peakDayDurationMs: number;
    timeline: TimelineEntry[];
    topSongs: SongPlaybackSummary[];
    topArtists: ArtistPlaybackSummary[];
    topAlbums: AlbumPlaybackSummary[];
    topGenres: GenrePlaybackSummary[];
    dayListeningDistribution?: DayListeningDistribution | null;
}

const RANGES: Array<{ id: StatsTimeRange; label: string }> = [
    { id: 'DAY', label: 'Today' },
    { id: 'WEEK', label: 'This Week' },
    { id: 'MONTH', label: 'This Month' },
    { id: 'YEAR', label: 'This Year' },
    { id: 'ALL', label: 'All Time' },
];

function formatDuration(durationMs: number): string {
    const totalMinutes = Math.floor(durationMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatMinuteLabel(startMinute: number): string {
    const safeStart = Math.max(0, Math.min(1439, startMinute));
    const hour = Math.floor(safeStart / 60);
    const minute = safeStart % 60;
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const period = hour < 12 ? 'AM' : 'PM';
    return `${displayHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} ${period}`;
}

function MetricCard({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: string }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-[1.7rem] p-4 sm:p-5 bg-gradient-to-br ${tone} text-white shadow-elevation-2`}
        >
            <div className="flex items-center gap-2 opacity-90 text-body-small">
                {icon}
                <span>{label}</span>
            </div>
            <p className="mt-3 text-headline-small font-bold">{value}</p>
        </motion.div>
    );
}

function AlbumArt({ albumArtUrl }: { albumArtUrl?: string | null }) {
    const art = useCoverArt(albumArtUrl ?? null);
    return (
        <div className="w-11 h-11 shrink-0">
            <M3SquircleImage
                src={art}
                fallback={<IconAlbum size={18} className="text-on-surface-variant" />}
            />
        </div>
    );
}

export function Statistics2() {
    const [selectedRange, setSelectedRange] = useState<StatsTimeRange>('WEEK');
    const [summary, setSummary] = useState<PlaybackStatsSummaryV2 | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unlisten: (() => void) | undefined;

        const load = async (range: StatsTimeRange) => {
            setLoading(true);
            try {
                const payload = await invoke<PlaybackStatsSummaryV2>('get_stats_v2', { range });
                setSummary(payload);
            } catch (error) {
                console.error('[Statistics2] Failed to load stats:', error);
                setSummary(null);
            } finally {
                setLoading(false);
            }
        };

        load(selectedRange);

        listen('stats-updated', () => {
            load(selectedRange);
        }).then(unsub => {
            unlisten = unsub;
        });

        return () => {
            if (unlisten) {
                unlisten();
            }
        };
    }, [selectedRange]);

    const timelineMax = useMemo(() => {
        if (!summary?.timeline?.length) {
            return 1;
        }
        return Math.max(1, ...summary.timeline.map(entry => entry.totalDurationMs));
    }, [summary]);

    return (
        <div className="h-full overflow-y-auto no-scrollbar pb-28">
            <div className="max-w-6xl mx-auto p-5 sm:p-8 space-y-6 sm:space-y-8">
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                    <h1 className="text-display-small font-bold text-on-surface">Your Statistics 2</h1>
                    <p className="text-body-large text-on-surface-variant">Android-parity listening analytics powered by the new stats engine.</p>
                </motion.div>

                <div className="flex gap-2 flex-wrap">
                    {RANGES.map(range => {
                        const selected = selectedRange === range.id;
                        return (
                            <button
                                key={range.id}
                                onClick={() => setSelectedRange(range.id)}
                                className={`px-4 py-2 rounded-full text-label-large transition-colors ${selected
                                    ? 'bg-primary text-on-primary'
                                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                                    }`}
                            >
                                {range.label}
                            </button>
                        );
                    })}
                </div>

                {loading && !summary && (
                    <div className="rounded-[2rem] bg-surface-container p-8 text-on-surface-variant">Loading your stats...</div>
                )}

                {!loading && !summary && (
                    <div className="rounded-[2rem] bg-surface-container p-8 text-on-surface-variant">No statistics data available yet.</div>
                )}

                {summary && (
                    <>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <MetricCard
                                label="Listening Time"
                                value={formatDuration(summary.totalDurationMs)}
                                icon={<IconClock size={18} />}
                                tone="from-primary to-secondary"
                            />
                            <MetricCard
                                label="Total Plays"
                                value={String(summary.totalPlayCount)}
                                icon={<IconStats size={18} />}
                                tone="from-tertiary to-primary"
                            />
                            <MetricCard
                                label="Unique Songs"
                                value={String(summary.uniqueSongs)}
                                icon={<IconMusicNote size={18} />}
                                tone="from-secondary to-tertiary"
                            />
                            <MetricCard
                                label="Active Days"
                                value={String(summary.activeDays)}
                                icon={<IconClock size={18} />}
                                tone="from-primary to-primary-container"
                            />
                        </div>

                        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-[2rem] p-5 bg-surface-container">
                            <h2 className="text-title-large font-bold mb-4">Listening Timeline</h2>
                            <div className="h-36 flex items-end gap-2">
                                {(summary.timeline || []).map(entry => {
                                    const h = Math.max(6, Math.round((entry.totalDurationMs / timelineMax) * 100));
                                    return (
                                        <div key={entry.label} className="flex-1 flex flex-col items-center justify-end gap-2 min-w-0">
                                            <div className="w-full rounded-t-2xl bg-primary/80" style={{ height: `${h}%` }} />
                                            <span className="text-label-small text-on-surface-variant truncate max-w-full">{entry.label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.section>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                            <motion.section initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} className="rounded-[2rem] p-5 bg-surface-container">
                                <h2 className="text-title-large font-bold mb-4">Top Songs</h2>
                                <div className="space-y-3">
                                    {summary.topSongs.length === 0 && (
                                        <p className="text-on-surface-variant">Start listening to populate your top songs.</p>
                                    )}
                                    {summary.topSongs.map((song, index) => (
                                        <div key={`${song.songId}-${index}`} className="flex items-center gap-3">
                                            <span className="w-7 h-7 rounded-full bg-primary/20 text-primary text-label-medium flex items-center justify-center font-semibold">{index + 1}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-body-large font-semibold truncate">{song.title}</p>
                                                <p className="text-body-small text-on-surface-variant truncate">{song.artist}</p>
                                            </div>
                                            <span className="text-label-medium text-on-surface-variant">{song.playCount} plays</span>
                                        </div>
                                    ))}
                                </div>
                            </motion.section>

                            <motion.section initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="rounded-[2rem] p-5 bg-surface-container">
                                <h2 className="text-title-large font-bold mb-4">Top Artists</h2>
                                <div className="space-y-3">
                                    {summary.topArtists.length === 0 && (
                                        <p className="text-on-surface-variant">Play music to reveal top artists.</p>
                                    )}
                                    {summary.topArtists.map((artist, index) => (
                                        <div key={`${artist.artist}-${index}`} className="flex items-center gap-3">
                                            <span className="w-7 h-7 rounded-full bg-secondary/20 text-secondary text-label-medium flex items-center justify-center font-semibold">{index + 1}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-body-large font-semibold truncate">{artist.artist}</p>
                                                <p className="text-body-small text-on-surface-variant">{artist.playCount} plays · {artist.uniqueSongs} songs</p>
                                            </div>
                                            <span className="text-label-medium text-on-surface-variant">{formatDuration(artist.totalDurationMs)}</span>
                                        </div>
                                    ))}
                                </div>
                            </motion.section>
                        </div>

                        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[2rem] p-5 bg-surface-container">
                            <h2 className="text-title-large font-bold mb-4">Top Albums</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {summary.topAlbums.length === 0 && (
                                    <p className="text-on-surface-variant">Albums appear after a bit more listening.</p>
                                )}
                                {summary.topAlbums.map((album, index) => (
                                    <div key={`${album.album}-${index}`} className="rounded-[1.3rem] bg-surface-container-high p-3 flex items-center gap-3">
                                        <AlbumArt albumArtUrl={album.albumArtUrl} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-body-large font-semibold truncate">{album.album}</p>
                                            <p className="text-body-small text-on-surface-variant">{album.playCount} plays · {album.uniqueSongs} songs</p>
                                        </div>
                                        <span className="text-label-small text-on-surface-variant">{formatDuration(album.totalDurationMs)}</span>
                                    </div>
                                ))}
                            </div>
                        </motion.section>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-[2rem] p-5 bg-surface-container">
                                <h2 className="text-title-large font-bold mb-4">Top Genres</h2>
                                <div className="space-y-3">
                                    {summary.topGenres.length === 0 && (
                                        <p className="text-on-surface-variant">Genre data will appear when metadata is available.</p>
                                    )}
                                    {summary.topGenres.map((genre, index) => {
                                        const max = Math.max(1, summary.topGenres[0]?.totalDurationMs || 1);
                                        const w = Math.max(4, Math.round((genre.totalDurationMs / max) * 100));
                                        return (
                                            <div key={`${genre.genre}-${index}`}>
                                                <div className="flex justify-between text-body-small mb-1">
                                                    <span className="font-medium truncate pr-4">{genre.genre}</span>
                                                    <span className="text-on-surface-variant">{formatDuration(genre.totalDurationMs)}</span>
                                                </div>
                                                <div className="h-2 rounded-full bg-surface-container-high">
                                                    <div className="h-2 rounded-full bg-primary" style={{ width: `${w}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </motion.section>

                            <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-[2rem] p-5 bg-surface-container">
                                <h2 className="text-title-large font-bold mb-4">Sessions and Peak</h2>
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div className="rounded-2xl bg-surface-container-high p-3">
                                        <p className="text-label-large text-on-surface-variant">Sessions</p>
                                        <p className="text-title-large font-bold">{summary.totalSessions}</p>
                                    </div>
                                    <div className="rounded-2xl bg-surface-container-high p-3">
                                        <p className="text-label-large text-on-surface-variant">Longest Streak</p>
                                        <p className="text-title-large font-bold">{summary.longestStreakDays} days</p>
                                    </div>
                                    <div className="rounded-2xl bg-surface-container-high p-3">
                                        <p className="text-label-large text-on-surface-variant">Avg Session</p>
                                        <p className="text-title-large font-bold">{formatDuration(summary.averageSessionDurationMs)}</p>
                                    </div>
                                    <div className="rounded-2xl bg-surface-container-high p-3">
                                        <p className="text-label-large text-on-surface-variant">Avg / Day</p>
                                        <p className="text-title-large font-bold">{summary.averageSessionsPerDay.toFixed(1)}</p>
                                    </div>
                                </div>
                                <p className="text-body-medium">Peak day: <span className="font-semibold">{summary.peakDayLabel || '--'}</span></p>
                                <p className="text-body-medium text-on-surface-variant">Peak duration: {formatDuration(summary.peakDayDurationMs)}</p>
                            </motion.section>
                        </div>

                        {summary.dayListeningDistribution && summary.dayListeningDistribution.buckets.length > 0 && (
                            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-[2rem] p-5 bg-surface-container">
                                <h2 className="text-title-large font-bold mb-4">Daily Rhythm</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {summary.dayListeningDistribution.buckets
                                        .slice()
                                        .sort((a, b) => b.totalDurationMs - a.totalDurationMs)
                                        .slice(0, 4)
                                        .map((bucket, index) => {
                                            const share = Math.max(
                                                0,
                                                Math.min(1, bucket.totalDurationMs / Math.max(1, summary.dayListeningDistribution?.maxBucketDurationMs || 1))
                                            );
                                            return (
                                                <div key={`${bucket.startMinute}-${index}`} className="rounded-2xl bg-surface-container-high p-3">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-body-medium font-semibold">{formatMinuteLabel(bucket.startMinute)}</span>
                                                        <span className="text-label-medium text-on-surface-variant">{formatDuration(bucket.totalDurationMs)}</span>
                                                    </div>
                                                    <div className="h-2 rounded-full bg-surface-container-highest">
                                                        <div className="h-2 rounded-full bg-secondary" style={{ width: `${Math.round(share * 100)}%` }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </motion.section>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
