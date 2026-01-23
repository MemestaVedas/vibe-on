import { ThemeColors } from '../store/themeStore';

/**
 * Generate CSS for YouTube Music theming based on app theme colors.
 * This CSS will be injected dynamically to override YT Music's default styling.
 */
export function generateYTMusicCSS(colors: ThemeColors): string {
    return `
        /* ===== Dynamic Theme from VIBE-ON! ===== */
        
        /* Progress Bar - Accent Color */
        #progress-bar.ytmusic-player-bar {
            --paper-slider-active-color: ${colors.primary} !important;
            --paper-slider-knob-color: ${colors.primary} !important;
        }
        
        tp-yt-paper-slider .slider-knob-inner {
            background-color: ${colors.primary} !important;
        }
        
        /* Primary Action Buttons */
        .play-pause-button.ytmusic-player-bar svg,
        ytmusic-play-button-renderer svg {
            fill: ${colors.primary} !important;
        }
        
        /* Active/Selected Items */
        ytmusic-responsive-list-item-renderer[selected],
        ytmusic-two-row-item-renderer[selected] {
            background: ${colors.primary}20 !important;
            border-left: 3px solid ${colors.primary} !important;
        }
        
        /* Chips/Pills (active state) */
        ytmusic-chip-cloud-chip-renderer[chip-style="STYLE_DEFAULT"][is-selected] {
            background: ${colors.primary} !important;
        }
        
        /* Links on hover */
        a.yt-simple-endpoint:hover yt-formatted-string {
            color: ${colors.primary} !important;
        }
        
        /* Volume slider */
        #volume-slider tp-yt-paper-slider {
            --paper-slider-active-color: ${colors.primary} !important;
            --paper-slider-knob-color: ${colors.primary} !important;
        }
        
        /* Like button when active */
        ytmusic-like-button-renderer[like-status="LIKE"] tp-yt-paper-icon-button {
            color: ${colors.primary} !important;
        }
    `;
}

/**
 * Apply accent-only theme updates (for dynamic color changes)
 * This is lighter weight than the full base theme
 */
export function generateAccentOnlyCSS(accentColor: string): string {
    return `
        #progress-bar.ytmusic-player-bar {
            --paper-slider-active-color: ${accentColor} !important;
            --paper-slider-knob-color: ${accentColor} !important;
        }
        
        tp-yt-paper-slider .slider-knob-inner {
            background-color: ${accentColor} !important;
        }
        
        .play-pause-button.ytmusic-player-bar svg,
        ytmusic-play-button-renderer svg {
            fill: ${accentColor} !important;
        }
        
        #volume-slider tp-yt-paper-slider {
            --paper-slider-active-color: ${accentColor} !important;
            --paper-slider-knob-color: ${accentColor} !important;
        }
    `;
}
