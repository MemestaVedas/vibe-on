import { useRef, useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';

interface SquigglySliderProps {
    value: number;
    max: number;
    onChange: (newValue: number) => void;
    isPlaying?: boolean;
    className?: string;
    accentColor?: string;
}

export function SquigglySlider({ value, max, onChange, isPlaying = false, className = '', accentColor }: SquigglySliderProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(400); // Default width to prevent layout shift

    // Monitor container resizing to update wave density dynamically
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

    const progress = Math.min(1, Math.max(0, value / (max || 1)));
    const percent = progress * 100;

    // Generate paths based on ACTUAL container width
    // This ensures constant wave density (wavelength) regardless of screen size
    const { straightPath, squigglyPath } = useMemo(() => {
        // Target wavelength: ~25px
        // Frequency = 2*PI / wavelength
        const wavelength = 25;
        const frequency = (2 * Math.PI) / wavelength;
        const amplitude = 4; // Height of wave
        const step = 2; // Resolution (pixels per point) - lower is smoother but heavier

        let straight = `M 0 10`;
        let squiggly = `M 0 10`;

        // Generate points across the full width
        for (let x = 0; x <= width; x += step) {
            // Straight line
            straight += ` L ${x} 10`;

            // Sine wave
            const y = 10 + Math.sin(x * frequency) * amplitude;
            squiggly += ` L ${x} ${y}`;
        }

        // Ensure the line ends exactly at the right edge
        straight += ` L ${width} 10`;
        squiggly += ` L ${width} ${10 + Math.sin(width * frequency) * amplitude}`;

        return { straightPath: straight, squigglyPath: squiggly };
    }, [width]);

    const currentPath = isPlaying ? squigglyPath : straightPath;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(parseFloat(e.target.value));
    };

    return (
        <div className={`relative h-6 group ${className}`} ref={containerRef}>
            {/* SVG Background Layer (Inactive Track) */}
            <svg
                className="absolute inset-0 w-full h-full overflow-visible"
                preserveAspectRatio="none"
                viewBox={`0 0 ${width} 20`}
            >
                <motion.path
                    d={currentPath}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="text-white/10"
                    vectorEffect="non-scaling-stroke"
                    animate={{ d: currentPath }}
                    transition={{ duration: 0.8, type: "spring", bounce: 0.2 }}
                />
            </svg>

            {/* SVG Foreground Layer (Active Progress) - Clipped */}
            <div
                className="absolute inset-0 overflow-hidden transition-[width] duration-100 ease-linear"
                style={{ width: `${percent}%` }}
            >
                <svg
                    className="absolute top-0 left-0 h-full overflow-visible"
                    style={{ width: width }} // Must match the parent viewBox width
                    preserveAspectRatio="none"
                    viewBox={`0 0 ${width} 20`}
                >
                    <motion.path
                        d={currentPath}
                        fill="none"
                        stroke={accentColor || "currentColor"}
                        strokeWidth="4"
                        className={!accentColor ? "text-indigo-400 shadow-[0_0_10px_currentColor]" : "shadow-[0_0_10px_currentColor]"}
                        vectorEffect="non-scaling-stroke"
                        animate={{ d: currentPath }}
                        transition={{ duration: 0.8, type: "spring", bounce: 0.2 }}
                    />
                </svg>
            </div>

            {/* Thumb (Glowy Dot) */}
            <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none transform -translate-x-1/2"
                style={{ left: `${percent}%` }}
            >
                <div className="absolute inset-0 bg-indigo-500 rounded-full blur-[2px] opacity-50" />
            </div>

            {/* Invisible Range Input for Interaction */}
            <input
                type="range"
                min="0"
                max={max}
                step="0.1"
                value={value}
                onChange={handleChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
            />
        </div>
    );
}
