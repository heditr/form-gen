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
    // Include emergency contacts array to test repeatable fields with initial data
    const contact = {
      contactEmail: 'contact.demo@example.com',
      contactPhone: '+1-555-0100',
      contactAlternateEmail: 'alt.demo@example.com',
      // Emergency contacts array - uses groupId 'emergency-contacts' (matches repeatableGroupId)
      // Each item uses base field IDs (not prefixed with groupId)
      // Structure matches what react-hook-form expects: groupId: [{ fieldId: value, ... }]
      'emergency-contacts': [
        {
          emergencyName: 'John Doe',
          emergencyRelationship: 'spouse',
          emergencyPhone: '123-456-7890',
        },
        {
          emergencyName: 'Jane Smith',
          emergencyRelationship: 'parent',
          emergencyPhone: '098-765-4321',
        },
      ],
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

