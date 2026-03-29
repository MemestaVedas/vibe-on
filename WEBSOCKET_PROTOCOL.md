# VIBE-ON WebSocket Protocol Reference

> Endpoint: `ws://<pc-ip>:5000/control`

This document describes **every** message exchanged between the VIBE-ON desktop server (PC) and the Android mobile client over the WebSocket connection.

---

## Connection Lifecycle

```
1. Server starts on the PC, listens on port 5000
2. Mobile discovers the server via mDNS (_vibe-on._tcp)
3. Mobile opens WebSocket to ws://<ip>:5000/control
4. Mobile sends `hello` with its name
5. Server replies with `connected` + full state snapshot
6. Bidirectional commands/events flow until disconnect
```

### Two message delivery paths

| Path | Description |
|------|-------------|
| **Direct reply** | Sent only to the client that issued the command |
| **Broadcast** | Sent to every connected client (status updates, track changes) |

---

## Client → Server Messages

All messages are JSON with a `"type"` field (camelCase).

### Handshake

#### `hello`
Sent immediately after WebSocket opens to identify the client.

```json
{
  "type": "hello",
  "clientName": "Android",
  "protocolVersion": "1.1",
  "capabilities": [
    "lyrics.romaji",
    "library.paged",
    "playlists.basic",
    "queue.sync",
    "playback.output-switch"
  ]
}
```

**Server responds with:** `connected` + `mediaSession` + `status` + `queueUpdate` (direct)

`connected` now includes protocol metadata:

```json
{
  "type": "connected",
  "clientId": "uuid",
  "protocolVersion": "1.1",
  "serverCapabilities": ["lyrics.romaji", "library.paged", "playlists.basic", "queue.sync", "playback.output-switch"],
  "negotiatedCapabilities": ["lyrics.romaji", "library.paged", "playlists.basic", "queue.sync", "playback.output-switch"]
}
```

Desktop diagnostics behavior:
- On `mobile_client_connected`, desktop stores protocol metadata and raises a compatibility warning if the client protocol major version differs from the desktop-supported major version.
- Warning is cleared on `mobile_client_disconnected`.

Verification commands:
- `npm run verify:ws` validates protocol compatibility tests in `src-tauri`.
- `npm run verify:release` runs lint + unit tests + build + websocket contract tests.

Server info preflight:
- `GET /api/info` now includes `protocolVersion` and `serverCapabilities` so clients can preflight compatibility before opening a control session.

#### `getStatus`
Request the full current state snapshot.

```json
{ "type": "getStatus" }
```

**Server responds with:** `mediaSession` + `status` + `queueUpdate` (direct)

---

### Playback Controls

#### `play`
Resume playback (alias for `resume`).

```json
{ "type": "play" }
```

**Server responds with:** `mediaSession` + `status` (broadcast)

#### `pause`
Pause current playback (alias for `stop`).

```json
{ "type": "pause" }
```

**Server responds with:** `mediaSession` + `status` (broadcast)

#### `resume`
Resume paused playback.

```json
{ "type": "resume" }
```

**Server responds with:** `mediaSession` + `status` (broadcast)

#### `stop`
Stop playback.

```json
{ "type": "stop" }
```

**Server responds with:** `mediaSession` + `status` (broadcast)

#### `next`
Skip to the next track in queue.

```json
{ "type": "next" }
```

**Server responds with:** Full track change flow (see "Track Change Flow" below)

#### `previous`
Go to the previous track in queue.

```json
{ "type": "previous" }
```

**Server responds with:** Full track change flow

#### `seek`
Seek to a position in the current track.

```json
{ "type": "seek", "positionSecs": 42.5 }
```

**Server responds with:** `mediaSession` + `status` (broadcast)

#### `setVolume`
Set the playback volume.

```json
{ "type": "setVolume", "volume": 0.75 }
```

**Server responds with:** `mediaSession` + `status` (broadcast)

#### `toggleShuffle`
Toggle shuffle mode on/off.

```json
{ "type": "toggleShuffle" }
```

**Server responds with:** `mediaSession` + `status` (broadcast)

#### `cycleRepeat`
Cycle repeat mode: off → all → one → off.

```json
{ "type": "cycleRepeat" }
```

**Server responds with:** `mediaSession` + `status` (broadcast)

---

### Track / Queue Commands

#### `playTrack`
Play a specific track by file path.

```json
{ "type": "playTrack", "path": "C:/Music/song.flac" }
```

**Server responds with:** Track change flow + `mediaSession` + `status` (broadcast).
If output is mobile, also sends `streamStopped` + `handoffPrepare` (direct).

#### `playAlbum`
Play all tracks from an album.

```json
{ "type": "playAlbum", "album": "Album Name", "artist": "Artist Name" }
```

**Server responds with:** Sets queue, plays first track, broadcasts `queueUpdate` + track change flow.

#### `playArtist`
Play all tracks by an artist.

```json
{ "type": "playArtist", "artist": "Artist Name" }
```

**Server responds with:** Same as `playAlbum`.

#### `setQueue`
Replace the entire playback queue.

```json
{ "type": "setQueue", "paths": ["path1.flac", "path2.flac"] }
```

**Server responds with:** `queueUpdate` (broadcast)

#### `addToQueue`
Add a single track to the end of the queue.

```json
{ "type": "addToQueue", "path": "C:/Music/song.flac" }
```

**Server responds with:** `queueUpdate` (broadcast)

---

### Favorites

#### `toggleFavorite`
Toggle a track's favorite status.

```json
{ "type": "toggleFavorite", "path": "C:/Music/song.flac" }
```

**Server responds with:** `ack` (direct)

---

### Library

#### `getLibrary`
Request the full music library.

```json
{ "type": "getLibrary" }
```

**Server responds with:** `library` (direct)

#### `getLyrics`
Request lyrics for the currently playing track.

```json
{ "type": "getLyrics" }
```

**Server responds with:** `lyrics` (direct) or `error` if not found

---

### Mobile Streaming

#### `startMobilePlayback`
Switch audio output from PC speakers to mobile streaming.

```json
{ "type": "startMobilePlayback" }
```

**Server responds with:**
1. Pauses PC playback
2. Sets active output to `"mobile"`
3. Sends `handoffPrepare` with stream URL and sample position (direct)

#### `stopMobilePlayback`
Return audio output to the PC.

```json
{ "type": "stopMobilePlayback" }
```

**Server responds with:**
1. Sets active output to `"desktop"`
2. Resumes PC playback
3. Broadcasts `streamStopped`

#### `mobilePositionUpdate`
Report the mobile player's current position to the PC (for stats tracking and UI sync).

```json
{ "type": "mobilePositionUpdate", "positionSecs": 42.5 }
```

**Server responds with:** nothing (fire-and-forget)

---

### Playlists

#### `getPlaylists`
Request the list of all playlists.

```json
{ "type": "getPlaylists" }
```

**Server responds with:** `playlists` (direct)

#### `getPlaylistTracks`
Request tracks for a specific playlist.

```json
{ "type": "getPlaylistTracks", "playlist_id": "uuid-here" }
```

**Server responds with:** `playlistTracks` (direct)

#### `addToPlaylist`
Add a track to a playlist.

```json
{ "type": "addToPlaylist", "playlist_id": "uuid", "path": "C:/Music/song.flac" }
```

**Server responds with:** `ack` (direct) or `error`

#### `removeFromPlaylist`
Remove a track from a playlist.

```json
{ "type": "removeFromPlaylist", "playlist_id": "uuid", "playlist_track_id": 42 }
```

**Server responds with:** `ack` (direct) or `error`

#### `reorderPlaylistTracks`
Reorder tracks within a playlist.

```json
{ "type": "reorderPlaylistTracks", "playlist_id": "uuid", "track_ids": [3, 1, 2] }
```

**Server responds with:** `ack` (direct) or `error`

---

### Keepalive

#### `ping`

```json
{ "type": "ping" }
```

**Server responds with:** `pong` (direct)

---

## Server → Client Messages

All messages are JSON with a `"type"` field.

### `connected`
Confirms the connection after `hello`.

```json
{ "type": "connected", "clientId": "uuid-string" }
```

### `mediaSession`
Current track metadata and playback state. Sent on connect, track change, and periodically (every 2s).

```json
{
  "type": "mediaSession",
  "trackId": "C:/Music/song.flac",
  "title": "Song Title",
  "artist": "Artist",
  "album": "Album",
  "duration": 240.5,
  "coverUrl": "/cover/C%3A%2FMusic%2Fsong.flac",
  "isPlaying": true,
  "position": 42.5,
  "timestamp": 1710000000000,
  "titleRomaji": null,
  "titleEn": null,
  "artistRomaji": null,
  "artistEn": null,
  "albumRomaji": null,
  "albumEn": null
}
```

### `status`
Player status. Sent alongside `mediaSession`.

```json
{
  "type": "status",
  "volume": 0.75,
  "shuffle": false,
  "repeatMode": "off",
  "output": "desktop"
}
```

`output` is either `"desktop"` or `"mobile"`.

### `PlaybackState`
Lightweight position update (from periodic broadcast).

```json
{
  "type": "PlaybackState",
  "is_playing": true,
  "position": 42.5,
  "volume": 0.75
}
```

### `queueUpdate`
Current playback queue. Sent on connect, queue changes, and track changes.

```json
{
  "type": "queueUpdate",
  "queue": [
    {
      "path": "C:/Music/song.flac",
      "title": "Song",
      "artist": "Artist",
      "album": "Album",
      "durationSecs": 240.5,
      "coverUrl": "/cover/...",
      "titleRomaji": null,
      "titleEn": null,
      "artistRomaji": null,
      "artistEn": null,
      "albumRomaji": null,
      "albumEn": null
    }
  ],
  "currentIndex": 0
}
```

### `handoffPrepare`
Tells mobile to start streaming audio from the provided URL.

```json
{
  "type": "handoffPrepare",
  "sample": 1940400,
  "url": "http://192.168.1.100:5000/stream/C%3A%2FMusic%2Fsong.flac"
}
```

- `sample` — byte offset in samples (at 44100 Hz). Divide by 44100 to get seconds.
- `url` — HTTP URL to stream the audio file.

### `streamStopped`
Tells mobile to stop streaming (output returned to desktop, or a new track is about to start).

```json
{ "type": "streamStopped" }
```

### `lyrics`
Lyrics for the current track.

```json
{
  "type": "lyrics",
  "trackPath": "C:/Music/song.flac",
  "hasSynced": true,
  "syncedLyrics": "[00:12.34] Line one...",
  "syncedLyricsRomaji": "[00:12.34] Romaji line...",
  "plainLyrics": "Line one\nLine two",
  "instrumental": false
}

---

### Romaji support

The protocol includes explicit Romaji fields for titles, artists, albums and synced lyrics. These fields may be `null` when not available; when present they mirror the original-language fields but in Latin script.

Example `mediaSession` with Romaji populated:

```json
{
  "type": "mediaSession",
  "trackId": "C:/Music/song.flac",
  "title": "自傷無色",
  "titleRomaji": "Jishō Mushoku",
  "artist": "ヨルシカ",
  "artistRomaji": "Yorushika",
  "album": "盗作",
  "albumRomaji": "Tōsaku",
  "duration": 240.5,
  "coverUrl": "/cover/C%3A%2FMusic%2Fsong.flac",
  "isPlaying": true,
  "position": 42.5,
  "timestamp": 1710000000000
}
```

Example `lyrics` showing synced Romaji lines:

```json
{
  "type": "lyrics",
  "trackPath": "C:/Music/song.flac",
  "hasSynced": true,
  "syncedLyrics": "[00:12.34] 自傷無色...\n[00:16.00] 歌詞の続き...",
  "syncedLyricsRomaji": "[00:12.34] Jishō Mushoku...\n[00:16.00] Kashi no tsuzuki...",
  "plainLyrics": "自傷無色\n歌詞の続き...",
  "instrumental": false
}
```
```

### `library`
Full music library. Sent in response to `getLibrary`.

```json
{
  "type": "library",
  "tracks": [
    {
      "path": "C:/Music/song.flac",
      "title": "Song",
      "artist": "Artist",
      "album": "Album",
      "durationSecs": 240.5,
      "discNumber": 1,
      "trackNumber": 3,
      "coverUrl": "/cover/...",
      "titleRomaji": null,
      "titleEn": null,
      "artistRomaji": null,
      "artistEn": null,
      "albumRomaji": null,
      "albumEn": null
    }
  ]
}
```

### `playlists`
List of playlists.

```json
{
  "type": "playlists",
  "playlists": [
    {
      "id": "uuid",
      "name": "My Playlist",
      "trackCount": 12,
      "createdAt": "2025-01-01T00:00:00",
      "updatedAt": "2025-06-15T12:00:00"
    }
  ]
}
```

### `playlistTracks`
Tracks in a specific playlist.

```json
{
  "type": "playlistTracks",
  "playlistId": "uuid",
  "tracks": [ /* same format as library tracks */ ]
}
```

### `statsUpdated`
Playback stats were updated.

```json
{ "type": "statsUpdated", "timestamp": 1710000000000 }
```

### `ack`
Acknowledges a successful action (favorites, playlist mutations).

```json
{ "type": "ack", "action": "toggleFavorite" }
```

### `error`
Server error.

```json
{ "type": "error", "message": "Queue is empty" }
```

### `pong`
Keepalive response (also sent automatically every 30 seconds).

```json
{ "type": "pong" }
```

---

## Flows

### Connection Flow
```
Mobile                          Server
  │                                │
  │─── ws connect ────────────────→│
  │─── hello {clientName} ────────→│
  │←── connected {clientId} ───────│
  │←── mediaSession ───────────────│
  │←── status ─────────────────────│
  │←── queueUpdate ────────────────│
```

### Track Change Flow (Desktop Output)
```
Mobile                          Server
  │                                │
  │─── next / playTrack ──────────→│
  │                                │── plays track on PC
  │←── mediaSession (broadcast) ───│
  │←── status (broadcast) ─────────│
```

### Track Change Flow (Mobile Output)
```
Mobile                          Server
  │                                │
  │─── next / playTrack ──────────→│
  │                                │── loads track (no audio)
  │←── streamStopped (direct) ─────│  ← tells mobile to stop old stream
  │←── handoffPrepare (direct) ────│  ← new stream URL
  │←── mediaSession (broadcast) ───│
  │←── status (broadcast) ─────────│
  │                                │
  │── (mobile starts HTTP stream) ─│
  │─── mobilePositionUpdate ──────→│  ← periodic position sync
```

### Mobile Streaming Handoff
```
Mobile                          Server
  │                                │
  │─── startMobilePlayback ───────→│
  │                                │── pauses PC playback
  │                                │── sets output = "mobile"
  │←── handoffPrepare ─────────────│
  │                                │
  │── (streams via HTTP) ──────────│
  │─── mobilePositionUpdate ──────→│  (every ~1s)
  │                                │
  │─── stopMobilePlayback ────────→│
  │                                │── resumes PC playback
  │                                │── sets output = "desktop"
  │←── streamStopped ──────────────│
```

### Periodic Updates (every 2 seconds)
```
Server broadcasts to all clients:
  ← mediaSession (current track + position)
  ← status (volume, shuffle, repeat, output)
```

---

## Cover Art & Streaming URLs

- **Cover art:** `http://<ip>:5000/cover/<url-encoded-path>`
- **Audio stream:** `http://<ip>:5000/stream/<url-encoded-path>`
- The `coverUrl` field in messages is a relative path (e.g. `/cover/...`). Prepend the base URL.
- Stream URLs in `handoffPrepare` are absolute (include host and port).

## Notes

- The server sends a keepalive `pong` every 30 seconds even without a `ping`.
- The client OkHttp ping interval is 15 seconds.
- Skip commands (`next`/`previous`) are debounced on the client side (700ms).
- Auto-next on track end has a 1.5s cooldown to prevent double-triggers.
- FLAC streams skip seek-on-handoff to avoid decode errors.
