/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                outfit: ['Outfit', 'sans-serif'],
            },
            colors: {
                surface: 'var(--md-sys-color-surface)',
                'on-surface': 'var(--md-sys-color-on-surface)',
                'surface-container-low': 'var(--md-sys-color-surface-container-low)',
                'surface-container': 'var(--md-sys-color-surface-container)',
                'surface-container-high': 'var(--md-sys-color-surface-container-high)',

                primary: 'var(--md-sys-color-primary)',
                'on-primary': 'var(--md-sys-color-on-primary)',
                'primary-container': 'var(--md-sys-color-primary-container)',
                'on-primary-container': 'var(--md-sys-color-on-primary-container)',

                secondary: 'var(--md-sys-color-secondary)',
                'on-secondary': 'var(--md-sys-color-on-secondary)',
                'secondary-container': 'var(--md-sys-color-secondary-container)',
                'on-secondary-container': 'var(--md-sys-color-on-secondary-container)',

                tertiary: 'var(--md-sys-color-tertiary)',
                'on-tertiary': 'var(--md-sys-color-on-tertiary)',
                'tertiary-container': 'var(--md-sys-color-tertiary-container)',
                'on-tertiary-container': 'var(--md-sys-color-on-tertiary-container)',

                outline: 'var(--md-sys-color-outline)',
                'outline-variant': 'var(--md-sys-color-outline-variant)',
            },
            borderRadius: {
                'xs': '4px',
                'sm': '8px',
                'md': '12px',
                'lg': '16px',
                'xl': '24px',   // Large M3
                '2xl': '32px',  // Extra Large M3
                '3xl': '48px', // Full/Pill
            },
            boxShadow: {
                'elevation-1': '0px 1px 2px rgba(0,0,0,0.3), 0px 1px 3px 1px rgba(0,0,0,0.15)',
                'elevation-2': '0px 1px 2px rgba(0,0,0,0.3), 0px 2px 6px 2px rgba(0,0,0,0.15)',
                'elevation-3': '0px 4px 8px 3px rgba(0,0,0,0.15), 0px 1px 3px rgba(0,0,0,0.3)',
            }
        },
    },
    plugins: [
        require('tailwind-scrollbar'),
    ],
}
