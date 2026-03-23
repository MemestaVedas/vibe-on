import React, { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { motion } from 'motion/react';
import { IconAlbum, IconClock, IconMusicNote, IconStats } from './Icons';
import { useCoverArt } from '../hooks/useCoverArt';
import { usePlayerStore } from '../store/playerStore';
import { useThemeStore } from '../store/themeStore';



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
    titleRomaji?: string | null;
    artistRomaji?: string | null;
    albumArtUrl?: string | null;
    totalDurationMs: number;
    playCount: number;
}

interface ArtistPlaybackSummary {
    artist: string;
    artistRomaji?: string | null;
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
    albumRomaji?: string | null;
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

type TimelineMetric = 'listening-time' | 'play-count' | 'avg-session';
type CategoryDimension = 'song' | 'artist' | 'album' | 'genre';

const TIMELINE_METRICS: Array<{ id: TimelineMetric; label: string }> = [
    { id: 'listening-time', label: 'Listening time' },
    { id: 'play-count', label: 'Play count' },
    { id: 'avg-session', label: 'Avg. session' },
];

const CATEGORY_DIMS: Array<{ id: CategoryDimension; label: string }> = [
    { id: 'song', label: 'Song' },
    { id: 'artist', label: 'Artist' },
    { id: 'album', label: 'Album' },
    { id: 'genre', label: 'Genre' },
];

function getTimelineValue(entry: TimelineEntry, metric: TimelineMetric): number {
    switch (metric) {
        case 'listening-time': return entry.totalDurationMs;
        case 'play-count': return entry.playCount;
        case 'avg-session': return entry.playCount > 0 ? Math.floor(entry.totalDurationMs / entry.playCount) : 0;
    }
}

function getDimConfig(dim: CategoryDimension) {
    switch (dim) {
        case 'song':   return { card: 'bg-primary-container/60 text-on-primary-container',   chip: 'bg-primary-container text-on-primary-container',   bar: 'bg-primary',   track: 'bg-primary-container/30',   title: 'Listening by song' };
        case 'artist': return { card: 'bg-tertiary-container/60 text-on-tertiary-container', chip: 'bg-tertiary-container text-on-tertiary-container', bar: 'bg-tertiary', track: 'bg-tertiary-container/30', title: 'Listening by artist' };
        case 'album':  return { card: 'bg-secondary-container/60 text-on-secondary-container', chip: 'bg-secondary-container text-on-secondary-container', bar: 'bg-secondary', track: 'bg-secondary-container/30', title: 'Listening by album' };
        case 'genre':  return { card: 'bg-surface-container text-on-surface',    chip: 'bg-surface-container-high text-on-surface',    bar: 'bg-primary',   track: 'bg-surface-container-high', title: 'Listening by genre' };
    }
}

function buildCategoryEntries(
    summary: PlaybackStatsSummaryV2,
    dim: CategoryDimension,
    display: (orig: string, rom?: string | null) => string
): Array<{ label: string; supporting: string; durationMs: number; albumArtUrl?: string | null }> {
    switch (dim) {
        case 'song':   return summary.topSongs.map(s  => ({ label: display(s.title, s.titleRomaji),   supporting: display(s.artist, s.artistRomaji), durationMs: s.totalDurationMs, albumArtUrl: s.albumArtUrl ?? null }));
        case 'artist': return summary.topArtists.map(a  => ({ label: display(a.artist, a.artistRomaji), supporting: `${a.playCount} plays \u00b7 ${a.uniqueSongs} songs`,          durationMs: a.totalDurationMs  }));
        case 'album':  return summary.topAlbums.map(al => ({ label: display(al.album, al.albumRomaji),  supporting: `${al.playCount} plays`,                                         durationMs: al.totalDurationMs, albumArtUrl: al.albumArtUrl ?? null }));
        case 'genre':  return summary.topGenres.map(g  => ({ label: g.genre, supporting: formatDuration(g.totalDurationMs), durationMs: g.totalDurationMs }));
    }
}

function GradientHeroCard({ icon, label, value, startColor, endColor }: {
    icon: React.ReactNode; label: string; value: string; startColor: string; endColor: string;
}) {
    return (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="relative h-32 min-w-0 overflow-hidden rounded-[1.75rem] border border-white/5 p-5 text-white shadow-[0_12px_40px_rgba(0,0,0,0.28)]"
            style={{
                background: `linear-gradient(135deg, ${startColor} 0%, ${endColor} 100%)`
            }}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_35%)]" />
            <div className="absolute inset-0 opacity-20" style={{
                background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.18) 100%)'
            }} />
            <div className="relative z-10 flex h-full flex-col justify-between">
                <div className="flex items-center gap-2 opacity-80">
                    {icon}
                    <span className="text-body-small">{label}</span>
                </div>
                <p className="text-display-small font-bold drop-shadow-xs">{value}</p>
            </div>
        </motion.div>
    );
}



// MiniStatsPlayer removed — stats now show album art per-entry in the lists

// Removed embedded DiscordPresenceCard — keep Statistics2 focused on stats

export function Statistics2() {
    const [selectedRange, setSelectedRange] = useState<StatsTimeRange>('WEEK');
    const [summary, setSummary] = useState<PlaybackStatsSummaryV2 | null>(null);
    const [loading, setLoading] = useState(true);
    const displayLanguage = usePlayerStore(state => state.displayLanguage);
    const { colors } = useThemeStore();

    const chooseDisplay = (original: string, romaji?: string | null) => {
        if (displayLanguage === 'romaji') return romaji || original;
        return original;
    };

    useEffect(() => {
        let unlisten: (() => void) | undefined;

        const load = async (range: StatsTimeRange) => {
            setLoading(true);
            try {
                const payload = await invoke<any>('get_stats_v2', { range });
                // Normalize possible snake_case fields coming from Rust/serde
                const normalize = (p: any): PlaybackStatsSummaryV2 => {
                    if (!p) return p;
                    const mapSong = (s: any): SongPlaybackSummary => ({
                        songId: s.songId ?? s.song_id,
                        title: s.title,
                        titleRomaji: s.titleRomaji ?? s.title_romaji ?? null,
                        artist: s.artist,
                        artistRomaji: s.artistRomaji ?? s.artist_romaji ?? null,
                        albumArtUrl: s.albumArtUrl ?? s.album_art_url ?? null,
                        totalDurationMs: s.totalDurationMs ?? s.total_duration_ms ?? 0,
                        playCount: s.playCount ?? s.play_count ?? 0,
                    });

                    const mapArtist = (a: any): ArtistPlaybackSummary => ({
                        artist: a.artist,
                        artistRomaji: a.artistRomaji ?? a.artist_romaji ?? null,
                        totalDurationMs: a.totalDurationMs ?? a.total_duration_ms ?? 0,
                        playCount: a.playCount ?? a.play_count ?? 0,
                        uniqueSongs: a.uniqueSongs ?? a.unique_songs ?? 0,
                    });

                    const mapAlbum = (al: any): AlbumPlaybackSummary => ({
                        album: al.album,
                        albumRomaji: al.albumRomaji ?? al.album_romaji ?? null,
                        albumArtUrl: al.albumArtUrl ?? al.album_art_url ?? null,
                        totalDurationMs: al.totalDurationMs ?? al.total_duration_ms ?? 0,
                        playCount: al.playCount ?? al.play_count ?? 0,
                        uniqueSongs: al.uniqueSongs ?? al.unique_songs ?? 0,
                    });

                    return {
                        range: p.range,
                        rangeDisplayName: p.rangeDisplayName ?? p.range_display_name,
                        totalDurationMs: p.totalDurationMs ?? p.total_duration_ms ?? 0,
                        totalPlayCount: p.totalPlayCount ?? p.total_play_count ?? 0,
                        uniqueSongs: p.uniqueSongs ?? p.unique_songs ?? 0,
                        activeDays: p.activeDays ?? p.active_days ?? 0,
                        longestStreakDays: p.longestStreakDays ?? p.longest_streak_days ?? 0,
                        totalSessions: p.totalSessions ?? p.total_sessions ?? 0,
                        averageSessionDurationMs: p.averageSessionDurationMs ?? p.average_session_duration_ms ?? 0,
                        averageSessionsPerDay: p.averageSessionsPerDay ?? p.average_sessions_per_day ?? 0,
                        peakDayLabel: p.peakDayLabel ?? p.peak_day_label ?? null,
                        peakDayDurationMs: p.peakDayDurationMs ?? p.peak_day_duration_ms ?? 0,
                        timeline: (p.timeline ?? []).map((t: any) => ({ label: t.label, totalDurationMs: t.totalDurationMs ?? t.total_duration_ms ?? 0, playCount: t.playCount ?? t.play_count ?? 0 })),
                        topSongs: (p.topSongs ?? []).map(mapSong),
                        topArtists: (p.topArtists ?? []).map(mapArtist),
                        topAlbums: (p.topAlbums ?? []).map(mapAlbum),
                        topGenres: (p.topGenres ?? []).map((g: any) => ({ genre: g.genre, totalDurationMs: g.totalDurationMs ?? g.total_duration_ms ?? 0, playCount: g.playCount ?? g.play_count ?? 0, uniqueArtists: g.uniqueArtists ?? g.unique_artists ?? 0 })),
                        dayListeningDistribution: p.dayListeningDistribution ?? p.day_listening_distribution ?? null,
                    } as PlaybackStatsSummaryV2;
                };

                setSummary(normalize(payload));
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

    const [selectedMetric, setSelectedMetric] = useState<TimelineMetric>('listening-time');
    const [selectedDimension, setSelectedDimension] = useState<CategoryDimension>('song');

    const timelineMax = useMemo(() => {
        if (!summary?.timeline?.length) return 1;
        return Math.max(1, ...summary.timeline.map(e => getTimelineValue(e, selectedMetric)));
    }, [summary, selectedMetric]);

    const dimCfg = getDimConfig(selectedDimension);
    const categoryEntries = useMemo(
        () => summary ? buildCategoryEntries(summary, selectedDimension, chooseDisplay) : [],
        [summary, selectedDimension, displayLanguage] // eslint-disable-line react-hooks/exhaustive-deps
    );

    return (
        <div className="h-full overflow-y-auto no-scrollbar pb-28">
            <div className="max-w-6xl mx-auto p-5 sm:p-8 space-y-6">
                {/* Header */}
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                    <h1 className="text-headline-large font-bold text-on-surface">Statistics</h1>
                    <p className="text-body-medium text-on-surface-variant">See how you've been vibing</p>
                </motion.div>

                

                {/* Range chips */}
                <div className="flex gap-2 flex-wrap">
                    {RANGES.map(range => {
                        const selected = selectedRange === range.id;
                        return (
                            <button key={range.id} onClick={() => setSelectedRange(range.id)}
                                className={`px-4 py-2 rounded-full text-label-large transition-colors ${selected
                                    ? 'bg-primary-container text-on-primary-container'
                                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}>
                                {range.label}
                            </button>
                        );
                    })}
                </div>

                {/* Loading / empty states */}
                {loading && !summary && (
                    <div className="rounded-[2rem] bg-surface-container p-8 text-on-surface-variant text-body-medium">
                        Loading your stats…
                    </div>
                )}
                {!loading && !summary && (
                    <div className="rounded-[2rem] bg-surface-container p-8 text-on-surface-variant text-body-medium">
                        No statistics data available yet.
                    </div>
                )}

                {summary && (
                    <>
                        {/* ── Hero grid ── */}
                        <div className="grid grid-cols-4 max-[1100px]:grid-cols-2 gap-4">
                            <GradientHeroCard icon={<IconClock size={28} />} label="Listening time"
                                value={formatDuration(summary.totalDurationMs)}
                                startColor={colors.primaryContainer} endColor={colors.surfaceContainerHigh} />
                            <GradientHeroCard icon={<IconStats size={28} />} label="Total plays"
                                value={String(summary.totalPlayCount)}
                                startColor={colors.secondaryContainer} endColor={colors.surfaceContainerHigh} />
                            <GradientHeroCard icon={<IconMusicNote size={28} />} label="Unique songs"
                                value={String(summary.uniqueSongs)}
                                startColor={colors.tertiaryContainer} endColor={colors.surfaceContainerHigh} />
                            <GradientHeroCard icon={<IconAlbum size={28} />} label="Active days"
                                value={String(summary.activeDays)}
                                startColor={colors.primaryContainer} endColor={colors.tertiaryContainer} />
                        </div>

                        {/* ── Listening timeline ── */}
                        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                            <h2 className="text-title-medium font-bold mb-3 text-on-surface">Listening timeline</h2>
                            {/* Metric chips */}
                            <div className="flex gap-2 mb-4">
                                {TIMELINE_METRICS.map(m => (
                                    <button key={m.id} onClick={() => setSelectedMetric(m.id)}
                                        className={`px-3 py-1.5 rounded-full text-label-medium transition-colors ${selectedMetric === m.id
                                            ? 'bg-primary-container text-on-primary-container'
                                            : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}>
                                        {m.label}
                                    </button>
                                ))}
                            </div>
                            <div className="rounded-[2rem] bg-primary-container/45 p-5">
                                {(summary.timeline || []).length === 0 ? (
                                    <p className="text-body-medium text-on-surface-variant text-center py-6">No listening data yet</p>
                                ) : (
                                    <>
                                        <div className="h-32 flex gap-1">
                                            {summary.timeline.map((entry, idx) => {
                                                const val = getTimelineValue(entry, selectedMetric);
                                                const hPct = Math.max(3, Math.round((val / timelineMax) * 100));
                                                const isPeak = val >= timelineMax * 0.98;
                                                return (
                                                    <div key={`${entry.label}-${idx}`} className="flex-1 flex flex-col justify-end min-w-0">
                                                        <div className={`w-full rounded-t transition-all duration-500 ${isPeak ? 'bg-primary' : 'bg-primary/65'}`}
                                                            style={{ height: `${hPct}%` }} />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="flex gap-1 mt-2">
                                            {summary.timeline.map((entry, idx) => (
                                                <div key={`lbl-${idx}`} className="flex-1 min-w-0 text-center">
                                                    {idx % Math.max(1, Math.floor(summary.timeline.length / 5)) === 0 && (
                                                        <span className="text-label-small text-on-primary-container opacity-70 truncate block">{entry.label}</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </motion.section>

                        {/* ── Top categories ── */}
                        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                            <h2 className="text-title-medium font-bold mb-3 text-on-surface">Top categories</h2>
                            {/* Dimension chips */}
                            <div className="flex gap-2 mb-4">
                                {CATEGORY_DIMS.map(d => {
                                    const cfg = getDimConfig(d.id);
                                    const sel = selectedDimension === d.id;
                                    return (
                                        <button key={d.id} onClick={() => setSelectedDimension(d.id)}
                                            className={`px-3 py-1.5 rounded-full text-label-medium transition-colors ${sel
                                                ? `${cfg.chip}`
                                                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}>
                                            {d.label}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className={`rounded-[2rem] ${dimCfg.card} p-5 space-y-2`}>
                                <p className="text-label-medium opacity-65 mb-3">{dimCfg.title}</p>
                                {categoryEntries.length === 0 ? (
                                    <p className="text-body-medium opacity-55 py-4">Play more music to see stats</p>
                                ) : (
                                    categoryEntries.slice(0, 5).map((entry, idx) => {
                                        const maxDur = categoryEntries[0]?.durationMs || 1;
                                        const pct = Math.max(0, Math.min(100, Math.round((entry.durationMs / maxDur) * 100)));
                                        return (
                                            <CategoryEntry key={`${entry.label}-${idx}`} entry={entry} idx={idx} pct={pct} dimCfg={dimCfg} />
                                        );
                                    })
                                )}
                            </div>
                        </motion.section>

                        {/* ── Listening habits ── */}
                        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            className="rounded-[2rem] bg-surface-container p-6 space-y-1">
                            <h2 className="text-title-medium font-bold mb-4 text-on-surface">Listening habits</h2>
                            {[
                                { icon: <IconStats size={18} />,    label: 'Sessions',        value: String(summary.totalSessions) },
                                { icon: <IconClock size={18} />,    label: 'Avg session',     value: formatDuration(summary.averageSessionDurationMs) },
                                { icon: <IconMusicNote size={18} />, label: 'Longest streak',  value: `${summary.longestStreakDays} days` },
                                { icon: <IconAlbum size={18} />,    label: 'Sessions / day',  value: summary.averageSessionsPerDay.toFixed(1) },
                            ].map(row => (
                                <div key={row.label} className="flex items-center gap-3 rounded-[1rem] bg-surface-container-low px-4 py-2.5">
                                    <span className="text-on-surface-variant">{row.icon}</span>
                                    <span className="flex-1 text-body-small text-on-surface-variant">{row.label}</span>
                                    <span className="text-body-small font-semibold text-on-surface">{row.value}</span>
                                </div>
                            ))}
                            {summary.peakDayLabel && (
                                <>
                                    <div className="h-px bg-outline-variant mx-1 my-2" />
                                    <div className="flex items-center justify-between rounded-[1rem] bg-primary-container/50 px-4 py-2.5">
                                        <div className="flex items-center gap-2">
                                            <IconClock size={18} className="text-on-primary-container" />
                                            <span className="text-body-small font-semibold text-on-primary-container">
                                                Peak day · {summary.peakDayLabel}
                                            </span>
                                        </div>
                                        <span className="text-label-small text-on-primary-container">
                                            {formatDuration(summary.peakDayDurationMs)}
                                        </span>
                                    </div>
                                </>
                            )}
                        </motion.section>

                        

                        {/* ── Top genres ── */}
                        {summary.topGenres.length > 0 && (
                            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                className="rounded-[2rem] bg-tertiary-container/50 text-on-tertiary-container p-6 space-y-3">
                                <h2 className="text-title-medium font-bold">Top genres</h2>
                                {summary.topGenres.slice(0, 5).map((genre, idx) => {
                                    const max = Math.max(1, summary.topGenres[0]?.totalDurationMs || 1);
                                    const pct = Math.max(2, Math.round((genre.totalDurationMs / max) * 100));
                                    return (
                                        <div key={`${genre.genre}-${idx}`} className="space-y-1.5">
                                            <div className="flex justify-between text-body-small">
                                                <span className="font-semibold truncate pr-4">{genre.genre}</span>
                                                <span className="opacity-60 shrink-0">{formatDuration(genre.totalDurationMs)}</span>
                                            </div>
                                            <div className="h-2 rounded-full bg-tertiary-container/40">
                                                <div className="h-2 rounded-full bg-tertiary" style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </motion.section>
                        )}

                        {/* ── Daily rhythm ── */}
                        {summary.dayListeningDistribution && summary.dayListeningDistribution.buckets.length > 0 && (
                            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                className="rounded-[2rem] bg-surface-container p-6 space-y-3">
                                <h2 className="text-title-medium font-bold text-on-surface">Daily rhythm</h2>
                                {summary.dayListeningDistribution.buckets
                                    .slice()
                                    .sort((a, b) => b.totalDurationMs - a.totalDurationMs)
                                    .slice(0, 4)
                                    .map((bucket, idx) => {
                                        const share = Math.max(0, Math.min(100, Math.round(
                                            (bucket.totalDurationMs / Math.max(1, summary.dayListeningDistribution!.maxBucketDurationMs)) * 100
                                        )));
                                        return (
                                            <div key={`${bucket.startMinute}-${idx}`}
                                                className="rounded-[1rem] bg-surface-container-high px-4 py-2.5 flex items-center gap-3">
                                                <span className="text-label-medium font-medium w-20 shrink-0">
                                                    {formatMinuteLabel(bucket.startMinute)}
                                                </span>
                                                <div className="flex-1 h-2 rounded-full bg-surface-container">
                                                    <div className="h-2 rounded-full bg-secondary" style={{ width: `${share}%` }} />
                                                </div>
                                                <span className="text-label-small text-on-surface-variant shrink-0">
                                                    {formatDuration(bucket.totalDurationMs)}
                                                </span>
                                            </div>
                                        );
                                    })}
                            </motion.section>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

function CategoryEntry({ entry, idx, pct, dimCfg }: { entry: { label: string; supporting: string; durationMs: number; albumArtUrl?: string | null }, idx: number, pct: number, dimCfg: any }) {
    const coverUrl = useCoverArt(entry.albumArtUrl ?? null);

    return (
        <div className="rounded-[1.25rem] bg-black/10 px-3 py-2.5 flex items-center gap-3">
            {coverUrl ? (
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-[0.6rem] bg-black/10 flex items-center justify-center">
                    <img src={coverUrl} alt={entry.label} className="h-full w-full object-cover" />
                </div>
            ) : (
                <span className="w-8 h-8 shrink-0 rounded-full bg-black/15 flex items-center justify-center text-label-small font-bold">{idx + 1}</span>
            )}

            <div className="flex-1 min-w-0 space-y-1">
                <p className="text-body-small font-semibold truncate">{entry.label}</p>
                {entry.supporting && (
                    <p className="text-label-small opacity-60 truncate">{entry.supporting}</p>
                )}
                <div className={`h-1.5 rounded-full ${dimCfg.track}`}>
                    <div className={`h-1.5 rounded-full ${dimCfg.bar} transition-all`} style={{ width: `${pct}%` }} />
                </div>
            </div>
            <span className="text-label-small opacity-70 shrink-0">{formatDuration(entry.durationMs)}</span>
        </div>
    );
}
