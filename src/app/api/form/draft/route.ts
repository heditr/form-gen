/**
 * Draft Save API Route
 *
 * PUT /api/form/draft
 * Receives partial form data for draft autosave and returns an acknowledgement.
 */

import { NextResponse } from 'next/server';

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();

    return NextResponse.json(
      {
        saved: true,
        timestamp: new Date().toISOString(),
        data: body,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error processing draft save:', error);

    return NextResponse.json(
      {
        error: 'Invalid request body',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 400 }
    );
  }
}
