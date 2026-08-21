'use client';

import { CheckIcon, DownloadIcon, Trash2Icon, XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBytes } from '@/lib/utils';
import { useWhisperModels, type WhisperModelRow } from '@/modules/whisper';

export function TranscriptionModels() {
  const { models, totalSizeBytes, loading, download, cancel, remove } =
    useWhisperModels();

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Transcription models</h2>
          <p className="text-sm text-muted-foreground">
            Larger models transcribe more accurately but run slower and take
            more disk space. Models are downloaded on demand and can be removed
            at any time.
          </p>
        </div>
        <p className="shrink-0 text-sm text-muted-foreground">
          {formatBytes(totalSizeBytes)} on disk
        </p>
      </div>
      <div className="divide-y rounded-lg border">
        {loading
          ? models.map((model) => (
              <div key={model.name} className="flex items-center gap-4 p-3">
                <Skeleton className="h-9 w-full" />
              </div>
            ))
          : models.map((model) => (
              <ModelRow
                key={model.name}
                model={model}
                onDownload={() => download(model.name)}
                onCancel={() => cancel(model.name)}
                onDelete={() => remove(model.name)}
              />
            ))}
      </div>
    </section>
  );
}

function ModelRow({
  model,
  onDownload,
  onCancel,
  onDelete,
}: {
  model: WhisperModelRow;
  onDownload: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-2 p-3">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{model.label}</span>
            <span className="text-xs text-muted-foreground">
              {model.sizeBytes !== null
                ? formatBytes(model.sizeBytes)
                : `~${formatBytes(model.approxSizeMB * 1024 * 1024)}`}
            </span>
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {model.description}
          </p>
        </div>
        <ModelActions
          model={model}
          onDownload={onDownload}
          onCancel={onCancel}
          onDelete={onDelete}
        />
      </div>
      {model.download && (
        <div className="flex items-center gap-3">
          <Progress
            value={
              model.download.totalBytes
                ? (model.download.downloadedBytes / model.download.totalBytes) *
                  100
                : null
            }
          />
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {formatBytes(model.download.downloadedBytes)}
            {model.download.totalBytes
              ? ` / ${formatBytes(model.download.totalBytes)}`
              : ''}
          </span>
        </div>
      )}
      {model.error && (
        <p className="text-xs text-destructive">
          Download failed: {model.error}
        </p>
      )}
    </div>
  );
}

function ModelActions({
  model,
  onDownload,
  onCancel,
  onDelete,
}: {
  model: WhisperModelRow;
  onDownload: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  if (model.download) {
    return (
      <Button variant="outline" size="sm" onClick={onCancel}>
        <XIcon data-icon="inline-start" />
        Cancel
      </Button>
    );
  }
  if (model.downloaded) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <CheckIcon className="size-3.5" />
          Downloaded
        </span>
        <Button
          variant="destructive"
          size="icon-sm"
          aria-label={`Delete ${model.label}`}
          onClick={onDelete}
        >
          <Trash2Icon />
        </Button>
      </div>
    );
  }
  return (
    <Button variant="outline" size="sm" onClick={onDownload}>
      <DownloadIcon data-icon="inline-start" />
      Download
    </Button>
  );
}
