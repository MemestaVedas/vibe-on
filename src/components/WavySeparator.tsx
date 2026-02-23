import { useMemo } from 'react';

interface WavySeparatorProps {
    label?: string;
    color?: string; // CSS color string (default: current text color or primary)
}

export function WavySeparator({ label, color = "currentColor" }: WavySeparatorProps) {
    // If no label, show continuous wave
    if (!label) {
        return (
            <div className="w-full py-4 opacity-60">
                <div className="h-3 overflow-hidden">
                    <WavePattern color={color} />
                </div>
            </div>
        );
    }

    // With label, show wave - label - wave
    return (
        <div className="flex items-center gap-4 w-full py-6 opacity-60">
            {/* Left Wave */}
            <div className="flex-1 h-3 overflow-hidden">
                <WavePattern color={color} />
            </div>

            {/* Label */}
            <span className="text-label-small font-medium uppercase tracking-widest text-on-surface-variant whitespace-nowrap">
                {label}
            </span>

            {/* Right Wave */}
            <div className="flex-1 h-3 overflow-hidden">
                <WavePattern color={color} />
            </div>
        </div>
    );
}

function WavePattern({ color }: { color: string }) {
    const patternId = useMemo(() => `wave-pattern-${Math.random().toString(36).substr(2, 9)}`, []);

    return (
        <svg width="100%" height="100%" preserveAspectRatio="none">
            <defs>
                <pattern id={patternId} x="0" y="0" width="24" height="12" patternUnits="userSpaceOnUse">
                    {/* Sine wave: Start mid (6), go up, then down. Width 24. */}
                    {/* M 0 6 Q 6 3 12 6 T 24 6 */}
                    <path
                        d="M 0 6 Q 6 3 12 6 T 24 6"
                        fill="none"
                        stroke={color}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                    />
                </pattern>
            </defs>
            <rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId})`} />
        </svg>
    );
}

export function FilledWavySeparator({ color = "var(--md-sys-color-surface-container)", className = "" }: { color?: string, className?: string }) {
    const patternId = useMemo(() => `wave-pattern-filled-${Math.random().toString(36).substr(2, 9)}`, []);

    return (
        <svg width="100%" height="32" preserveAspectRatio="none" className={`block w-full ${className}`}>
            <defs>
                <pattern id={patternId} x="0" y="0" width="72" height="32" patternUnits="userSpaceOnUse">
                    {/* Flat top at y=0, solid down to y=16
                        Wave starts at 16. Goes down to 32, then up to 16. Width 72.
                    */}
                    <path
                        d="M 0 0 L 0 20 Q 18 32 36 20 T 72 20 L 72 0 Z"
                        fill={color}
                    />
                </pattern>
            </defs>
            <rect x="0" y="0" width="100%" height="32" fill={`url(#${patternId})`} />
        </svg>
    );
}
