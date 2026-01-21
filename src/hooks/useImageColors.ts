import { useState, useEffect } from 'react';

// Simplified color extraction logic using canvas
export function useImageColors(imageUrl: string | null | undefined) {
    const [colors, setColors] = useState<string[]>([]);
    const [dominantColor, setDominantColor] = useState<string | null>(null);

    useEffect(() => {
        if (!imageUrl) {
            setColors([]);
            setDominantColor(null);
            return;
        }

        const img = new Image();
        // img.crossOrigin = 'Anonymous'; // Removed: Can cause issues with blob/local URLs
        img.src = imageUrl;

        let active = true;

        img.onload = () => {
            if (!active) return;
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                // Resize for faster processing
                canvas.width = 50;
                canvas.height = 50;

                ctx.drawImage(img, 0, 0, 50, 50);
                const imageData = ctx.getImageData(0, 0, 50, 50).data;

                // Simple quantization/clustering could go here, 
                // but for "ambient" background, averaging regions works well too.
                // Let's sample 3 distinct areas to get a palette.

                const getAverageColor = (startX: number, startY: number, size: number) => {
                    let r = 0, g = 0, b = 0, count = 0;
                    for (let y = startY; y < startY + size; y++) {
                        for (let x = startX; x < startX + size; x++) {
                            const i = (y * 50 + x) * 4;
                            if (i < imageData.length) {
                                r += imageData[i];
                                g += imageData[i + 1];
                                b += imageData[i + 2];
                                count++;
                            }
                        }
                    }
                    if (count === 0) return null;
                    return `rgb(${Math.floor(r / count)}, ${Math.floor(g / count)}, ${Math.floor(b / count)})`;
                };

                // Sample corners and center
                const palette = [
                    getAverageColor(0, 0, 25),      // Top-left
                    getAverageColor(25, 0, 25),     // Top-right
                    getAverageColor(0, 25, 25),     // Bottom-left
                    getAverageColor(25, 25, 25),    // Bottom-right
                    getAverageColor(15, 15, 20),    // Center
                ].filter(Boolean) as string[];

                // Remove duplicates roughly
                const uniquecolors = [...new Set(palette)];

                setColors(uniquecolors);
                setDominantColor(uniquecolors[0] || null);

            } catch (e) {
                console.error('Failed to extract colors', e);
            }
        };


        img.onerror = (e) => {
            console.error('Failed to load image for color extraction', e);
        };

        return () => {
            active = false;
            img.onload = null;
            img.onerror = null;
        };
    }, [imageUrl]);

    return { colors, dominantColor };
}
