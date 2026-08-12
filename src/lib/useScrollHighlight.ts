import { useEffect, useState } from 'react';

export interface HighlightRequest {
  id: string;
  /** Bumped on every request so re-selecting the same entity re-triggers the highlight. */
  key: number;
}

const HIGHLIGHT_MS = 1800;
const MAX_FIND_ATTEMPTS = 30;

/**
 * Scrolls the element with `request.id` into view and returns its id for as
 * long as it should render highlighted. Polls with rAF for a few frames since
 * the target list (a Dexie live query) may still be loading when we navigate.
 */
export function useScrollHighlight(request: HighlightRequest | null | undefined): string | null {
  const [highlighted, setHighlighted] = useState<string | null>(null);

  useEffect(() => {
    if (!request) return;
    let cancelled = false;
    let frame = 0;
    let attempts = 0;

    function tryFind() {
      if (cancelled) return;
      const el = document.getElementById(request!.id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlighted(request!.id);
        return;
      }
      attempts += 1;
      if (attempts < MAX_FIND_ATTEMPTS) {
        frame = requestAnimationFrame(tryFind);
      }
    }
    tryFind();

    return () => {
      cancelled = true;
      if (frame) cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.id, request?.key]);

  useEffect(() => {
    if (!highlighted) return;
    const timer = setTimeout(() => setHighlighted(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlighted]);

  return highlighted;
}
