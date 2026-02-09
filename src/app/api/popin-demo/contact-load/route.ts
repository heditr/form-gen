/**
 * Popin Demo - Contact Load API Route
 * 
 * GET /api/popin-demo/contact-load
 * Returns mock contact information to demonstrate popinLoad behavior.
 */

import { NextResponse } from 'next/server';

/**
 * GET handler for popin demo contact load
 * 
 * @param request - Next.js Request object
 * @returns Response with contact info object
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Mock contact data (would typically come from backend)
    const contact = {
      contactEmail: 'contact.demo@example.com',
      contactPhone: '+1-555-0100',
      contactAlternateEmail: 'alt.demo@example.com',
    };

    return NextResponse.json(contact, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error loading popin demo contact info:', error);
    
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

