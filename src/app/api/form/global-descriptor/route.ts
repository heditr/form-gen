/**
 * Global Descriptor API Route
 * 
 * GET /api/form/global-descriptor
 * Returns the GlobalFormDescriptor JSON for the form engine.
 */

import { NextResponse } from 'next/server';
import type { GlobalFormDescriptor } from '@/types/form-descriptor';
import { resolveSubForms } from '@/utils/sub-form-resolver';
import { fetchSubForms } from '../sub-form/[id]/sub-form-fetcher';
import { collectSubFormReferences } from './sub-form-collector';

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

    // More complex descriptor with data sources for dropdown and autocomplete
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
                { label: 'Australia', value: 'AU' },
                { label: 'Germany', value: 'DE' },
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
          id: 'location-info',
          title: 'Location Details',
          description: 'Select your location details',
          fields: [
            {
              id: 'state',
              type: 'dropdown',
              label: 'State/Province',
              description: 'Select your state or province (loaded from API)',
              dataSource: {
                url: '/api/data-sources/states',
                itemsTemplate: '{"label":"{{item.name}}","value":"{{item.code}}"}',
              },
              validation: [
                {
                  type: 'required',
                  message: 'State/Province is required',
                },
              ],
            },
            {
              id: 'city',
              type: 'autocomplete',
              label: 'City',
              description: 'Search and select your city (loaded from API)',
              dataSource: {
                url: '/api/data-sources/cities',
                itemsTemplate: '{"label":"{{item.name}}","value":"{{item.id}}"}',
              },
              validation: [
                {
                  type: 'required',
                  message: 'City is required',
                },
              ],
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
              validation: [],
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
              id: 'zipcode',
              type: 'text',
              label: 'ZIP/Postal Code',
              description: 'Enter your ZIP or postal code',
              validation: [
                {
                  type: 'required',
                  message: 'ZIP/Postal Code is required',
                },
              ],
            },
          ],
        },
      ],
      submission: {
        url: '/api/form/submit',
        method: 'POST',
      },
    };

    // Resolve sub-forms if any are referenced
    const subFormRefs = collectSubFormReferences(globalDescriptor);
    let resolvedDescriptor = globalDescriptor;

    if (subFormRefs.length > 0) {
      try {
        // Fetch all referenced sub-forms
        const subFormMap = await fetchSubForms(subFormRefs);
        
        // Resolve and merge sub-forms into the descriptor
        resolvedDescriptor = resolveSubForms(globalDescriptor, subFormMap);
      } catch (error) {
        // If sub-form resolution fails, return error response
        const errorMessage = error instanceof Error ? error.message : 'Failed to resolve sub-forms';
        console.error('Error resolving sub-forms:', error);
        
        return NextResponse.json(
          { error: errorMessage },
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      }
    }

    // Resolve repeatable block references if any are present
    try {
      const { resolveAllRepeatableBlockRefs } = await import('@/utils/repeatable-block-resolver');
      resolvedDescriptor = resolveAllRepeatableBlockRefs(resolvedDescriptor);
    } catch (error) {
      // If repeatable block resolution fails, return error response
      const errorMessage = error instanceof Error ? error.message : 'Failed to resolve repeatable block references';
      console.error('Error resolving repeatable block references:', error);
      
      return NextResponse.json(
        { error: errorMessage },
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    return NextResponse.json(resolvedDescriptor, {
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
