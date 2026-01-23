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
            fontSize: {
                // M3 Expressive / Emphasized Scale
                'display-hero': ['96px', { lineHeight: '112px', letterSpacing: '-0.02em', fontWeight: '300' }], // Display Large Prominent
                'display-large': ['57px', { lineHeight: '64px', letterSpacing: '-0.02em', fontWeight: '400' }],
                'display-medium': ['52px', { lineHeight: '64px', letterSpacing: '-0.02em', fontWeight: '400' }], // Emphasized
                'display-small': ['44px', { lineHeight: '52px', letterSpacing: '-0.02em', fontWeight: '400' }], // Emphasized

                'headline-large': ['32px', { lineHeight: '40px', fontWeight: '400' }],
                'headline-medium': ['28px', { lineHeight: '36px', fontWeight: '400' }],
                'headline-small': ['24px', { lineHeight: '32px', fontWeight: '400' }],

                'title-large': ['22px', { lineHeight: '28px', fontWeight: '400' }],
                'title-medium': ['16px', { lineHeight: '24px', fontWeight: '500', letterSpacing: '0.01em' }],
                'title-small': ['14px', { lineHeight: '20px', fontWeight: '500', letterSpacing: '0.01em' }],

                'label-large': ['14px', { lineHeight: '20px', fontWeight: '500', letterSpacing: '0.01em' }],
                'label-medium': ['12px', { lineHeight: '16px', fontWeight: '500', letterSpacing: '0.02em' }],
                'label-small': ['11px', { lineHeight: '16px', fontWeight: '500', letterSpacing: '0.02em' }],

                'body-large': ['16px', { lineHeight: '24px', fontWeight: '400', letterSpacing: '0.01em' }],
                'body-medium': ['14px', { lineHeight: '20px', fontWeight: '400', letterSpacing: '0.01em' }],
                'body-small': ['12px', { lineHeight: '16px', fontWeight: '400', letterSpacing: '0.01em' }],
            },
            colors: {
                surface: 'var(--md-sys-color-surface)',
                'on-surface': 'var(--md-sys-color-on-surface)',
                'surface-container-low': 'var(--md-sys-color-surface-container-low)',
                'surface-container': 'var(--md-sys-color-surface-container)',
                'surface-container-high': 'var(--md-sys-color-surface-container-high)',
                'surface-container-highest': '#33333f', // Added fallback or var

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
                '3xl': '48px',  // Extra Extra Large M3
                '4xl': '56px',
                'full': '9999px',
            },
            boxShadow: {
                'elevation-1': '0px 1px 2px rgba(0,0,0,0.3), 0px 1px 3px 1px rgba(0,0,0,0.15)',
                'elevation-2': '0px 1px 2px rgba(0,0,0,0.3), 0px 2px 6px 2px rgba(0,0,0,0.15)',
                'elevation-3': '0px 4px 8px 3px rgba(0,0,0,0.15), 0px 1px 3px rgba(0,0,0,0.3)',
            },
            transitionTimingFunction: {
                'emphasized': 'cubic-bezier(0.2, 0.0, 0.0, 1.0)', // M3 Emphasized easing
            }
        },
    },
    plugins: [
        require('tailwind-scrollbar'),
    ],
}
