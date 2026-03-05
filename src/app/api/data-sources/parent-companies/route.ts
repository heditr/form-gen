/**
 * Parent Companies Data Source API Route
 * 
 * GET /api/data-sources/parent-companies
 * Returns a list of parent companies to demonstrate selection-based auto-fill.
 */

import { NextResponse } from 'next/server';

/**
 * GET handler for parent companies data source
 * 
 * @param request - Next.js Request object
 * @returns Response with parent companies array
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Mock parent companies data with rich payload for auto-fill
    const parentCompanies = [
      {
        id: 'acme',
        name: 'ACME Corporation',
        registrationNumber: 'US-123456789',
        address: {
          line1: '123 Main St',
          city: 'New York',
          country: 'US',
        },
      },
      {
        id: 'globex',
        name: 'Globex Inc.',
        registrationNumber: 'CA-987654321',
        address: {
          line1: '456 Queen St',
          city: 'Toronto',
          country: 'CA',
        },
      },
      {
        id: 'initech',
        name: 'Initech Ltd.',
        registrationNumber: 'UK-555777999',
        address: {
          line1: '789 High St',
          city: 'London',
          country: 'UK',
        },
      },
    ];

    return NextResponse.json(parentCompanies, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error loading parent companies:', error);

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

