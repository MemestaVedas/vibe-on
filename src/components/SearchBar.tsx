import { useRef, useEffect } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { IconSearch } from './Icons';

export function SearchBar() {
    const searchQuery = usePlayerStore(state => state.searchQuery);
    const setSearchQuery = usePlayerStore(state => state.setSearchQuery);
    const inputRef = useRef<HTMLInputElement>(null);

    // Global keyboard shortcut: "/" to focus search, Escape to clear
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // "/" to focus search (only if not in an input)
            if (e.key === '/' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
                e.preventDefault();
                inputRef.current?.focus();
            }
            // Escape to clear search and blur (works globally if there's a search query)
            if (e.key === 'Escape') {
                if (searchQuery || document.activeElement === inputRef.current) {
                    e.preventDefault();
                    setSearchQuery('');
                    inputRef.current?.blur();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setSearchQuery, searchQuery]);

    return (
        <div className="relative flex items-center">
            {/* Search icon using M3 primary color */}
            <IconSearch
                size={14}
                className="absolute left-3 pointer-events-none transition-colors"
                style={{ color: 'var(--md-sys-color-primary)' }}
            />
            <input
                ref={inputRef}
                type="text"
                placeholder="Search (press /)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                    backgroundColor: 'var(--md-sys-color-surface-container)',
                    color: 'var(--md-sys-color-on-surface)',
                    borderColor: 'var(--md-sys-color-outline-variant)',
                }}
                className="
                    w-44 h-7 pl-8 pr-7 
                    text-body-small
                    border rounded-full outline-none
                    focus:ring-2 focus:w-56
                    transition-all duration-200
                "
                onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--md-sys-color-primary)';
                    e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container-high)';
                }}
                onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--md-sys-color-outline-variant)';
                    e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container)';
                }}
            />
            {searchQuery && (
                <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 transition-colors text-xs"
                    style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
                    title="Clear search (Esc)"
                >
                    ✕
                </button>
            )}
        </div>
    );
}
