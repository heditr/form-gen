/**
 * Sub-Form API Route
 * 
 * GET /api/form/sub-form/:id
 * Returns the SubFormDescriptor JSON for the specified sub-form ID.
 * This endpoint is for internal backend use only - sub-forms are resolved
 * server-side before being returned to the frontend.
 */

import { NextResponse } from 'next/server';
import type { SubFormDescriptor } from '@/types/form-descriptor';
import { getSubFormById } from './sub-form-registry';

/**
 * GET handler for sub-form descriptor
 * 
 * @param request - Next.js Request object
 * @param context - Next.js route context with params
 * @returns Response with SubFormDescriptor JSON or error
 */
export async function GET(
  request: Request,
  context: { params: { id: string } }
): Promise<NextResponse<SubFormDescriptor | { error: string }>> {
  try {
    // Only allow GET method
    if (request.method !== 'GET') {
      return NextResponse.json(
        { error: 'Method not allowed' },
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { id } = context.params;
    const subForm = getSubFormById(id);

    if (!subForm) {
      return NextResponse.json(
        { error: `Sub-form "${id}" not found` },
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return NextResponse.json(subForm, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    // Handle unexpected errors
    console.error('Error loading sub-form descriptor:', error);
    
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
