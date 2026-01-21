import { useRef, useEffect, useState } from 'react';

interface MarqueeTextProps {
    text: string;
    className?: string;
}

export function MarqueeText({ text, className = '' }: MarqueeTextProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);
    const [shouldScroll, setShouldScroll] = useState(false);
    const [scrollDistance, setScrollDistance] = useState(0);

    useEffect(() => {
        const checkOverflow = () => {
            if (containerRef.current && textRef.current) {
                const containerWidth = containerRef.current.clientWidth;
                const textWidth = textRef.current.scrollWidth;
                const isOverflowing = textWidth > containerWidth;
                setShouldScroll(isOverflowing);

                if (isOverflowing) {
                    // Calculate how far we need to scroll (negative value)
                    setScrollDistance(containerWidth - textWidth);
                }
            }
        };

        checkOverflow();
        // Re-check on resize
        window.addEventListener('resize', checkOverflow);
        return () => window.removeEventListener('resize', checkOverflow);
    }, [text]);

    return (
        <div
            ref={containerRef}
            className={`overflow-hidden whitespace-nowrap ${className}`}
        >
            <span
                ref={textRef}
                className="inline-block"
                style={shouldScroll ? {
                    animation: 'marquee-bounce 20s ease-in-out infinite',
                    '--marquee-distance': `${scrollDistance}px`,
                } as React.CSSProperties : undefined}
            >
                {text}
            </span>
        </div>
    );
}
