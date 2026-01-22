
// Vibe-On YouTube Music Injection Script
console.log("[Vibe-On] Injection script loaded");

// Wait for Tauri API to be available
function waitForTauri(callback) {
    if (window.__TAURI__) {
        callback();
    } else {
        setTimeout(() => waitForTauri(callback), 100);
    }
}

waitForTauri(() => {
    console.log("[Vibe-On] Tauri API detected");
    const invoke = window.__TAURI__.core.invoke;

    let lastState = {};

    function checkStatus() {
        const video = document.querySelector('video');
        const meta = navigator.mediaSession?.metadata;

        if (!video || !meta) return;

        const newState = {
            title: meta.title || "Unknown Title",
            artist: meta.artist || "Unknown Artist",
            album: meta.album || "Unknown Album",
            cover_url: meta.artwork?.[meta.artwork.length - 1]?.src || "", // Get largest artwork
            duration: video.duration || 0,
            progress: video.currentTime || 0,
            is_playing: !video.paused
        };

        // Send status
        invoke('update_yt_status', { status: newState }).catch(() => { });
    }

    // Expose control function
    window.ytControl = function (action, value) {
        const video = document.querySelector('video');
        if (!video) return;

        console.log("[Vibe-On] Control:", action, value);

        switch (action) {
            case 'play': video.play(); break;
            case 'pause': video.pause(); break;
            case 'play_pause': video.paused ? video.play() : video.pause(); break;
            case 'next':
                document.querySelector('.next-button, [aria-label="Next song"]')?.click();
                break;
            case 'prev':
                document.querySelector('.previous-button, [aria-label="Previous song"]')?.click();
                break;
            case 'seek':
                video.currentTime = value;
                break;
            case 'back':
                window.history.back();
                break;
            case 'forward':
                window.history.forward();
                break;
            case 'home':
                window.location.href = "https://music.youtube.com";
                break;
        }
    };

    // Poll every 500ms
    setInterval(checkStatus, 500);

    // Also listen for immediate state changes
    const video = document.querySelector('video');
    if (video) {
        video.addEventListener('play', checkStatus);
        video.addEventListener('pause', checkStatus);
        video.addEventListener('ended', checkStatus);
    }
});
