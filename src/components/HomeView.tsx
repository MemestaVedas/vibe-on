import { useMemo } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { useNavigationStore } from '../store/navigationStore';
import { M3SquircleImage, M3CircleImage } from './ShapeComponents';
import { IconAlbum, IconMicrophone } from './Icons';
import { TrackDisplay } from '../types';
import { useCoverArt } from '../hooks/useCoverArt';

export function HomeView() {
    const { history, library, playCounts, playQueue } = usePlayerStore();
    const { navigateToAlbum, navigateToArtist } = useNavigationStore();

    // 1. Time-based Greeting
    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    }, []);

    // 2. Quick Recall (Top 6 unique items from history or top played)
    const quickRecallItems = useMemo(() => {
        // Try history first (unique albums)
        const uniqueAlbums = new Map<string, TrackDisplay>();
        for (const track of history) {
            const key = `${track.album}-${track.artist}`;
            if (!uniqueAlbums.has(key)) {
                uniqueAlbums.set(key, track);
            }
            if (uniqueAlbums.size >= 6) break;
        }

        // If history is empty, fallback to library
        if (uniqueAlbums.size === 0) {
            for (let i = 0; i < Math.min(6, library.length); i++) {
                const track = library[i];
                const key = `${track.album}-${track.artist}`;
                if (!uniqueAlbums.has(key)) {
                    uniqueAlbums.set(key, track);
                }
            }
        }

        return Array.from(uniqueAlbums.values()).slice(0, 6);
    }, [history, library]);

    // 3. Jump Back In -> Recent Albums (Next 10 from history after the quick recall, or just history)
    const jumpBackInItems = useMemo(() => {
        const uniqueAlbums = new Map<string, TrackDisplay>();
        for (const track of history) {
            const key = `${track.album}-${track.artist}`;
            if (!uniqueAlbums.has(key)) {
                uniqueAlbums.set(key, track);
            }
        }
        // Return max 12
        return Array.from(uniqueAlbums.values()).slice(0, 12);
    }, [history]);

    // 4. Recently Added (Last 12 items from library, assuming naturally ordered)
    const recentlyAddedItems = useMemo(() => {
        const uniqueAlbums = new Map<string, TrackDisplay>();
        // Iterate backwards through library
        for (let i = library.length - 1; i >= 0; i--) {
            const track = library[i];
            const key = `${track.album}-${track.artist}`;
            if (!uniqueAlbums.has(key)) {
                uniqueAlbums.set(key, track);
            }
            if (uniqueAlbums.size >= 12) break;
        }
        return Array.from(uniqueAlbums.values());
    }, [library]);

    // 5. Your Artists
    const topArtists = useMemo(() => {
        // Group by artist and sum playcounts if possible, otherwise just unique artists
        const artistCounts = new Map<string, { artist: string, count: number, track: TrackDisplay }>();

        library.forEach(track => {
            const current = artistCounts.get(track.artist) || { artist: track.artist, count: 0, track };
            current.count += (playCounts[track.path] || 0) + 1; // +1 so every artist has at least 1 weight
            artistCounts.set(track.artist, current);
        });

        return Array.from(artistCounts.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 12)
            .map(a => a.track);
    }, [library, playCounts]);

    const handlePlayAlbum = (track: TrackDisplay, e: React.MouseEvent) => {
        e.stopPropagation();
        const albumTracks = library.filter(t => t.album === track.album && t.artist === track.artist);
        if (albumTracks.length > 0) {
            playQueue(albumTracks, 0);
        }
    };

    return (
        <div className="absolute inset-0 overflow-y-auto no-scrollbar p-6 bg-surface">
            {/* Header / Greeting */}
            <div className="mb-8 pt-10">
                <h1 className="text-[2.5rem] leading-tight font-black tracking-tight text-on-surface">
                    {greeting}
                </h1>
            </div>

            {/* Quick Recall Grid (2x3 or 2xN) */}
            {quickRecallItems.length > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-12">
                    {quickRecallItems.map(track => (
                        <QuickRecallItem
                            key={track.path}
                            track={track}
                            onPlay={handlePlayAlbum}
                            onClick={() => navigateToAlbum(track.album, track.artist)}
                        />
                    ))}
                </div>
            )}

            {/* Jump Back In (History) */}
            {jumpBackInItems.length > 0 && (
                <CarouselSection
                    title="Jump back in"
                    items={jumpBackInItems}
                    onItemClick={(track) => navigateToAlbum(track.album, track.artist)}
                    onPlayClick={handlePlayAlbum}
                    type="album"
                />
            )}

            {/* Recently Added */}
            {recentlyAddedItems.length > 0 && (
                <CarouselSection
                    title="Recently added"
                    items={recentlyAddedItems}
                    onItemClick={(track) => navigateToAlbum(track.album, track.artist)}
                    onPlayClick={handlePlayAlbum}
                    type="album"
                />
            )}

            {/* Your Top Artists */}
            {topArtists.length > 0 && (
                <CarouselSection
                    title="Your top artists"
                    items={topArtists}
                    onItemClick={(track) => navigateToArtist(track.artist)}
                    type="artist"
                />
            )}

            {/* Bottom Padding */}
            <div className="h-32" />
        </div>
    );
}

// Subcomponents to securely use hooks per-item

function QuickRecallItem({ track, onPlay, onClick }: { track: TrackDisplay, onPlay: (t: TrackDisplay, e: React.MouseEvent) => void, onClick: () => void }) {
    const coverUrl = useCoverArt(track.cover_image ?? null, track.path);

    return (
        <div
            onClick={onClick}
            className="group flex items-center gap-4 bg-surface-container-low hover:bg-surface-container-high rounded-xl overflow-hidden cursor-pointer transition-colors shadow-sm"
        >
            <div className="w-16 h-16 shrink-0 shadow-md">
                <M3SquircleImage
                    src={coverUrl}
                    fallback={<IconAlbum size={24} className="opacity-50" />}
                />
            </div>
            <div className="min-w-0 pr-4 flex-1 py-3">
                <div className="text-title-small font-bold text-on-surface truncate group-hover:text-primary transition-colors">
                    {track.album}
                </div>
            </div>

            {/* Play Button Overlay on Hover */}
            <div className="opacity-0 group-hover:opacity-100 pr-4 transition-opacity">
                <button
                    onClick={(e) => onPlay(track, e)}
                    className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-elevation-1 hover:scale-105 transition-transform"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

function CarouselSection({
    title,
    items,
    onItemClick,
    onPlayClick,
    type
}: {
    title: string;
    items: TrackDisplay[];
    onItemClick: (t: TrackDisplay) => void;
    onPlayClick?: (t: TrackDisplay, e: React.MouseEvent) => void;
    type: 'album' | 'artist';
}) {
    return (
        <div className="mb-10">
            <h2 className="text-title-large font-bold text-on-surface mb-4 px-1">{title}</h2>

            <div className="flex gap-6 overflow-x-auto no-scrollbar pb-6 px-1 snap-x">
                {items.map((track, i) => (
                    <CarouselItem
                        key={`${track.path}-${i}`}
                        track={track}
                        type={type}
                        onItemClick={onItemClick}
                        onPlayClick={onPlayClick}
                    />
                ))}
            </div>
        </div>
    );
}

function CarouselItem({
    track,
    type,
    onItemClick,
    onPlayClick
}: {
    track: TrackDisplay,
    type: 'album' | 'artist',
    onItemClick: (t: TrackDisplay) => void,
    onPlayClick?: (t: TrackDisplay, e: React.MouseEvent) => void
}) {
    const coverUrl = useCoverArt(track.cover_image ?? null, track.path);

    return (
        <div
            onClick={() => onItemClick(track)}
            className="group flex flex-col w-[160px] shrink-0 cursor-pointer snap-start"
        >
            {/* Cover Image */}
            <div className="w-[160px] h-[160px] mb-4 relative shadow-elevation-1 rounded-2xl group-hover:shadow-elevation-2 transition-shadow">
                {type === 'album' ? (
                    <M3SquircleImage
                        src={coverUrl}
                        fallback={<IconAlbum size={40} className="opacity-50" />}
                    />
                ) : (
                    <M3CircleImage
                        src={coverUrl}
                        fallback={<IconMicrophone size={40} className="opacity-50" />}
                    />
                )}

                {/* Play Button Overlay */}
                {onPlayClick && (
                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0">
                        <button
                            onClick={(e) => onPlayClick(track, e)}
                            className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-elevation-3 hover:scale-105 transition-transform"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>

            {/* Title & Subtitle */}
            <div className={`font-bold text-body-large text-on-surface truncate group-hover:text-primary transition-colors ${type === 'artist' ? 'text-center' : ''}`}>
                {type === 'album' ? track.album : track.artist}
            </div>
            {type === 'album' && (
                <div className="text-body-medium text-on-surface-variant truncate mt-1">
                    {track.artist}
                </div>
            )}
            {type === 'artist' && (
                <div className="text-body-medium text-on-surface-variant truncate mt-1 text-center">
                    Artist
                </div>
            )}
        </div>
    );
}
