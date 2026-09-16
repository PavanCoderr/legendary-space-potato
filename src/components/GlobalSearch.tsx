import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Search, X } from 'lucide-react';
import { navigate } from '../router';
import { SEARCH_SUGGESTIONS, searchAll, totalHits, type SearchGroup } from '../services/search';

/**
 * Global search.
 *
 * Results are grouped (Lessons · Videos · Practice · Concepts) and every hit is a deep
 * link into the app, so a student can go from "what was the Born rule again?" to the exact
 * lesson paragraph in one click. Opens with the button, Ctrl/Cmd-K or "/".
 */

/** Label the shortcut the way this platform actually spells it. */
const SHORTCUT_LABEL =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent ?? '') ? '⌘K' : 'Ctrl K';
export function GlobalSearch({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const groups = useMemo<SearchGroup[]>(() => searchAll(query), [query]);
  const hits = totalHits(groups);
  const firstHit = groups[0]?.hits[0];

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === '/' && !typing) {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      const handle = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(handle);
    }
    setQuery('');
    return undefined;
  }, [open]);

  const go = (href: string) => {
    navigate(href);
    setOpen(false);
  };

  return (
    <>
      <button
        className={`search-trigger${compact ? ' compact' : ''}`}
        onClick={() => setOpen(true)}
        aria-label="Search QubitVerse"
        title="Search lessons, videos, practice and concepts (Ctrl/Cmd-K)"
      >
        <Search size={15} aria-hidden />
        <span className="search-trigger-text">Search lessons, videos, concepts…</span>
        <kbd className="kbd">{SHORTCUT_LABEL}</kbd>
      </button>

      {open && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Search" onClick={() => setOpen(false)}>
          <div className="palette" onClick={event => event.stopPropagation()}>
            <div className="palette-input">
              <Search size={16} aria-hidden />
              <input
                ref={inputRef}
                value={query}
                placeholder="Search qubit, superposition, H gate, CNOT, Grover…"
                aria-label="Search query"
                onChange={event => setQuery(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && firstHit) go(firstHit.href);
                }}
              />
              <button className="btn-small btn-ghost" onClick={() => setOpen(false)} aria-label="Close search">
                <X size={14} />
              </button>
            </div>

            <div className="palette-body">
              {query.trim().length === 0 ? (
                <div className="stack" style={{ gap: 10 }}>
                  <div className="tiny dim">Try one of these</div>
                  <div className="row tight">
                    {SEARCH_SUGGESTIONS.map(suggestion => (
                      <button key={suggestion} className="chip" onClick={() => setQuery(suggestion)}>
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : hits === 0 ? (
                <p className="muted small" style={{ margin: 0 }}>
                  Nothing matches “{query}”. Try a gate name (<span className="mono">H</span>,{' '}
                  <span className="mono">CNOT</span>), a concept (superposition, entanglement) or an algorithm
                  (Grover, Shor).
                </p>
              ) : (
                groups.map(group => (
                  <div key={group.id} className="palette-group">
                    <div className="palette-group-label">
                      <span>{group.label}</span>
                      <span className="dim">{group.hits.length}</span>
                    </div>
                    {group.hits.map(hit => (
                      <button key={hit.id} className="palette-hit" onClick={() => go(hit.href)}>
                        <span className="palette-hit-main">
                          <span className="palette-hit-title">{hit.title}</span>
                          <span className="palette-hit-sub">{hit.subtitle}</span>
                        </span>
                        {hit.badge && <span className="badge">{hit.badge}</span>}
                        <ArrowRight size={14} aria-hidden />
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>

            <div className="palette-foot tiny dim">
              <span>Enter opens the first result · Esc closes</span>
              <span>{query.trim() ? `${hits} result(s)` : 'Global search across the whole curriculum'}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
