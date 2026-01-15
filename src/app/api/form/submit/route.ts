/**
 * Form Submission API Route
 * 
 * POST /api/form/submit
 * Receives form submission data and returns a response.
 * Can optionally return validation errors for testing backend validation.
 */

import { NextResponse } from 'next/server';

/**
 * POST handler for form submission
 * 
 * @param request - Next.js Request object
 * @returns Response with submission result or validation errors
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    // Parse request body
    const body = await request.json();

    // Log the received payload for debugging
    console.log('Form submission received:', body);

    // For demo purposes, we can simulate validation errors
    // Uncomment the section below to test backend validation error handling
    
    // Example: Simulate validation error for testing
    // if (!body.email || !body.email.includes('@')) {
    //   return NextResponse.json(
    //     {
    //       error: 'Validation failed',
    //       errors: [
    //         {
    //           field: 'email',
    //           message: 'Email is required and must be valid',
    //         },
    //       ],
    //     },
    //     { status: 400 }
    //   );
    // }

    // Return success response
    return NextResponse.json(
      {
        success: true,
        message: 'Form submitted successfully',
        data: body,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    // Handle parsing errors
    console.error('Error processing form submission:', error);
    
    return NextResponse.json(
      {
        error: 'Invalid request body',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}
