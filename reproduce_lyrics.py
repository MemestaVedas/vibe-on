import requests
import sys

# Replace with a track path that you know has a romaji file
# You might need to adjust this path to one available on the user's system
# For now, I'll try to list the library to find a candidate first.

def search_track_with_lyrics():
    try:
        # Get library to find a track
        r = requests.get('http://localhost:5000/api/library')
        tracks = r.json()
        
        # This is a bit blind, I don't know which files have .romaji.lrc
        # But I can try to fetch lyrics for a few and see if any contain " / "
        
        print(f"Checking {len(tracks)} tracks...")
        for track in tracks[:20]: # Check first 20
            path = track['path']
            print(f"Checking: {path}")
            
            # encode path
            import urllib.parse
            encoded_path = urllib.parse.quote(path, safe='')
            
            url = f"http://localhost:5000/api/lyrics/{encoded_path}"
            r_lyrics = requests.get(url)
            
            if r_lyrics.status_code == 200:
                data = r_lyrics.json()
                synced = data.get('syncedLyrics', '') or ''
                plain = data.get('plainLyrics', '') or ''
                
                if " / " in synced:
                    print(f"\nFOUND ROMAJI LYRICS for {path}!")
                    print("--- Snippet ---")
                    print(synced[:200])
                    print("--- End Snippet ---")
                    return
                elif synced:
                    print("Found lyrics (no romaji detected yet)")
                    # print(synced[:50])

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    search_track_with_lyrics()
