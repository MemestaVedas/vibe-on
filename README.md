# Vibe On 🎵

> **Experience Your Music, Elevated.**

Vibe On is a modern, aesthetically crafted music player built for those who care about how their music *feels*. merging your local library with the power of the web, wrapped in a stunning, dynamically theming interface.

## ✨ Features

### 🎨 Dynamic Immersion
-   **Contextual Theming**: The entire UI adapts continuously to the colors of your current track's album art.
-   **Material 3 Design**: Smooth transitions, pill-shaped interactive elements, and modern typography.
-   **Ambient Backgrounds**: Optional glassmorphism and blurred aesthetic modes.

### 🎤 Synchronized Lyrics
-   **Real-time Synced Lyrics**: Sing along with scrolling, time-coded lyrics.
-   **Plain Text Fallback**: Automatic fallback to static lyrics when time data isn't available.
-   **Smart Caching**: Lyrics are fetched asynchronously and cached locally for instant load times on replay.
-   **Interactive**: Click any line to seek to that part of the song.

### 📊 Listening Statistics
-   **Visual Breakdown**: See your top tracks, top artists, and total listening time.
-   **Beautiful Charts**: Data visualization that matches your current theme.
-   **Insights**: Track your library growth and favorites.

### ⚡ Performance & Core
-   **Rust Backend**: Powered by Tauri for native-level performance and low resource usage.
-   **Hybrid Engine**: Seamlessly switch between local files and YouTube Music (web view integration).
-   **Discord RPC**: Show off what you're listening to with rich presence.

## 🛠️ Tech Stack

-   **Frontend**: React, TypeScript, Tailwind CSS, Framer Motion
-   **Backend**: Rust, Tauri
-   **State Management**: Zustand
-   **Design System**: Material 3 (Custom implementation)

## 🚀 Getting Started

### Prerequisites
-   Node.js & npm
-   Rust (cargo)

### Development
```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev
```

### Build
```bash
# Build for production
npm run tauri build
```
