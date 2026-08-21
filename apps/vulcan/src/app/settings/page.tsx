'use client';

import { TranscriptionModels } from './transcription-models';

export default function Settings() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-8">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <TranscriptionModels />
    </main>
  );
}
