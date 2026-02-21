import { useState, useMemo, forwardRef, useRef, useEffect } from 'react';
import { VirtuosoGrid, Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { usePlayerStore } from '../store/playerStore';
import { useNavigationStore } from '../store/navigationStore';
import { useCoverArt } from '../hooks/useCoverArt';
import { IconMicrophone, IconPlay } from './Icons';
import { M3CircleImage } from './ShapeComponents';
import type { TrackDisplay } from '../types';
import { getDisplayText } from '../utils/textUtils';
import { motion } from 'motion/react';
import { ContextMenu } from './ContextMenu';

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
    const displayLanguage = usePlayerStore(state => state.displayLanguage);
    const { selectedArtistName, navigateToArtist, clearSelectedArtist } = useNavigationStore();

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

        const sortedArtists = Array.from(artistMap.values()).sort((a, b) => a.name.localeCompare(b.name));

        if (!searchQuery.trim()) return sortedArtists;

        const query = searchQuery.toLowerCase();

        if (query.startsWith('artist:')) {
            const term = query.replace('artist:', '').trim();
            if (!term) return sortedArtists;
            return sortedArtists.filter(a => a.name.toLowerCase().includes(term));
        }

        if (query.startsWith('album:')) {
            const term = query.replace('album:', '').trim();
            if (!term) return sortedArtists;
            return sortedArtists.filter(a => a.tracks.some(t => t.album.toLowerCase().includes(term)));
        }

        return sortedArtists.filter(a => {
            // Check artist name (original)
            if (a.name.toLowerCase().includes(query)) return true;

            // Check tracks for Romaji/English artist metadata
            // We only need to check one track since they are grouped by artist
            const firstTrack = a.tracks[0];
            if (firstTrack && (firstTrack.artist_romaji && firstTrack.artist_romaji.toLowerCase().includes(query.toLowerCase()))) return true;
            if (firstTrack && (firstTrack.artist_en && firstTrack.artist_en.toLowerCase().includes(query.toLowerCase()))) return true;

            return false;
        });

    }, [library, searchQuery]);

    const handlePlayArtist = (artist: Artist) => {
        if (artist.tracks.length > 0) {
            playQueue(artist.tracks, 0);
        }
    };

    const currentSelectedArtist = useMemo(() => {
        return artists.find(a => a.name === selectedArtistName);
    }, [artists, selectedArtistName]);

    return (
        <div className="h-full relative overflow-hidden">
            {/* List View - Persistent in background to preserve scroll/measurements */}
            <div
                className={`absolute inset-0 transition-opacity duration-300 ${selectedArtistName ? 'invisible opacity-0 pointer-events-none' : 'visible opacity-100'}`}
            >
                <VirtuosoGrid
                    style={{ height: '100%' }}
                    data={artists}
                    overscan={1200}
                    components={{
                        List: GridList,
                        Item: GridItem,
                        Footer: () => <div className="h-32"></div>
                    }}
                    itemContent={(_, artist) => (
                        <ArtistItem
                            artist={artist}
                            displayLanguage={displayLanguage}
                            setSelectedArtist={navigateToArtist}
                            handlePlayArtist={handlePlayArtist}
                        />
                    )}
                />
            </div>

            {/* Detail View */}
            {selectedArtistName && currentSelectedArtist && (
                <div className="h-full animate-in fade-in slide-in-from-right-4 duration-300">
                    <ArtistDetailView
                        artist={currentSelectedArtist}
                        onBack={clearSelectedArtist}
                    />
                </div>
            )}
        </div>
    );
}

// Extracted component to safely use hooks
const ArtistItem = ({
    artist,
    displayLanguage,
    setSelectedArtist,
    handlePlayArtist
}: {
    artist: Artist,
    displayLanguage: any,
    setSelectedArtist: (name: string) => void,
    handlePlayArtist: (artist: Artist) => void
}) => {
    // Use the first track to resolve display name for the Artist
    const firstTrack = artist.tracks[0];
    const displayArtistName = getDisplayText(firstTrack, 'artist', displayLanguage);
    const coverUrl = useCoverArt(artist.cover, firstTrack?.path);
    // console.log(`[ArtistItem] ${artist.name}: CoverRaw: ${artist.cover}, URL: ${coverUrl}`);

    return (
        <div
            onClick={() => setSelectedArtist(artist.name)}
            className="group flex flex-col gap-3 p-3 rounded-[1.5rem] hover:bg-surface-container-high transition-colors cursor-pointer"
        >
            <div className="aspect-square w-full relative">
                <div className="w-full h-full">
                    <M3ArchImage
                        src={coverUrl}
                        fallback={<IconMicrophone size={48} className="opacity-50" />}
                    />
                </div>
                <VerySunnyPlayButton onClick={(e) => { e.stopPropagation(); handlePlayArtist(artist); }} />
            </div>

            <div className="flex flex-col items-center text-center gap-0.5 min-h-[3.5rem]">
                <span className="text-title-medium font-semibold text-on-surface truncate w-full" title={displayArtistName}>
                    {displayArtistName}
                </span>
                <span className="text-body-medium text-on-surface-variant">
                    {artist.albumCount} {artist.albumCount === 1 ? 'Album' : 'Albums'}
                </span>
            </div>
        </div>
    );
};

import { WavySeparator } from './WavySeparator';
import { VerticalWavySeparator } from './VerticalWavySeparator';

// Helper Type for Display Items
type DisplayItem =
    | { type: 'header', album: string, displayAlbum: string }
    | { type: 'track', track: TrackDisplay, index: number };

function ArtistDetailView({ artist, onBack }: { artist: Artist, onBack: () => void }) {
    const playQueue = usePlayerStore(state => state.playQueue);
    const displayLanguage = usePlayerStore(state => state.displayLanguage);
    const displayArtistName = getDisplayText(artist.tracks[0], 'artist', displayLanguage);
    const coverUrl = useCoverArt(artist.cover, artist.tracks[0]?.path);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const [showStickyHeader, setShowStickyHeader] = useState(false);
    const [scroller, setScroller] = useState<HTMLElement | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; track: TrackDisplay } | null>(null);


    const handleContextMenu = (e: React.MouseEvent, track: TrackDisplay) => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            track
        });
    };

    // Sort tracks: By Album, then by Disc, then by Track
    const sortedTracks = useMemo(() => {
        return [...artist.tracks].sort((a, b) => {
            if (a.album !== b.album) return a.album.localeCompare(b.album);
            const discA = a.disc_number || 1;
            const discB = b.disc_number || 1;
            if (discA !== discB) return discA - discB;
            return (a.track_number || 0) - (b.track_number || 0);
        });
    }, [artist.tracks]);

    // Extract albums for sidebar
    const albums = useMemo(() => {
        const albumMap = new Map<string, { name: string, cover: string | null, firstTrack: TrackDisplay }>();
        sortedTracks.forEach(t => {
            if (!albumMap.has(t.album)) {
                albumMap.set(t.album, { name: t.album, cover: t.cover_image || null, firstTrack: t });
            }
        });
        return Array.from(albumMap.values());
    }, [sortedTracks]);

    // Prepare display items with headers
    const displayItems = useMemo<DisplayItem[]>(() => {
        const items: DisplayItem[] = [];
        let currentAlbum = '';

        sortedTracks.forEach((track, index) => {
            if (track.album !== currentAlbum) {
                const displayAlbum = getDisplayText(track, 'album', displayLanguage);
                items.push({ type: 'header', album: track.album, displayAlbum });
                currentAlbum = track.album;
            }
            items.push({ type: 'track', track, index });
        });
        return items;
    }, [sortedTracks, displayLanguage]);

    const scrollToAlbum = (albumName: string) => {
        const index = displayItems.findIndex(item => item.type === 'header' && item.album === albumName);
        if (index !== -1 && virtuosoRef.current) {
            virtuosoRef.current.scrollToIndex({ index, align: 'start', offset: -100 });
        }
    };

    // Handle scroll for sticky header toggle
    const handleScroll = () => {
        if (scrollContainerRef.current) {
            setShowStickyHeader(scrollContainerRef.current.scrollTop > 300);
        }
    };

    // Initialize scroller once ref is ready
    useEffect(() => {
        setScroller(scrollContainerRef.current);
    }, []);

    return (
        <div className="h-full relative isolate bg-surface">
            {/* Sticky Header Overlay */}
            <div
                className={`absolute top-0 left-0 right-0 h-20 bg-surface-container/95 backdrop-blur-md z-50 flex items-center px-6 gap-4 border-b border-surface-container-highest transition-opacity duration-300 ${showStickyHeader ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
            >
                <button
                    onClick={onBack}
                    className="p-2 -ml-2 rounded-full hover:bg-on-surface/5 transition-colors"
                >
                    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor">
                        <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                    </svg>
                </button>
                <span className="font-bold text-title-large text-on-surface truncate">{displayArtistName}</span>
                <div className="flex-1" />
                <button
                    onClick={() => playQueue(sortedTracks, 0)}
                    className="h-10 px-6 bg-primary text-on-primary rounded-full font-medium hover:bg-primary/90 flex items-center gap-2 shadow-sm scale-90"
                >
                    <IconPlay size={18} fill="currentColor" /> Play
                </button>
            </div>

            {/* Main Scroll Container */}
            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="h-full overflow-y-auto no-scrollbar relative"
            >
                {/* Header */}
                <div className="p-8 pb-6 flex gap-8 items-end bg-surface-container-low">
                    <div className="w-40 h-40 shrink-0 shadow-elevation-2">
                        <M3ArchImage
                            src={coverUrl}
                            fallback={<IconMicrophone size={56} />}
                        />
                    </div>

                    <div className="flex flex-col gap-3 min-w-0 flex-1 mb-1">
                        <div>
                            <div className="text-label-medium font-medium text-on-surface-variant uppercase tracking-wider mb-1">Artist</div>
                            <h1 className="text-display-small font-bold text-on-surface tracking-tight text-wrap leading-tight">{displayArtistName}</h1>
                        </div>

                        <div className="text-title-medium text-on-surface-variant">
                            {artist.albumCount} {artist.albumCount === 1 ? 'Album' : 'Albums'} • {artist.tracks.length} Songs
                        </div>

                        <div className="flex gap-3 mt-1">
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

                {/* Content: Sidebar + Tracklist */}
                <div className="flex items-stretch min-h-[calc(100vh-20rem)] pb-32">
                    {/* Sticky Sidebar */}
                    <div className="hidden md:flex w-64 shrink-0 p-4 sticky top-[25vh] flex-col z-10 max-h-[50vh] overflow-y-auto no-scrollbar">
                        <div className="flex flex-col gap-2">
                            <h3 className="text-title-small font-bold text-on-surface-variant mb-2 px-2 mt-2">Albums</h3>
                            {albums.map(album => (
                                <AlbumSidebarItem
                                    key={album.name}
                                    name={album.name}
                                    displayLanguage={displayLanguage}
                                    firstTrack={album.firstTrack}
                                    cover={album.cover}
                                    onClick={() => scrollToAlbum(album.name)}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Separator - Sticky and matched to viewport */}
                    <div className="hidden md:block w-3 shrink-0 sticky top-0 h-screen z-0 opacity-80">
                        <VerticalWavySeparator />
                    </div>

                    {/* Tracklist */}
                    <div className="flex-1 p-6 min-w-0">
                        {scroller && (
                            <Virtuoso
                                ref={virtuosoRef}
                                customScrollParent={scroller}
                                data={displayItems}
                                overscan={200}
                                itemContent={(_i, item) => {
                                    if (item.type === 'header') {
                                        return (
                                            <div className="py-4 mt-6 first:mt-0 sticky top-0 bg-surface z-[5]">
                                                <WavySeparator label={item.displayAlbum} />
                                            </div>
                                        );
                                    }

                                    // Track Item
                                    const displayTitle = getDisplayText(item.track, 'title', displayLanguage);

                                    return (
                                        <div
                                            key={item.track.id}
                                            onClick={() => {
                                                const index = sortedTracks.findIndex(t => t.id === item.track.id);
                                                playQueue(sortedTracks, index);
                                            }}
                                            onContextMenu={(e) => handleContextMenu(e, item.track)}
                                            className="group flex items-center gap-4 p-3 rounded-xl hover:bg-surface-container-highest cursor-pointer text-on-surface-variant hover:text-on-surface transition-colors"
                                        >
                                            <span className="w-8 text-center text-title-medium font-medium opacity-60 group-hover:opacity-100">
                                                {item.track.track_number || (item.index + 1)}
                                            </span>
                                            <span className="flex-1 font-medium text-body-large truncate">{displayTitle}</span>
                                            <span className="text-label-medium font-medium opacity-60 tabular-nums">
                                                {Math.floor(item.track.duration_secs / 60)}:
                                                {Math.floor(item.track.duration_secs % 60).toString().padStart(2, '0')}
                                            </span>
                                        </div>
                                    );
                                }}
                            />
                        )}
                    </div>
                </div>
            </div>
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    track={contextMenu.track}
                    onClose={() => setContextMenu(null)}
                />
            )}
        </div>
    );
}

function AlbumSidebarItem({
    name,
    cover,
    firstTrack,
    displayLanguage,
    onClick
}: {
    name: string,
    cover: string | null,
    firstTrack: TrackDisplay,
    displayLanguage: any,
    onClick: () => void
}) {
    const coverUrl = useCoverArt(cover, firstTrack?.path);
    const displayName = getDisplayText(firstTrack, 'album', displayLanguage);

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
            <span className="text-body-medium font-medium text-on-surface-variant group-hover:text-on-surface line-clamp-2 leading-tight text-wrap">
                {displayName}
            </span>
        </div>
    );
}
