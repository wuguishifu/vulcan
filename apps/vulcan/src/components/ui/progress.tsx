import { cn } from '@/lib/utils';

function Progress({
  value,
  className,
}: {
  /** Percentage 0-100, or null for an indeterminate bar. */
  value: number | null;
  className?: string;
}) {
  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value ?? undefined}
      className={cn(
        'relative h-1.5 w-full overflow-hidden rounded-full bg-primary/20',
        className,
      )}
    >
      {value === null ? (
        <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
      ) : (
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      )}
    </div>
  );
}

export { Progress };
