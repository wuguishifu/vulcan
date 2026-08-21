'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const tabs = [
  { title: 'Claude API token', url: '/settings/api-token' },
  { title: 'Transcription models', url: '/settings/transcription-models' },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <nav className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <Link
            key={tab.url}
            href={tab.url}
            className={cn(
              '-mb-px border-b-2 border-transparent px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground',
              pathname === tab.url &&
                'border-primary font-medium text-foreground',
            )}
          >
            {tab.title}
          </Link>
        ))}
      </nav>
      {children}
    </main>
  );
}
