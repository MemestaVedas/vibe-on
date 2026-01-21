
import { usePlayerStore } from '../store/playerStore';
import { useCoverArt } from '../hooks/useCoverArt';
import { useImageColors } from '../hooks/useImageColors';

export function AmbientBackground() {
    // Optimization: Only subscribe to the track changes, not the playback status (position, etc.)
    const track = usePlayerStore(state => state.status.track);
    const library = usePlayerStore(state => state.library);

    // Get cover URL
    const currentIndex = library.findIndex(t => t.path === track?.path);
    const currentLibraryTrack = currentIndex >= 0 ? library[currentIndex] : null;
    const coverUrl = useCoverArt(currentLibraryTrack?.cover_image);

    // Get dynamic colors from album art
    const { background, backgroundRaw, accent1, accent2 } = useImageColors(coverUrl);

    return (
        <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
            {/* Base dark layer */}
            <div className="absolute inset-0 bg-[#0a0a0f]" />

            {/* Dynamic gradient background based on album art */}
            <div
                className="absolute inset-0 transition-all duration-1000 ease-out"
                style={{
                    background: `
                        radial-gradient(ellipse at 0% 0%, ${backgroundRaw}40 0%, transparent 50%),
                        radial-gradient(ellipse at 100% 0%, ${accent1}30 0%, transparent 50%),
                        radial-gradient(ellipse at 100% 100%, ${accent2}25 0%, transparent 50%),
                        radial-gradient(ellipse at 0% 100%, ${backgroundRaw}35 0%, transparent 50%),
                        radial-gradient(ellipse at 50% 50%, ${background}60 0%, transparent 70%)
                    `
                }}
            />

            {/* Dark overlay to ensure text readability */}
            <div className="absolute inset-0 bg-black/50" />

            {/* Noise Texture for subtle grain */}
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MDAiIGhlaWdodD0iNTAwIj48ZmlsdGVyIGlkPSJnIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iMC42NSIgbnVtT2N0YXZlcz0iMyIgc3RpdGNoVGlsZXM9InN0aXRjaCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNnKSIgb3BhY2l0eT0iMSIvPjwvc3ZnPg==')]" />
        </div>
    );
}
