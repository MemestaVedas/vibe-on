/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: '#0b0c0e',
            },
            backgroundImage: {
                'glass-gradient': 'linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%)',
                'mesh': 'radial-gradient(at 0% 0%, rgba(76, 29, 149, 0.2) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(236, 72, 153, 0.1) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(59, 130, 246, 0.15) 0px, transparent 50%), radial-gradient(at 0% 100%, rgba(139, 92, 246, 0.15) 0px, transparent 50%)',
            },
            backdropBlur: {
                'xs': '2px',
                '3xl': '64px',
            },
            backdropSaturate: {
                '150': '1.5',
                '180': '1.8',
                '200': '2.0',
            },
            keyframes: {
                bounce: {
                    '0%, 100%': { height: '100%' },
                    '50%': { height: '40%' },
                }
            }
        },
    },
    plugins: [
        require('tailwind-scrollbar'),
    ],
}
