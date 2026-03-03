'use client';

/**
 * Renders @hookform/devtools only on the client (no SSR) to avoid hydration mismatch.
 */

import dynamic from 'next/dynamic';
import type { Control } from 'react-hook-form';

// Load DevTool with SSR disabled so it never renders on the server
const DevToolNoSSR = dynamic(
  () => import('@hookform/devtools').then((m) => m.DevTool),
  { ssr: false }
);

interface ClientOnlyDevToolProps {
  control: Control;
}

export function ClientOnlyDevTool({ control }: ClientOnlyDevToolProps) {
  return <DevToolNoSSR control={control} />;
}
