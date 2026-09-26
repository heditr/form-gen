'use client';

/**
 * Renders @hookform/devtools only on the client (no SSR).
 *
 * DevTools' Panel subscribes via useWatch/useFormState. Mounting it in the same
 * tree as Controllers causes "Cannot update Panel while rendering Controller"
 * during field registration. Mount only after idle, and only in development.
 */

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Control } from 'react-hook-form';

const DevToolNoSSR = dynamic(
  () => import('@hookform/devtools').then((m) => m.DevTool),
  { ssr: false }
);

interface ClientOnlyDevToolProps {
  control: Control;
}

export function ClientOnlyDevTool({ control }: ClientOnlyDevToolProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') {
      return undefined;
    }
    // Defer past the initial Controller registration wave.
    const id = window.setTimeout(() => setReady(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  if (process.env.NODE_ENV !== 'development' || !ready) {
    return null;
  }

  return <DevToolNoSSR control={control} />;
}
