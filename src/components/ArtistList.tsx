import { useState, useMemo, forwardRef } from 'react';
import { VirtuosoGrid, Virtuoso } from 'react-virtuoso';
import { usePlayerStore } from '../store/playerStore';
import { useCoverArt } from '../hooks/useCoverArt';
import { IconMicrophone, IconPlay } from './Icons';
import type { TrackDisplay } from '../types';
import { motion } from 'framer-motion';

interface Artist {
    name: string;
    cover: string | null;
    tracks: TrackDisplay[];
    albumCount: number;
}

// M3 Very Sunny Shape for Play Button - positioned outside bottom right
const VerySunnyPlayButton = ({ onClick }: { onClick: (e: React.MouseEvent) => void }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="absolute -bottom-2 -right-2 w-10 h-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-30 cursor-pointer"
        >
            <motion.svg
                viewBox="0 0 320 320"
                className="absolute w-full h-full drop-shadow-lg"
                style={{ color: 'var(--md-sys-color-primary)' }}
                animate={{ rotate: isHovered ? 120 : 0, scale: isHovered ? 1.1 : 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
            >
                <path d="M136.72 13.1925C147.26 -4.3975 172.74 -4.3975 183.28 13.1925L195.12 32.9625C201.27 43.2125 213.4 48.2425 224.99 45.3325L247.35 39.7325C267.24 34.7525 285.25 52.7626 280.27 72.6526L274.67 95.0126C271.76 106.603 276.79 118.733 287.04 124.883L306.81 136.723C324.4 147.263 324.4 172.743 306.81 183.283L287.04 195.123C276.79 201.273 271.76 213.403 274.67 224.993L280.27 247.353C285.25 267.243 267.24 285.253 247.35 280.273L224.99 274.673C213.4 271.763 201.27 276.793 195.12 287.043L183.28 306.813C172.74 324.403 147.26 324.403 136.72 306.813L124.88 287.043C118.73 276.793 106.6 271.763 95.0102 274.673L72.6462 280.273C52.7632 285.253 34.7472 267.243 39.7292 247.353L45.3332 224.993C48.2382 213.403 43.2143 201.273 32.9603 195.123L13.1873 183.283C-4.39575 172.743 -4.39575 147.263 13.1873 136.723L32.9603 124.883C43.2143 118.733 48.2382 106.603 45.3332 95.0126L39.7292 72.6526C34.7472 52.7626 52.7633 34.7525 72.6453 39.7325L95.0102 45.3325C106.6 48.2425 118.73 43.2125 124.88 32.9625L136.72 13.1925Z" fill="currentColor" />
            </motion.svg>
            <IconPlay size={16} fill="var(--md-sys-color-on-primary)" className="relative z-10 pointer-events-none" />
        </div>
    );
};

// M3 Arch Shape Component (using SVG clip)
const M3ArchImage = ({ src, fallback }: { src: string | null, fallback: React.ReactNode }) => {
    const uniqueId = useMemo(() => `arch-${Math.random().toString(36).substr(2, 9)}`, []);

    return (
        <svg viewBox="0 0 304 304" className="w-full h-full">
            <defs>
                <clipPath id={uniqueId}>
                    <path d="M304 253.72C304 259.83 304 262.89 303.69 265.46C301.31 285.51 285.51 301.31 265.46 303.69C262.89 304 259.83 304 253.72 304H50.281C44.169 304 41.113 304 38.544 303.69C18.495 301.31 2.68799 285.51 0.304993 265.46C-7.33137e-06 262.89 0 259.83 0 253.72V152C0 68.05 68.053 0 152 0C235.95 0 304 68.05 304 152V253.72Z" />
                </clipPath>
            </defs>
            {src ? (
                <image href={src} x="0" y="0" width="304" height="304" preserveAspectRatio="xMidYMid slice" clipPath={`url(#${uniqueId})`} />
            ) : (
                <g clipPath={`url(#${uniqueId})`}>
                    <rect x="0" y="0" width="304" height="304" fill="var(--md-sys-color-surface-container-highest)" />
                    <g transform="translate(128, 128)">
                        {fallback}
                    </g>
                </g>
            )}
        </svg>
    );
};

// Virtuoso Custom Components - Defined outside to prevent re-renders
const GridList = forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'>>(({ style, children, ...props }, ref) => (
    <div
        ref={ref}
        {...props}
        className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4 p-6 content-start"
        style={{ ...style, width: '100%' }}
    >
        {children}
    </div>
));

const GridItem = ({ children, ...props }: React.ComponentPropsWithoutRef<'div'>) => (
    <div {...props} style={{ padding: 0, margin: 0 }}>{children}</div>
);

export function ArtistList() {
    const library = usePlayerStore(state => state.library);
    const playQueue = usePlayerStore(state => state.playQueue);
    const searchQuery = usePlayerStore(state => state.searchQuery);
    const [selectedArtist, setSelectedArtist] = useState<string | null>(null);

    const artists = useMemo(() => {
        const artistMap = new Map<string, Artist>();

        library.forEach(track => {
            const key = track.artist || "Unknown Artist";
            if (!artistMap.has(key)) {
                artistMap.set(key, {
                    name: key,
                    cover: track.cover_image || null,
                    tracks: [],
                    albumCount: 0
                });
            }
            const artist = artistMap.get(key)!;
            artist.tracks.push(track);
            if (!artist.cover && track.cover_image) {
                artist.cover = track.cover_image;
            }
        });

        for (const artist of artistMap.values()) {
            const albums = new Set(artist.tracks.map(t => t.album));
            artist.albumCount = albums.size;
        }

        // Use array sort (stable or not) - sorting by name
        const sortedArtists = Array.from(artistMap.values()).sort((a, b) => a.name.localeCompare(b.name));

        if (!searchQuery.trim()) return sortedArtists;

        const query = searchQuery.toLowerCase();

        if (query.startsWith('artist:')) {
            const term = query.replace('artist:', '').trim();
            if (!term) return sortedArtists;
            return sortedArtists.filter(a => a.name.toLowerCase().includes(term));
        }

        if (query.startsWith('album:')) {
            // Filter artists who have albums matching the term? 
            // Or just return empty if searching strictly for albums?
            // Let's filter artists that contain tracks from that album.
            const term = query.replace('album:', '').trim();
            if (!term) return sortedArtists;
            return sortedArtists.filter(a => a.tracks.some(t => t.album.toLowerCase().includes(term)));
        }

        if (query.startsWith('title:')) {
            return [];
        }

        return sortedArtists.filter(a => a.name.toLowerCase().includes(query));

    }, [library, searchQuery]);

    const handlePlayArtist = (artist: Artist) => {
        if (artist.tracks.length > 0) {
            playQueue(artist.tracks, 0);
        }
    };

    if (selectedArtist) {
        const artist = artists.find(a => a.name === selectedArtist);
        if (!artist) return null;

        return (
            <div className="h-full">
                <ArtistDetailView
                    artist={artist}
                    onBack={() => setSelectedArtist(null)}
                />
            </div>
        );
    }

    return (
        <VirtuosoGrid
            style={{ height: '100%' }}
            data={artists}
            overscan={200}
            components={{
                List: GridList,
                Item: GridItem,
                Footer: () => <div className="h-32"></div>
            }}
            itemContent={(_, artist) => (
                <ArtistCard
                    artist={artist}
                    onClick={() => setSelectedArtist(artist.name)}
                    onPlay={() => handlePlayArtist(artist)}
                />
            )}
        />
    );
}

function ArtistCard({ artist, onClick, onPlay }: { artist: Artist, onClick: () => void, onPlay: () => void }) {
    const coverUrl = useCoverArt(artist.cover);

    return (
        <div
            onClick={onClick}
            className="group flex flex-col gap-3 p-3 rounded-[1.5rem] hover:bg-surface-container-high transition-colors cursor-pointer"
        >
            {/* Artist Image with M3 Arch Shape */}
            <div className="aspect-square w-full relative">
                <div className="w-full h-full">
                    <M3ArchImage
                        src={coverUrl}
                        fallback={<IconMicrophone size={48} />}
                    />
                </div>

                {/* Play Button - Very Sunny Shape - Outside bottom right */}
                <VerySunnyPlayButton onClick={(e) => { e.stopPropagation(); onPlay(); }} />
            </div>

            <div className="px-1 text-center">
                <div className="text-title-medium font-semibold text-on-surface truncate" title={artist.name}>{artist.name}</div>
                <div className="text-body-medium text-on-surface-variant truncate">
                    {artist.albumCount} albums • {artist.tracks.length} songs
                </div>
            </div>
        </div>
    );
}

import { WavySeparator } from './WavySeparator';
import { VerticalWavySeparator } from './VerticalWavySeparator';

// Helper Type for Display Items
type DisplayItem =
    | { type: 'header', album: string }
    | { type: 'track', track: TrackDisplay, index: number };

function ArtistDetailView({ artist, onBack }: { artist: Artist, onBack: () => void }) {
    const { playQueue } = usePlayerStore();
    const coverUrl = useCoverArt(artist.cover);
    const virtuosoRef = useRef<any>(null);

    // Group tracks by Album
    const displayItems = useMemo<DisplayItem[]>(() => {
        // Sort tracks by album, then disk, then track number
        const sorted = [...artist.tracks].sort((a, b) => {
            if (a.album !== b.album) return a.album.localeCompare(b.album);
            if ((a.disc_number || 1) !== (b.disc_number || 1)) return (a.disc_number || 1) - (b.disc_number || 1);
            return (a.track_number || 0) - (b.track_number || 0);
        });

        const items: DisplayItem[] = [];
        let currentAlbum = '';

        sorted.forEach((track, i) => {
            if (track.album !== currentAlbum) {
                items.push({ type: 'header', album: track.album });
                currentAlbum = track.album;
            }
            items.push({ type: 'track', track, index: i });
        });

        return items;
    }, [artist.tracks]);

    // Also need a sorted track list for playback context
    const sortedTracks = useMemo(() => {
        return [...artist.tracks].sort((a, b) => {
            if (a.album !== b.album) return a.album.localeCompare(b.album);
            if ((a.disc_number || 1) !== (b.disc_number || 1)) return (a.disc_number || 1) - (b.disc_number || 1);
            return (a.track_number || 0) - (b.track_number || 0);
        });
    }, [artist.tracks]);

    // Extract unique albums for sidebar
    const albums = useMemo(() => {
        const uniqueAlbums = new Map<string, string | null>(); // Name -> Cover
        artist.tracks.forEach(t => {
            if (!uniqueAlbums.has(t.album)) {
                uniqueAlbums.set(t.album, t.cover_image || null);
            }
        });
        return Array.from(uniqueAlbums.entries()).map(([name, cover]) => ({ name, cover })).sort((a, b) => a.name.localeCompare(b.name));
    }, [artist.tracks]);

    const scrollToAlbum = (albumName: string) => {
        const index = displayItems.findIndex(item => item.type === 'header' && item.album === albumName);
        if (index !== -1 && virtuosoRef.current) {
            virtuosoRef.current.scrollToIndex({ index, align: 'start', offset: -20 });
        }
    };

    return (
        <div className="flex flex-col h-full bg-surface">
            {/* Header */}
            <div className="p-8 flex gap-8 items-center bg-surface-container-low shrink-0">
                <div className="w-52 h-52 shrink-0 shadow-elevation-3">
                    <M3ArchImage
                        src={coverUrl}
                        fallback={<IconMicrophone size={64} />}
                    />
                </div>

                <div className="flex flex-col gap-4 min-w-0 flex-1">
                    <div>
                        <div className="text-label-large font-medium text-on-surface-variant uppercase tracking-wider mb-1">Artist</div>
                        <h1 className="text-display-medium font-bold text-on-surface tracking-tight truncate">{artist.name}</h1>
                    </div>

                    <div className="text-title-medium text-on-surface-variant">
                        {artist.albumCount} Albums • {artist.tracks.length} Songs
                    </div>

                    <div className="flex gap-3 mt-2">
                        <button
                            onClick={() => playQueue(sortedTracks, 0)}
                            className="h-10 px-6 bg-primary text-on-primary rounded-full font-medium hover:bg-primary/90 flex items-center gap-2 shadow-elevation-1 transition-transform active:scale-95"
                        >
                            <IconPlay size={20} fill="currentColor" /> Play Artist
                        </button>
                        <button
                            onClick={onBack}
                            className="h-10 px-6 border border-outline rounded-full text-on-surface font-medium hover:bg-surface-container-high transition-colors"
                        >
                            Back
                        </button>
                    </div>
                </div>
            </div>

            {/* Split View: Sidebar + Tracklist */}
            <div className="flex items-stretch flex-1 min-h-0 overflow-hidden">

                {/* Album Sidebar */}
                <div className="w-64 shrink-0 overflow-y-auto p-4 hidden md:block">
                    <div className="flex flex-col gap-2">
                        <h3 className="text-title-small font-bold text-on-surface-variant mb-2 px-2">Albums</h3>
                        {albums.map(album => (
                            <AlbumSidebarItem
                                key={album.name}
                                name={album.name}
                                cover={album.cover}
                                onClick={() => scrollToAlbum(album.name)}
                            />
                        ))}
                    </div>
                </div>

                {/* Vertical Wavy Separator */}
                <VerticalWavySeparator />

                {/* Tracklist */}
                <div className="flex-1 p-6 min-w-0">
                    <Virtuoso
                        ref={virtuosoRef}
                        style={{ height: '100%' }}
                        data={displayItems}
                        overscan={100}
                        itemContent={(i, item) => {
                            if (item.type === 'header') {
                                return (
                                    <div className="py-4 mt-4 first:mt-0 sticky top-0 bg-surface z-10">
                                        <WavySeparator label={item.album} />
                                    </div>
                                );
                            }

                            // Track Item
                            return (
                                <div
                                    key={item.track.id}
                                    onClick={() => {
                                        // Find index in sortedTracks
                                        const index = sortedTracks.findIndex(t => t.id === item.track.id);
                                        playQueue(sortedTracks, index);
                                    }}
                                    className="group flex items-center gap-4 p-3 rounded-xl hover:bg-surface-container-highest cursor-pointer text-on-surface-variant hover:text-on-surface transition-colors"
                                >
                                    <span className="w-8 text-center text-title-medium font-medium opacity-60 group-hover:opacity-100">
                                        {item.track.track_number || (i + 1)}
                                    </span>
                                    <span className="flex-1 font-medium text-body-large truncate">{item.track.title}</span>
                                    {/* Removed Album column since we have headers now */}
                                    <span className="text-label-medium font-medium opacity-60 tabular-nums">
                                        {Math.floor(item.track.duration_secs / 60)}:
                                        {Math.floor(item.track.duration_secs % 60).toString().padStart(2, '0')}
                                    </span>
                                </div>
                            );
                        }}
                        components={{
                            Footer: () => <div className="h-24"></div>
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

function AlbumSidebarItem({ name, cover, onClick }: { name: string, cover: string | null, onClick: () => void }) {
    const coverUrl = useCoverArt(cover);

    return (
        <div
            onClick={onClick}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-container-high cursor-pointer transition-colors group"
        >
            <div className="w-10 h-10 shrink-0 rounded-md overflow-hidden bg-surface-container-highest shadow-sm">
                {coverUrl ? (
                    <img src={coverUrl} alt={name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-on-surface-variant/50">
                        <IconMicrophone size={20} />
                    </div>
                )}
            </div>
            <span className="text-body-medium font-medium text-on-surface-variant group-hover:text-on-surface truncate">
                {name}
            </span>
        </div>
    );
}
