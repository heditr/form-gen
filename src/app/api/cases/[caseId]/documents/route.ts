/**
 * POST /api/cases/:caseId/documents
 *
 * Stub: returns `{ documents: CaseDocumentsEntry[] }` for discriminant-driven card refresh.
 * Demo implementations may branch on `caseContext` later (see plan epic).
 */

import { NextResponse } from 'next/server';
import type { CaseContext } from '@/types/form-descriptor';

interface DocumentsPostBody {
  caseContext?: CaseContext;
}

interface ErrorResponse {
  error: string;
}

export async function POST(
  request: Request,
  context: { params: { caseId: string } }
): Promise<NextResponse<{ documents: unknown[] } | ErrorResponse>> {
  try {
    if (request.method !== 'POST') {
      return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const { caseId } = context.params;
    if (!caseId || typeof caseId !== 'string') {
      return NextResponse.json({ error: 'Missing caseId' }, { status: 400 });
    }

    await request.json().catch(() => ({})) as DocumentsPostBody;

    return NextResponse.json({ documents: [] }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
