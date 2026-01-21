
import { usePlayerStore } from '../store/playerStore';
import { useCoverArt } from '../hooks/useCoverArt';
import { useImageColors } from '../hooks/useImageColors';

export function AmbientBackground() {
    const { status, library } = usePlayerStore();
    const track = status.track;

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
            <div className="absolute inset-0 bg-[#0b0c0e]/60 z-10 backdrop-blur-[100px]" />

            {/* Animated Blobs */}
            <div className="absolute inset-0 z-0 opacity-60">
                {/* Blob 1 */}
                <div
                    className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] rounded-full mix-blend-screen filter blur-[80px] opacity-70 animate-blob"
                    style={{ backgroundColor: color1, transition: 'background-color 2s ease' }}
                />

                {/* Blob 2 */}
                <div
                    className="absolute top-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full mix-blend-screen filter blur-[80px] opacity-70 animate-blob animation-delay-2000"
                    style={{ backgroundColor: color2, transition: 'background-color 2s ease' }}
                />

                {/* Blob 3 */}
                <div
                    className="absolute bottom-[-20%] left-[20%] w-[60vw] h-[60vw] rounded-full mix-blend-screen filter blur-[80px] opacity-70 animate-blob animation-delay-4000"
                    style={{ backgroundColor: color3, transition: 'background-color 2s ease' }}
                />
            </div>

            {/* Noise Texture */}
            <div className="absolute inset-0 z-20 opacity-[0.03] pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MDAiIGhlaWdodD0iNTAwIj48ZmlsdGVyIGlkPSJnoiPjZmZVR1cmJ1bGVuY2UgdHlwZT0iZnJhY3RhbE5vaXNlIiBiYXNlRnJlcXVlbmN5PSIwLjY1IiBudW1PY3RhdmVzPSIzIiBzdGl0Y2hUaWxlcz0ic3RpdGNoIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsdGVyPSJ1cmwoI2cpIiBvcGFjaXR5PSIxIi8+PC9zdmc+')]" />
        </div>
    );
}
