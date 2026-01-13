/**
 * States Data Source API Route
 * 
 * GET /api/data-sources/states
 * Returns a list of states/provinces for dropdown field
 */

import { NextResponse } from 'next/server';

/**
 * GET handler for states data source
 * 
 * @param request - Next.js Request object
 * @returns Response with states array
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Mock states data
    const states = [
      { code: 'CA', name: 'California' },
      { code: 'NY', name: 'New York' },
      { code: 'TX', name: 'Texas' },
      { code: 'FL', name: 'Florida' },
      { code: 'IL', name: 'Illinois' },
      { code: 'PA', name: 'Pennsylvania' },
      { code: 'OH', name: 'Ohio' },
      { code: 'GA', name: 'Georgia' },
      { code: 'NC', name: 'North Carolina' },
      { code: 'MI', name: 'Michigan' },
      { code: 'ON', name: 'Ontario' },
      { code: 'QC', name: 'Quebec' },
      { code: 'BC', name: 'British Columbia' },
      { code: 'AB', name: 'Alberta' },
    ];

    return NextResponse.json(states, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error loading states:', error);
    
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
