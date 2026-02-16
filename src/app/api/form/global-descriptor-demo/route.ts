/**
 * Demo Global Descriptor API Route
 * 
 * GET /api/form/global-descriptor-demo
 * Returns a comprehensive GlobalFormDescriptor specifically designed to showcase
 * re-hydration features with multiple discriminant fields and conditional logic.
 */

import { NextResponse } from 'next/server';
import type { GlobalFormDescriptor } from '@/types/form-descriptor';

/**
 * GET handler for demo global form descriptor
 * 
 * @param request - Next.js Request object
 * @returns Response with comprehensive GlobalFormDescriptor JSON
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

    // Comprehensive descriptor showcasing re-hydration
    const globalDescriptor: GlobalFormDescriptor = {
      version: '1.0.0',
      blocks: [
        {
          id: 'entity-type',
          title: 'Entity Type',
          description: 'Select the type of entity you are registering',
          fields: [
            {
              id: 'entityType',
              type: 'radio',
              label: 'Entity Type',
              description: 'This field triggers re-hydration',
              items: [
                { label: 'Individual', value: 'individual' },
                { label: 'Corporation', value: 'corporation' },
                { label: 'Partnership', value: 'partnership' },
                { label: 'Trust', value: 'trust' },
              ],
              validation: [
                {
                  type: 'required',
                  message: 'Entity type is required',
                },
              ],
              isDiscriminant: true, // Triggers re-hydration
            },
          ],
        },
        {
          id: 'jurisdiction',
          title: 'Jurisdiction',
          description: 'Select your jurisdiction',
          fields: [
            {
              id: 'country',
              type: 'dropdown',
              label: 'Country',
              description: 'Select your country (triggers re-hydration)',
              items: [
                { label: 'United States', value: 'US' },
                { label: 'Canada', value: 'CA' },
                { label: 'United Kingdom', value: 'UK' },
                { label: 'Australia', value: 'AU' },
                { label: 'Germany', value: 'DE' },
                { label: 'France', value: 'FR' },
              ],
              validation: [
                {
                  type: 'required',
                  message: 'Country is required',
                },
              ],
              isDiscriminant: true, // Triggers re-hydration
            },
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
              // Field is hidden if country is not US or CA
              status: {
                hidden: '{{not (or (eq country "US") (eq country "CA"))}}',
              },
            },
            {
              id: 'openContactPopin',
              type: 'button',
              label: 'Add Contact Information',
              description: 'Open contact information popin dialog',
              validation: [],
              button: {
                variant: 'single',
                popinBlockId: 'contact-info',
              },
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
                {
                  type: 'maxLength',
                  value: 100,
                  message: 'Name must not exceed 100 characters',
                },
              ],
            },
            {
              id: 'email',
              type: 'text',
              label: 'Email Address',
              description: 'Enter your email (default from caseContext if available)',
              defaultValue: '{{caseContext.email}}',
              validation: [
                {
                  type: 'required',
                  message: 'Email is required',
                },
                {
                  type: 'pattern',
                  value: '^[^@]+@[^@]+\\.[^@]+$',
                  message: 'Please enter a valid email address',
                },
              ],
            },
            {
              id: 'phone',
              type: 'text',
              label: 'Phone Number',
              description: 'Enter your phone number (default from caseContext if available)',
              defaultValue: '{{caseContext.phone}}',
              validation: [
                {
                  type: 'required',
                  message: 'Phone number is required',
                },
              ],
            },
          ],
        },
        // Non-repeatable address block (referenced by repeatable block)
        {
          id: 'address-block',
          title: 'Address',
          description: 'A single address entry',
          fields: [
            {
              id: 'street',
              type: 'text',
              label: 'Street Address',
              description: 'Enter street address',
              validation: [
                {
                  type: 'required',
                  message: 'Street address is required',
                },
              ],
            },
            {
              id: 'city',
              type: 'text',
              label: 'City',
              description: 'Enter city',
              validation: [
                {
                  type: 'required',
                  message: 'City is required',
                },
              ],
            },
            {
              id: 'zip',
              type: 'text',
              label: 'ZIP/Postal Code',
              description: 'Enter ZIP or postal code',
              validation: [
                {
                  type: 'required',
                  message: 'ZIP/Postal code is required',
                },
              ],
            },
          ],
        },
        // Repeatable block that references address-block
        {
          id: 'addresses-block',
          title: 'Addresses',
          description: 'Add multiple addresses (repeatable field group)',
          repeatable: true,
          repeatableBlockRef: 'address-block', // Reference to address-block above
          minInstances: 1,
          maxInstances: 5,
          fields: [], // Fields will be resolved from address-block
        },
        {
          id: 'corporation-details',
          title: 'Corporation Details',
          description: 'Additional information for corporations',
          // Block is hidden if entityType is not 'corporation'
          status: {
            hidden: '{{not (eq entityType "corporation")}}',
          },
          fields: [
            {
              id: 'corporationName',
              type: 'text',
              label: 'Corporation Name',
              description: 'Legal name of the corporation',
              validation: [
                {
                  type: 'required',
                  message: 'Corporation name is required',
                },
              ],
            },
            {
              id: 'taxId',
              type: 'text',
              label: 'Tax ID / EIN',
              description: 'Enter the corporation tax identification number',
              validation: [
                {
                  type: 'required',
                  message: 'Tax ID is required',
                },
                {
                  type: 'pattern',
                  value: '^\\d{2}-\\d{7}$',
                  message: 'Tax ID must be in format XX-XXXXXXX',
                },
              ],
            },
            {
              id: 'incorporationDate',
              type: 'date',
              label: 'Date of Incorporation',
              description: 'When was the corporation incorporated?',
              validation: [
                {
                  type: 'required',
                  message: 'Incorporation date is required',
                },
              ],
            },
          ],
        },
        {
          id: 'individual-details',
          title: 'Individual Details',
          description: 'Additional information for individuals',
          // Block is hidden if entityType is not 'individual'
          status: {
            hidden: '{{not (eq entityType "individual")}}',
          },
          fields: [
            {
              id: 'dateOfBirth',
              type: 'date',
              label: 'Date of Birth',
              description: 'Enter your date of birth',
              validation: [
                {
                  type: 'required',
                  message: 'Date of birth is required',
                },
              ],
            },
            {
              id: 'ssn',
              type: 'text',
              label: 'Social Security Number',
              description: 'Enter your SSN (US only)',
              validation: [
                {
                  type: 'required',
                  message: 'SSN is required',
                },
                {
                  type: 'pattern',
                  value: '^\\d{3}-\\d{2}-\\d{4}$',
                  message: 'SSN must be in format XXX-XX-XXXX',
                },
              ],
              // Field is hidden if country is not US
              status: {
                hidden: '{{not (eq country "US")}}',
              },
            },
            {
              id: 'passportNumber',
              type: 'text',
              label: 'Passport Number',
              description: 'Enter your passport number',
              validation: [
                {
                  type: 'required',
                  message: 'Passport number is required',
                },
              ],
              // Field is hidden if country is US
              status: {
                hidden: '{{eq country "US"}}',
              },
            },
          ],
        },
        {
          id: 'partnership-details',
          title: 'Partnership Details',
          description: 'Additional information for partnerships',
          // Block is hidden if entityType is not 'partnership'
          status: {
            hidden: '{{not (eq entityType "partnership")}}',
          },
          fields: [
            {
              id: 'partnershipName',
              type: 'text',
              label: 'Partnership Name',
              description: 'Legal name of the partnership',
              validation: [
                {
                  type: 'required',
                  message: 'Partnership name is required',
                },
              ],
            },
            {
              id: 'partners',
              type: 'text',
              label: 'Number of Partners',
              description: 'How many partners are in this partnership?',
              validation: [
                {
                  type: 'required',
                  message: 'Number of partners is required',
                },
              ],
            },
          ],
        },
        {
          id: 'trust-details',
          title: 'Trust Details',
          description: 'Additional information for trusts',
          // Block is hidden if entityType is not 'trust'
          status: {
            hidden: '{{not (eq entityType "trust")}}',
          },
          fields: [
            {
              id: 'trustName',
              type: 'text',
              label: 'Trust Name',
              description: 'Legal name of the trust',
              validation: [
                {
                  type: 'required',
                  message: 'Trust name is required',
                },
              ],
            },
            {
              id: 'trusteeName',
              type: 'text',
              label: 'Trustee Name',
              description: 'Name of the trustee',
              validation: [
                {
                  type: 'required',
                  message: 'Trustee name is required',
                },
              ],
            },
          ],
        },
        {
          id: 'additional-info',
          title: 'Additional Information',
          description: 'Optional additional details',
          fields: [
            {
              id: 'newsletter',
              type: 'checkbox',
              label: 'Subscribe to newsletter',
              description: 'Receive updates via email (default from caseContext if available)',
              defaultValue: '{{#if caseContext.newsletter}}true{{else}}false{{/if}}',
              validation: [],
            },
            {
              id: 'comments',
              type: 'text',
              label: 'Additional Comments',
              description: 'Any additional information you would like to provide',
              validation: [
                {
                  type: 'maxLength',
                  value: 500,
                  message: 'Comments must not exceed 500 characters',
                },
              ],
              // Field is disabled if newsletter is not checked
              status: {
                disabled: '{{not newsletter}}',
              },
            },
            {
              id: 'documents',
              type: 'file',
              label: 'Supporting Documents',
              description: 'Upload any supporting documents (default URL from caseContext if available)',
              defaultValue: '{{caseContext.documentUrl}}',
              validation: [],
            },
            {
              id: 'priority',
              type: 'number',
              label: 'Priority Level',
              description: 'Priority level (default from caseContext if available)',
              defaultValue: '{{caseContext.priority}}',
              validation: [
                {
                  type: 'required',
                  message: 'Priority is required',
                },
              ],
            },
          ],
        },
        // Popin block - standalone, never renders inline
        {
          id: 'contact-info',
          title: 'Contact Information',
          description: 'Additional contact details (opens in popin dialog)',
          popin: true,
          // Load existing contact details when the popin opens
          popinLoad: {
            url: '/api/popin-demo/contact-load',
          },
          // Submit contact details to demo endpoint when Validate is clicked
          popinSubmit: {
            url: '/api/popin-demo/contact-submit',
            method: 'POST',
            // Only send the popin contact fields, not the entire form
            payloadTemplate: '{"contactEmail":"{{formData.contactEmail}}","contactPhone":"{{formData.contactPhone}}","contactAlternateEmail":"{{formData.contactAlternateEmail}}"}',
          },
          fields: [
            {
              id: 'contactEmail',
              type: 'text',
              label: 'Contact Email',
              description: 'Email used for notifications about this case',
              validation: [
                {
                  type: 'required',
                  message: 'Contact email is required',
                },
                {
                  type: 'pattern',
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Invalid email format',
                },
              ],
            },
            {
              id: 'contactPhone',
              type: 'text',
              label: 'Contact Phone',
              description: 'Phone number used for follow-up questions',
              validation: [
                {
                  type: 'required',
                  message: 'Contact phone number is required',
                },
              ],
            },
            {
              id: 'contactAlternateEmail',
              type: 'text',
              label: 'Alternate Email',
              description: 'Optional alternate email address',
              validation: [],
            },
          ],
        },
      ],
      submission: {
        url: '/api/submit',
        method: 'POST',
      },
    };

    // Resolve repeatable block references if any are present
    let resolvedDescriptor = globalDescriptor;
    try {
      const { resolveAllRepeatableBlockRefs } = await import('@/utils/repeatable-block-resolver');
      resolvedDescriptor = resolveAllRepeatableBlockRefs(globalDescriptor);
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
    console.error('Error loading demo global descriptor:', error);
    
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
