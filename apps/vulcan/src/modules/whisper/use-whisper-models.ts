'use client';

import { useCallback, useEffect, useState } from 'react';

import type { UnlistenFn } from '@tauri-apps/api/event';

import {
  activeWhisperDownloads,
  cancelWhisperDownload,
  deleteWhisperModel,
  downloadWhisperModel,
  listWhisperModels,
  onWhisperDownloadDone,
  onWhisperDownloadProgress,
  WHISPER_MODELS,
  type WhisperDownloadProgress,
  type WhisperModelInfo,
  type WhisperModelName,
  type WhisperModelStatus,
} from './models';

export interface WhisperModelRow extends WhisperModelInfo {
  downloaded: boolean;
  /** Actual on-disk size, present only once downloaded. */
  sizeBytes: number | null;
  /** Present while a download is in flight. */
  download: WhisperDownloadProgress | null;
  /** Message from the last failed download, cleared on retry. */
  error: string | null;
}

/**
 * Live view of every known model's download state, kept current via the
 * `whisper:download-*` events. Downloads run in the backend, so they survive
 * page remounts; in-flight ones are re-discovered on mount.
 */
export function useWhisperModels() {
  const [statuses, setStatuses] = useState<WhisperModelStatus[] | null>(null);
  const [downloads, setDownloads] = useState<
    Partial<Record<WhisperModelName, WhisperDownloadProgress>>
  >({});
  const [errors, setErrors] = useState<
    Partial<Record<WhisperModelName, string>>
  >({});

  const refresh = useCallback(async () => {
    setStatuses(await listWhisperModels());
  }, []);

  useEffect(() => {
    let disposed = false;
    const unlistens: UnlistenFn[] = [];

    (async () => {
      void refresh();
      const active = await activeWhisperDownloads();
      if (!disposed && active.length > 0) {
        setDownloads((prev) => {
          const next = { ...prev };
          for (const model of active) {
            next[model] ??= { model, downloadedBytes: 0, totalBytes: null };
          }
          return next;
        });
      }
      unlistens.push(
        await onWhisperDownloadProgress((progress) => {
          setDownloads((prev) => ({ ...prev, [progress.model]: progress }));
        }),
        await onWhisperDownloadDone((done) => {
          setDownloads((prev) => {
            const next = { ...prev };
            delete next[done.model];
            return next;
          });
          if (!done.success && !done.cancelled) {
            setErrors((prev) => ({
              ...prev,
              [done.model]: done.error ?? 'download failed',
            }));
          }
          void refresh();
        }),
      );
      // the listeners resolved after unmount; release them immediately
      if (disposed) unlistens.forEach((unlisten) => unlisten());
    })();

    return () => {
      disposed = true;
      unlistens.forEach((unlisten) => unlisten());
    };
  }, [refresh]);

  const download = useCallback(async (model: WhisperModelName) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[model];
      return next;
    });
    // show the bar immediately; real progress events overwrite this
    setDownloads((prev) => ({
      ...prev,
      [model]: { model, downloadedBytes: 0, totalBytes: null },
    }));
    try {
      await downloadWhisperModel(model);
    } catch (error) {
      setDownloads((prev) => {
        const next = { ...prev };
        delete next[model];
        return next;
      });
      setErrors((prev) => ({ ...prev, [model]: String(error) }));
    }
  }, []);

  const cancel = useCallback((model: WhisperModelName) => {
    return cancelWhisperDownload(model);
  }, []);

  const remove = useCallback(
    async (model: WhisperModelName) => {
      await deleteWhisperModel(model);
      void refresh();
    },
    [refresh],
  );

  const models: WhisperModelRow[] = WHISPER_MODELS.map((info) => {
    const status = statuses?.find((s) => s.name === info.name);
    return {
      ...info,
      downloaded: status?.downloaded ?? false,
      sizeBytes: status?.sizeBytes ?? null,
      download: downloads[info.name] ?? null,
      error: errors[info.name] ?? null,
    };
  });

  const totalSizeBytes = models.reduce(
    (sum, model) => sum + (model.sizeBytes ?? 0),
    0,
  );

  return {
    models,
    totalSizeBytes,
    loading: statuses === null,
    download,
    cancel,
    remove,
  };
}
