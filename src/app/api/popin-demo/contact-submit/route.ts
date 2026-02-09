/**
 * Popin Demo - Contact Submit API Route
 * 
 * POST /api/popin-demo/contact-submit
 * Receives contact information from popinSubmit and returns either:
 * - 200 OK with success payload
 * - 400 with field-level errors in BackendErrorResponse format
 */

import { NextResponse } from 'next/server';
import type { BackendErrorResponse } from '@/utils/submission-orchestrator';

interface ContactSubmitRequest {
  contactEmail?: string;
  contactPhone?: string;
  contactAlternateEmail?: string;
}

/**
 * POST handler for popin demo contact submit
 * 
 * @param request - Next.js Request object with ContactSubmitRequest in body
 * @returns Response with success or BackendErrorResponse
 */
export async function POST(
  request: Request
): Promise<NextResponse<{ success: boolean } | BackendErrorResponse>> {
  try {
    if (request.method !== 'POST') {
      return NextResponse.json(
        { error: 'Method not allowed' },
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let body: ContactSubmitRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const errors: NonNullable<BackendErrorResponse['errors']> = [];

    // Very simple demo validation rules:
    // - contactEmail required and must not contain "invalid"
    // - contactPhone required and must be at least 7 chars
    if (!body.contactEmail || body.contactEmail.trim() === '') {
      errors.push({
        field: 'contactEmail',
        message: 'Contact email is required',
      });
    } else if (body.contactEmail.includes('invalid')) {
      errors.push({
        field: 'contactEmail',
        message: 'This email address is not allowed (demo error)',
      });
    }

    if (!body.contactPhone || body.contactPhone.trim().length < 7) {
      errors.push({
        field: 'contactPhone',
        message: 'Contact phone must be at least 7 characters',
      });
    }

    // If there are validation errors, return 400 with errors array
    if (errors.length > 0) {
      const errorResponse: BackendErrorResponse = {
        error: 'Validation failed',
        errors,
      };

      return NextResponse.json(errorResponse, {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // Otherwise, simulate success
    return NextResponse.json(
      { success: true },
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in popin demo contact submit:', error);

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

