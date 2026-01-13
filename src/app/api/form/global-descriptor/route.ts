/**
 * Global Descriptor API Route
 * 
 * GET /api/form/global-descriptor
 * Returns the GlobalFormDescriptor JSON for the form engine.
 */

import { NextResponse } from 'next/server';
import type { GlobalFormDescriptor } from '@/types/form-descriptor';

/**
 * GET handler for global form descriptor
 * 
 * @param request - Next.js Request object
 * @returns Response with GlobalFormDescriptor JSON
 */
export async function GET(request: Request): Promise<NextResponse<GlobalFormDescriptor | { error: string }>> {
  try {
    // Only allow GET method
    if (request.method !== 'GET') {
      return NextResponse.json(
        { error: 'Method not allowed' },
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // TODO: In production, fetch from database or configuration service
    // For now, return a mock descriptor structure
    const globalDescriptor: GlobalFormDescriptor = {
      version: '1.0.0',
      blocks: [],
      submission: {
        url: '/api/submit',
        method: 'POST',
      },
    };

    return NextResponse.json(globalDescriptor, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    // Handle unexpected errors
    console.error('Error loading global descriptor:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}
