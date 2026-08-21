'use client';

import { Suspense, useState } from 'react';

import { convertFileSrc } from '@tauri-apps/api/core';
import { CheckIcon, RotateCcwIcon, ScissorsIcon, XIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { cancelJob, confirmJob, retrimJob, retryJob } from '@/modules/jobs';
import { selectJobById, type Job } from '@/modules/session';
import { useAppDispatch, useAppSelector } from '@/modules/store';

// useSearchParams needs a Suspense boundary for the static export build.
export default function ReviewPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-64 w-full max-w-5xl" />}>
      <ReviewContent />
    </Suspense>
  );
}

function ReviewContent() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get('job');
  const job = useAppSelector((state) => selectJobById(state, jobId));

  if (!job) {
    return (
      <main className="mx-auto w-full max-w-5xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Job not found</CardTitle>
            <CardDescription>
              This job doesn&apos;t exist anymore — jobs don&apos;t survive an
              app restart.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" render={<Link href="/" />}>
              Back to home
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return <ReviewJob job={job} />;
}

function ReviewJob({ job }: { job: Job }) {
  const dispatch = useAppDispatch();
  const router = useRouter();

  const [edited, setEdited] = useState<{ start: string; end: string } | null>(
    null,
  );
  const trimming = job.stage === 'trimming';

  const start = edited?.start ?? String(job.trim?.start ?? 0);
  const end = edited?.end ?? String(job.trim?.end ?? 0);
  const startNumber = Number(start);
  const endNumber = Number(end);
  const rangeValid =
    Number.isFinite(startNumber) &&
    Number.isFinite(endNumber) &&
    startNumber >= 0 &&
    endNumber > startNumber;
  const rangeEdited =
    job.trim !== null &&
    (startNumber !== job.trim.start || endNumber !== job.trim.end);

  const clip = job.claude?.found ? job.claude : null;

  const confirm = async () => {
    const replaced: boolean = await dispatch(confirmJob(job.id));
    if (replaced) router.push('/');
  };

  const retrim = () => {
    setEdited(null);
    void dispatch(retrimJob(job.id, startNumber, endNumber));
  };

  const retry = () => {
    void dispatch(retryJob(job.id));
    router.push('/');
  };

  const cancel = () => {
    void dispatch(cancelJob(job.id));
    router.push('/');
  };

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {clip ? clip.clip_title : 'Review clip'}
        </h1>
        {clip && (
          <p className="text-sm text-muted-foreground">{clip.reasoning}</p>
        )}
      </div>

      {job.stage === 'failed' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">
              Something went wrong
            </CardTitle>
            <CardDescription>{job.error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4">
        <VideoPanel title="Original" path={job.videoPath} />
        <VideoPanel
          title="Trimmed"
          path={job.trimmedPath}
          busy={trimming}
          quoteStart={clip?.quote_start}
          quoteEnd={clip?.quote_end}
        />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="trim-start">Start (seconds)</Label>
            <Input
              id="trim-start"
              type="number"
              step={0.1}
              min={0}
              className="w-32"
              value={start}
              disabled={trimming}
              onChange={(e) => setEdited({ start: e.target.value, end })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trim-end">End (seconds)</Label>
            <Input
              id="trim-end"
              type="number"
              step={0.1}
              min={0}
              className="w-32"
              value={end}
              disabled={trimming}
              onChange={(e) => setEdited({ start, end: e.target.value })}
            />
          </div>
          <div className="flex flex-1 flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              disabled={trimming || !rangeValid || !rangeEdited}
              onClick={retrim}
            >
              <ScissorsIcon data-icon="inline-start" />
              Re-trim
            </Button>
            <Button variant="outline" disabled={trimming} onClick={retry}>
              <RotateCcwIcon data-icon="inline-start" />
              Retry analysis
            </Button>
            <Button variant="outline" disabled={trimming} onClick={cancel}>
              <XIcon data-icon="inline-start" />
              Cancel
            </Button>
            <Button
              disabled={trimming || job.stage !== 'awaiting-review'}
              onClick={confirm}
            >
              <CheckIcon data-icon="inline-start" />
              Confirm &amp; replace original
            </Button>
          </div>
        </CardContent>
      </Card>

      {job.error && job.stage === 'awaiting-review' && (
        <p className="text-sm text-destructive">{job.error}</p>
      )}
      <p className="text-sm text-muted-foreground">
        Confirming moves the original to the recycle bin and puts the trimmed
        clip at its path. The cut starts on a keyframe, so the clip may begin a
        moment before the requested start.
      </p>
    </main>
  );
}

function VideoPanel({
  title,
  path,
  busy = false,
  quoteStart,
  quoteEnd,
}: {
  title: string;
  path: string | null;
  busy?: boolean;
  quoteStart?: string;
  quoteEnd?: string;
}) {
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {quoteStart && quoteEnd && (
          <CardDescription>
            &ldquo;{quoteStart}&rdquo; &rarr; &ldquo;{quoteEnd}&rdquo;
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="relative overflow-hidden rounded-lg bg-black">
          {path ? (
            // key forces a reload when a re-trim produces a new file
            <video
              key={path}
              controls
              preload="metadata"
              className="aspect-video w-full"
              src={convertFileSrc(path)}
            />
          ) : (
            <div className="aspect-video w-full" />
          )}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <Spinner className="size-8 text-white" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
