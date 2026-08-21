'use client';

import { useEffect, useState } from 'react';

import {
  claudeListModels,
  FALLBACK_CLAUDE_MODELS,
  type ClaudeModel,
} from './claude';

/**
 * Models available for clip analysis, fetched from the API on mount. Falls
 * back to a static list when the request fails (no token saved, offline).
 */
export function useClaudeModels() {
  const [models, setModels] = useState<ClaudeModel[] | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const live = await claudeListModels();
        if (disposed) return;
        if (live.length === 0) throw new Error('empty model list');
        setModels(live);
      } catch {
        if (disposed) return;
        setModels([...FALLBACK_CLAUDE_MODELS]);
        setUsingFallback(true);
      }
    })();
    return () => {
      disposed = true;
    };
  }, []);

  return {
    models: models ?? [],
    loading: models === null,
    usingFallback,
  };
}
