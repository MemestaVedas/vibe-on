import { useRef, useMemo } from 'react';

interface SquigglySliderProps {
    value: number;
    max: number;
    onChange: (newValue: number) => void;
    className?: string;
}

export function SquigglySlider({ value, max, onChange, className = '' }: SquigglySliderProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    const progress = Math.min(1, Math.max(0, value / (max || 1)));
    const percent = progress * 100;

    // Generate specific path data for a consistent squiggly line
    // Using a tight sine wave for the "scribble" look
    const pathData = useMemo(() => {
        let d = "M 0 10";
        const width = 400; // Arbitrary wide content coordinate system
        const amplitude = 5;
        const frequency = 0.15;

        for (let x = 0; x <= width; x++) {
            const y = 10 + Math.sin(x * frequency) * amplitude;
            d += ` L ${x} ${y}`;
        }
        return d;
    }, []);

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
                <path
                    d={pathData}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="text-white/10"
                    vectorEffect="non-scaling-stroke" // Keeps stroke width constant
                />
            </svg>

            {/* SVG Foreground Layer (Active Progress) - Clipped */}
            <div
                className="absolute inset-0 overflow-hidden transition-[width] duration-100 ease-linear"
                style={{ width: `${percent}%` }}
            >
                <svg
                    className="absolute top-0 left-0 w-full h-full overflow-visible"
                    // We need to counter-scale or set width to the parent's width to ensure the wave lines up
                    // Using a constrained width container inside an overflowing one is easier, 
                    // but here we just need to make sure this SVG matches the dimensions of the parent EXACTLY.
                    // The 'w-full' refers to the clipped parent, which is shrinking.
                    // To keep the wave stationary as the container shrinks, we need the SVG to be the full width of the slider, not the clipped container.
                    style={{ width: containerRef.current ? containerRef.current.clientWidth : '100%' }}
                    preserveAspectRatio="none"
                    viewBox="0 0 400 20"
                >
                    <path
                        d={pathData}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        className="text-indigo-400"
                        vectorEffect="non-scaling-stroke"
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
