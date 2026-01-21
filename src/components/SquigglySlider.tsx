import { useRef, useMemo } from 'react';
import { motion } from 'motion/react';

interface SquigglySliderProps {
    value: number;
    max: number;
    onChange: (newValue: number) => void;
    isPlaying?: boolean;
    className?: string;
}

export function SquigglySlider({ value, max, onChange, isPlaying = false, className = '' }: SquigglySliderProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    const progress = Math.min(1, Math.max(0, value / (max || 1)));
    const percent = progress * 100;

    // Generate paths with identical point counts for smooth interpolation
    const { straightPath, squigglyPath } = useMemo(() => {
        const width = 400;
        const points = 100; // Resolution of the line
        const amplitude = 5;
        const frequency = 0.15;

        let straight = `M 0 10`;
        let squiggly = `M 0 10`;

        for (let i = 0; i <= points; i++) {
            const x = (i / points) * width;

            // Straight line (y=10)
            straight += ` L ${x} 10`;

            // Sine wave
            const y = 10 + Math.sin(x * frequency) * amplitude;
            squiggly += ` L ${x} ${y}`;
        }

        return { straightPath: straight, squigglyPath: squiggly };
    }, []);

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
                viewBox="0 0 400 20"
            >
                <motion.path
                    d={currentPath}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="text-white/10"
                    vectorEffect="non-scaling-stroke"
                    animate={{ d: currentPath }}
                    transition={{ duration: 0.8, type: "spring", bounce: 0.2 }} // Organic spring transition
                />
            </svg>

            {/* SVG Foreground Layer (Active Progress) - Clipped */}
            <div
                className="absolute inset-0 overflow-hidden transition-[width] duration-100 ease-linear"
                style={{ width: `${percent}%` }}
            >
                <svg
                    className="absolute top-0 left-0 w-full h-full overflow-visible"
                    style={{ width: containerRef.current ? containerRef.current.clientWidth : '100%' }}
                    preserveAspectRatio="none"
                    viewBox="0 0 400 20"
                >
                    <motion.path
                        d={currentPath}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        className="text-indigo-400"
                        vectorEffect="non-scaling-stroke"
                        animate={{ d: currentPath }}
                        transition={{ duration: 0.8, type: "spring", bounce: 0.2 }}
                    />
                </svg>
            </div>

            {/* Thumb (Optional, maybe just the line ending is enough, but a glowy dot is nice) */}
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
