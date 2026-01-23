import { useThemeStore } from '../store/themeStore';

export function AmbientBackground() {
    // Dynamic colors from global store
    const { surface, primary, secondary } = useThemeStore(state => state.colors);

    return (
        <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
            {/* Base dark layer */}
            <div className="absolute inset-0 bg-[#0a0a0f]" />

            {/* Dynamic gradient background based on album art */}
            <div
                className="absolute inset-0 transition-all duration-1000 ease-out"
                style={{
                    background: `
                        radial-gradient(ellipse at 0% 0%, ${surface}40 0%, transparent 50%),
                        radial-gradient(ellipse at 100% 0%, ${primary}30 0%, transparent 50%),
                        radial-gradient(ellipse at 100% 100%, ${secondary}25 0%, transparent 50%),
                        radial-gradient(ellipse at 0% 100%, ${surface}35 0%, transparent 50%),
                        radial-gradient(ellipse at 50% 50%, ${surface}60 0%, transparent 70%)
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
