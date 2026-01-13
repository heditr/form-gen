/**
 * Cities Data Source API Route
 * 
 * GET /api/data-sources/cities
 * Returns a list of cities for autocomplete field
 */

import { NextResponse } from 'next/server';

/**
 * GET handler for cities data source
 * 
 * @param request - Next.js Request object
 * @returns Response with cities array
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Mock cities data
    const cities = [
      { id: '1', name: 'New York' },
      { id: '2', name: 'Los Angeles' },
      { id: '3', name: 'Chicago' },
      { id: '4', name: 'Houston' },
      { id: '5', name: 'Phoenix' },
      { id: '6', name: 'Philadelphia' },
      { id: '7', name: 'San Antonio' },
      { id: '8', name: 'San Diego' },
      { id: '9', name: 'Dallas' },
      { id: '10', name: 'San Jose' },
      { id: '11', name: 'Austin' },
      { id: '12', name: 'Jacksonville' },
      { id: '13', name: 'Fort Worth' },
      { id: '14', name: 'Columbus' },
      { id: '15', name: 'Charlotte' },
      { id: '16', name: 'San Francisco' },
      { id: '17', name: 'Indianapolis' },
      { id: '18', name: 'Seattle' },
      { id: '19', name: 'Denver' },
      { id: '20', name: 'Washington' },
      { id: '21', name: 'Boston' },
      { id: '22', name: 'El Paso' },
      { id: '23', name: 'Nashville' },
      { id: '24', name: 'Detroit' },
      { id: '25', name: 'Oklahoma City' },
      { id: '26', name: 'Portland' },
      { id: '27', name: 'Las Vegas' },
      { id: '28', name: 'Memphis' },
      { id: '29', name: 'Louisville' },
      { id: '30', name: 'Baltimore' },
      { id: '31', name: 'Toronto' },
      { id: '32', name: 'Montreal' },
      { id: '33', name: 'Vancouver' },
      { id: '34', name: 'Calgary' },
      { id: '35', name: 'Ottawa' },
    ];

    return NextResponse.json(cities, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error loading cities:', error);
    
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
