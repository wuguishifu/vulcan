'use client';

import { useEffect, useMemo, useState } from 'react';

import { open } from '@tauri-apps/plugin-dialog';
import { FilmIcon, FolderOpenIcon, PlayIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { hasApiToken } from '@/modules/api-token';
import { useClaudeModels } from '@/modules/claude';
import { cancelJob, dismissJob, retryJob, startJob } from '@/modules/jobs';
import { ACTIVE_STAGES, type Job, type JobStage } from '@/modules/session';
import {
  setClaudeModel,
  setWhisperModel,
} from '@/modules/settings/settings-slice';
import { useAppDispatch, useAppSelector } from '@/modules/store';
import { useWhisperModels, type WhisperModelName } from '@/modules/whisper';

const VIDEO_EXTENSIONS = ['mp4', 'mkv', 'mov', 'webm', 'avi', 'm4v'];

const STAGE_LABELS: Record<JobStage, string> = {
  'extracting-audio': 'Extracting audio',
  transcribing: 'Transcribing',
  analyzing: 'Analyzing transcript',
  trimming: 'Trimming',
  'awaiting-review': 'Ready for review',
  done: 'Done',
  failed: 'Failed',
  'no-clip-found': 'No clip found',
};

const fileName = (path: string) => path.split(/[/\\]/).pop() ?? path;

export default function Index() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const jobs = useAppSelector((state) => state.session.jobs);
  const isProcessing = useAppSelector((state) => state.session.isProcessing);

  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [startedJobId, setStartedJobId] = useState<string | null>(null);

  const [tokenSaved, setTokenSaved] = useState<boolean | null>(null);
  useEffect(() => {
    hasApiToken()
      .then(setTokenSaved)
      .catch(() => setTokenSaved(false));
  }, []);

  const { models: whisperModels, loading: whisperLoading } = useWhisperModels();
  const downloadedWhisperModels = useMemo(
    () => whisperModels.filter((model) => model.downloaded),
    [whisperModels],
  );
  const {
    models: claudeModels,
    loading: claudeLoading,
    usingFallback,
  } = useClaudeModels();

  const savedWhisperModel = useAppSelector(
    (state) => state.settings.whisperModel,
  );
  const savedClaudeModel = useAppSelector(
    (state) => state.settings.claudeModel,
  );

  // The saved choice wins while it's still available; otherwise the first
  // available option is preselected.
  const whisperModel =
    downloadedWhisperModels.find((m) => m.name === savedWhisperModel)?.name ??
    downloadedWhisperModels[0]?.name ??
    null;
  const claudeModel =
    claudeModels.find((m) => m.id === savedClaudeModel)?.id ??
    claudeModels[0]?.id ??
    null;

  // Jump to review once the job the user started here is ready; clearing the
  // id keeps a later visit to this page from bouncing back to review.
  const startedJob = jobs.find((job) => job.id === startedJobId);
  useEffect(() => {
    if (startedJob?.stage === 'awaiting-review') {
      setStartedJobId(null);
      router.push(`/review?job=${startedJob.id}`);
    }
  }, [startedJob?.stage, startedJob?.id, router]);

  const pickVideo = async () => {
    const picked = await open({
      multiple: false,
      filters: [{ name: 'Video', extensions: VIDEO_EXTENSIONS }],
    });
    if (typeof picked === 'string') setVideoPath(picked);
  };

  const canStart =
    videoPath !== null &&
    whisperModel !== null &&
    claudeModel !== null &&
    tokenSaved === true &&
    !isProcessing;

  const start = async () => {
    if (!canStart || !videoPath || !whisperModel || !claudeModel) return;
    setVideoPath(null);
    const id: string = await dispatch(
      startJob({ videoPath, whisperModel, claudeModel }),
    );
    setStartedJobId(id);
  };

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Vulcan</h1>

      <Card>
        <CardHeader>
          <CardTitle>Create a clip</CardTitle>
          <CardDescription>
            Pick a recording and Vulcan will transcribe it, find the highlight,
            and trim the video around it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={pickVideo}>
              <FolderOpenIcon data-icon="inline-start" />
              Choose video
            </Button>
            {videoPath ? (
              <span className="flex min-w-0 items-center gap-1.5 text-sm">
                <FilmIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{fileName(videoPath)}</span>
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">
                No video selected
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Transcription model</Label>
              {!whisperLoading && downloadedWhisperModels.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No models downloaded.{' '}
                  <Link
                    href="/settings/transcription-models"
                    className="underline hover:text-foreground"
                  >
                    Download one in settings
                  </Link>
                  .
                </p>
              ) : (
                <Select
                  items={downloadedWhisperModels.map((model) => ({
                    value: model.name,
                    label: model.label,
                  }))}
                  value={whisperModel}
                  onValueChange={(value) => {
                    if (value) {
                      dispatch(setWhisperModel(value as WhisperModelName));
                    }
                  }}
                >
                  <SelectTrigger className="w-full" disabled={whisperLoading}>
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {downloadedWhisperModels.map((model) => (
                      <SelectItem key={model.name} value={model.name}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Claude model</Label>
              {tokenSaved === false ? (
                <p className="text-sm text-muted-foreground">
                  No API token saved.{' '}
                  <Link
                    href="/settings/api-token"
                    className="underline hover:text-foreground"
                  >
                    Add one in settings
                  </Link>
                  .
                </p>
              ) : (
                <>
                  <Select
                    items={claudeModels.map((model) => ({
                      value: model.id,
                      label: model.displayName,
                    }))}
                    value={claudeModel}
                    onValueChange={(value) => {
                      if (value) dispatch(setClaudeModel(value));
                    }}
                  >
                    <SelectTrigger className="w-full" disabled={claudeLoading}>
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {claudeModels.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {usingFallback && (
                    <p className="text-xs text-muted-foreground">
                      Couldn&apos;t fetch the live model list; showing known
                      models.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={start} disabled={!canStart}>
            {isProcessing ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <PlayIcon data-icon="inline-start" />
            )}
            Create clip
          </Button>
        </CardFooter>
      </Card>

      {jobs.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Jobs</h2>
          {jobs
            .slice()
            .reverse()
            .map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
        </section>
      )}
    </main>
  );
}

function JobCard({ job }: { job: Job }) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const active = ACTIVE_STAGES.includes(job.stage);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex min-w-0 items-center gap-2">
          <span className="truncate">{fileName(job.videoPath)}</span>
          <Badge variant={job.stage === 'failed' ? 'destructive' : 'secondary'}>
            {active && <Spinner className="size-3" />}
            {STAGE_LABELS[job.stage]}
          </Badge>
        </CardTitle>
        {job.stage === 'no-clip-found' && job.claude && (
          <CardDescription>
            The model couldn&apos;t find a clip-worthy moment:{' '}
            {job.claude.reasoning}
          </CardDescription>
        )}
        {job.stage === 'failed' && job.error && (
          <CardDescription className="text-destructive">
            {job.error}
          </CardDescription>
        )}
        {job.stage === 'done' && (
          <CardDescription>
            The trimmed clip replaced the original; the original is in the
            recycle bin.
          </CardDescription>
        )}
      </CardHeader>
      <CardFooter className="gap-2">
        {active && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => dispatch(cancelJob(job.id))}
          >
            Cancel
          </Button>
        )}
        {job.stage === 'awaiting-review' && (
          <Button
            size="sm"
            onClick={() => router.push(`/review?job=${job.id}`)}
          >
            Review
          </Button>
        )}
        {(job.stage === 'failed' || job.stage === 'no-clip-found') && (
          <>
            <Button size="sm" onClick={() => dispatch(retryJob(job.id))}>
              Retry
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => dispatch(dismissJob(job.id))}
            >
              Dismiss
            </Button>
          </>
        )}
        {job.stage === 'done' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => dispatch(dismissJob(job.id))}
          >
            Dismiss
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
