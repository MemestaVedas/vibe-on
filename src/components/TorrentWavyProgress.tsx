import { useRef, useMemo, useState, useEffect, memo } from 'react';

interface TorrentWavyProgressProps {
    progress: number;
    isActive?: boolean;
    className?: string;
    accentColor?: string;
    trackColor?: string;
}

export const TorrentWavyProgress = memo(function TorrentWavyProgress({
    progress,
    isActive = false,
    className = '',
    accentColor = 'var(--md-sys-color-primary)',
    trackColor = 'var(--md-sys-color-surface-container-highest)'
}: TorrentWavyProgressProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(400);

    // Monitor container resizing
    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.contentRect.width > 0) {
                    setWidth(entry.contentRect.width);
                }
            }
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const percent = Math.min(100, Math.max(0, progress * 100));

    const { straightPath, squigglyPath } = useMemo(() => {
        const safeWidth = typeof width === 'number' && !isNaN(width) && width > 0 ? width : 400;
        const wavelength = 25;
        const frequency = (2 * Math.PI) / wavelength;
        const amplitude = 3; 
        const step = 2;

        let straight = `M 0 10`;
        let squiggly = `M 0 10`;

        for (let x = 0; x <= safeWidth; x += step) {
            straight += ` L ${x} 10`;
            const y = 10 + Math.sin(x * frequency) * amplitude;
            squiggly += ` L ${x} ${y}`;
        }

        straight += ` L ${safeWidth} 10`;
        squiggly += ` L ${safeWidth} ${10 + Math.sin(safeWidth * frequency) * amplitude}`;

        return {
            straightPath: straight,
            squigglyPath: squiggly
        };
    }, [width]);

    // Phase shift animation for moving wave effect
    const [phase, setPhase] = useState(0);
    useEffect(() => {
        if (!isActive) return;

        let animationFrame: number;
        const animate = (time: number) => {
            setPhase(time / 150); // Control speed
            animationFrame = requestAnimationFrame(animate);
        };
        animationFrame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrame);
    }, [isActive]);

    // Dynamic wave path with phase shift
    const animatedSquigglyPath = useMemo(() => {
        if (!isActive) return squigglyPath;

        const safeWidth = typeof width === 'number' && !isNaN(width) && width > 0 ? width : 400;
        const wavelength = 25;
        const frequency = (2 * Math.PI) / wavelength;
        const amplitude = 3;
        const step = 4; // Larger step for animation performance

        let p = `M 0 10`;
        for (let x = 0; x <= safeWidth; x += step) {
            const y = 10 + Math.sin(x * frequency + phase) * amplitude;
            p += ` L ${x} ${y}`;
        }
        return p;
    }, [isActive, phase, width, squigglyPath]);

    const currentPath = isActive ? animatedSquigglyPath : straightPath;

    return (
        <div
            className={`relative h-5 flex items-center ${className}`}
            ref={containerRef}
        >
            {/* Background Track */}
            <svg
                className="absolute inset-0 w-full h-full overflow-visible"
                preserveAspectRatio="none"
                viewBox={`0 0 ${width} 20`}
            >
                <path
                    d={straightPath}
                    fill="none"
                    stroke={trackColor}
                    strokeWidth="4"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                />
            </svg>

            {/* Active Progress - Clipped Container style similar to SquigglySlider */}
            <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${percent}%` }}
            >
                <svg
                    className="absolute top-0 left-0 h-full overflow-visible"
                    style={{ width: width }}
                    preserveAspectRatio="none"
                    viewBox={`0 0 ${width} 20`}
                >
                    <path
                        d={currentPath}
                        fill="none"
                        stroke={accentColor}
                        strokeWidth="4"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                    />
                </svg>
            </div>
        </div>
    );
});
