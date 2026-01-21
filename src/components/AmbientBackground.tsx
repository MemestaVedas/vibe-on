
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

    // Get extracted colors
    const { colors } = useImageColors(coverUrl);

    // Default Vibe theme colors
    const defaultColors = ['#ff00cc', '#333399', '#ff00cc'];
    const activeColors = colors.length > 0 ? colors : defaultColors;

    // Safe access to colors for the blobs
    const color1 = activeColors[0] || activeColors[0];
    const color2 = activeColors[1] || activeColors[0];
    const color3 = activeColors[2] || activeColors[1] || activeColors[0];

    return (
        <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none bg-[#0b0c0e]">
            {/* Dark overlay to ensure text readability */}
            <div className="absolute inset-0 bg-black/40 z-10" />

            {/* REMOVED: potentially expensive global backdrop blur 
               <div className="absolute inset-0 bg-[#0b0c0e]/60 z-10 backdrop-blur-[100px]" /> 
            */}

            {/* Instead, we use a lighter overlay without the blur, relying on the blobs' own blur */}
            <div className="absolute inset-0 bg-[#0b0c0e]/40 z-10" />

            {/* 2D Flat Gradient Background (No Blue/GPU heavy filters) */}
            <div
                className="absolute inset-0 z-0 transition-colors duration-1000 ease-in-out"
                style={{
                    background: `
                        radial-gradient(circle at 0% 0%, ${color1}40 0%, transparent 50%),
                        radial-gradient(circle at 100% 0%, ${color2}40 0%, transparent 50%),
                        radial-gradient(circle at 100% 100%, ${color3}40 0%, transparent 50%),
                        radial-gradient(circle at 0% 100%, ${color1}40 0%, transparent 50%)
                    `
                }}
            />

            {/* Noise Texture */}
            <div className="absolute inset-0 z-20 opacity-[0.03] pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MDAiIGhlaWdodD0iNTAwIj48ZmlsdGVyIGlkPSJnoiPjZmZVR1cmJ1bGVuY2UgdHlwZT0iZnJhY3RhbE5vaXNlIiBiYXNlRnJlcXVlbmN5PSIwLjY1IiBudW1PY3RhdmVzPSIzIiBzdGl0Y2hUaWxlcz0ic3RpdGNoIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsdGVyPSJ1cmwoI2cpIiBvcGFjaXR5PSIxIi8+PC9zdmc+')]" />
        </div>
    );
}
