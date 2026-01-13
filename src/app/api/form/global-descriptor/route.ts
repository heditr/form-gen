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

    // Test descriptor with Handlebars templates to verify functionality
    const globalDescriptor: GlobalFormDescriptor = {
      version: '1.0.0',
      blocks: [
        {
          id: 'basic-info',
          title: 'Basic Information',
          description: 'Enter your basic information',
          fields: [
            {
              id: 'name',
              type: 'text',
              label: 'Full Name',
              description: 'Enter your full name',
              validation: [
                {
                  type: 'required',
                  message: 'Name is required',
                },
                {
                  type: 'minLength',
                  value: 2,
                  message: 'Name must be at least 2 characters',
                },
              ],
            },
            {
              id: 'country',
              type: 'dropdown',
              label: 'Country',
              description: 'Select your country',
              items: [
                { label: 'United States', value: 'US' },
                { label: 'Canada', value: 'CA' },
                { label: 'United Kingdom', value: 'UK' },
              ],
              validation: [
                {
                  type: 'required',
                  message: 'Country is required',
                },
              ],
              isDiscriminant: true, // This field triggers re-hydration
            },
          ],
        },
        {
          id: 'additional-info',
          title: 'Additional Information',
          description: 'Additional details',
          status: {
            // Block is hidden if country is not selected
            hidden: '{{isEmpty country}}',
          },
          fields: [
            {
              id: 'email',
              type: 'text',
              label: 'Email Address',
              description: 'Enter your email',
              validation: [
                {
                  type: 'required',
                  message: 'Email is required',
                },
                {
                  type: 'minLength',
                  value: 5,
                  message: 'Email must be at least 5 characters',
                },
              ],
            },
            {
              id: 'newsletter',
              type: 'checkbox',
              label: 'Subscribe to newsletter',
              description: 'Receive updates via email',
              defaultValue: false,
            },
            {
              id: 'age',
              type: 'text',
              label: 'Age',
              description: 'Enter your age',
              validation: [
                {
                  type: 'required',
                  message: 'Age is required',
                },
              ],
              // Field is disabled if newsletter is not checked
              status: {
                disabled: '{{not newsletter}}',
              },
            },
          ],
        },
        {
          id: 'conditional-block',
          title: 'Conditional Block',
          description: 'This block appears only for specific countries',
          // Block is visible only if country is US or CA
          status: {
            hidden: '{{not (or (eq country "US") (eq country "CA"))}}',
          },
          fields: [
            {
              id: 'state',
              type: 'text',
              label: 'State/Province',
              description: 'Enter your state or province',
              validation: [
                {
                  type: 'required',
                  message: 'State/Province is required',
                },
              ],
            },
          ],
        },
      ],
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
