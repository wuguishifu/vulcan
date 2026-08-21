'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Static export (Tauri) has no server redirects, so forward on the client.
export default function Settings() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings/api-token');
  }, [router]);

  return null;
}
