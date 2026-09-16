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
              description: 'Select your state or province (loaded from API). Template validation demo: US adds a pattern rule.',
              dataSource: {
                url: '/api/data-sources/states',
                itemsTemplate: '{"label":"{{item.name}}","value":"{{item.code}}"}',
              },
              validation:
                '[' +
                '{"type":"required","message":"State/Province is required"},' +
                '{{#if (eq country "US")}}' +
                '{"type":"pattern","value":"^[A-Z]{2}$","message":"Use 2-letter state code (US)"}' +
                '{{else}}' +
                '{"type":"minLength","value":2,"message":"Too short"}' +
                '{{/if}}' +
                ']',
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
            {
              id: 'preferredContactDate',
              type: 'date',
              label: 'Preferred Contact Date',
              description: 'Choose a preferred date for follow-up contact',
              defaultValue: '{{caseContext.preferredContactDate}}',
              validation: [
                {
                  type: 'required',
                  message: 'Preferred contact date is required',
                },
              ],
            },
          ],
        },
        {
          id: 'manual-lookup-demo',
          title: 'Manual Lookup Resilience Demo',
          description: 'Try REG-OK (success) or REG-404 (resilient fallback).',
          fields: [
            {
              id: 'registrationNumberLookup',
              type: 'text',
              label: 'Registration Number',
              description: 'Type value then click loop button. Typing alone does not call backend.',
              validation: [],
              manualLookup: {
                request: {
                  url: '/api/demo/company-lookup?registration={{registrationNumberLookup}}',
                  method: 'GET',
                },
                resilientErrors: [
                  {
                    status: 404,
                    code: 'COMPANY_NOT_FOUND',
                  },
                ],
                autoFillTargets: [
                  {
                    fieldId: 'companyNameLookup',
                    valueTemplate: '{{result.legalName}}',
                  },
                ],
              },
            },
            {
              id: 'companyNameLookup',
              type: 'text',
              label: 'Company Name',
              description: 'Enabled after successful lookup (or resilient 404).',
              validation: [],
            },
            {
              id: 'registrationNumberLookupPrefilled',
              type: 'text',
              label: 'Registration Number (Prefilled + Disabled)',
              description: 'Prefilled backend-style source locked at load and auto-looked up. Use clear to edit/re-lookup.',
              defaultValue: 'REG-OK',
              validation: [],
              manualLookup: {
                request: {
                  url: '/api/demo/company-lookup?registration={{registrationNumberLookupPrefilled}}',
                  method: 'GET',
                },
                resilientErrors: [
                  {
                    status: 404,
                    code: 'COMPANY_NOT_FOUND',
                  },
                ],
                autoFillTargets: [
                  {
                    fieldId: 'companyNameLookupPrefilled',
                    valueTemplate: '{{result.legalName}}',
                  },
                ],
                prefillOnMount: true,
              },
            },
            {
              id: 'companyNameLookupPrefilled',
              type: 'text',
              label: 'Company Name (Prefilled Flow)',
              description: 'Should be editable at load even when empty because source is prefilled+locked.',
              validation: [],
            },
          ],
        },
        // Field template for addresses-block only (not rendered on the main form)
        {
          id: 'address-block',
          title: 'Address',
          description: 'A single address entry',
          includeInMainValidation: false,
          status: {
            hidden: 'true',
          },
          layout: {
            mode: 'grid',
            columns: 2,
            gap: 'md',
          },
          fields: [
            {
              id: 'addressType',
              type: 'dropdown',
              label: 'Address Type',
              description: 'Residential, business, or mailing — controls which fields appear',
              items: [
                { label: 'Residential', value: 'residential' },
                { label: 'Business', value: 'business' },
                { label: 'Mailing', value: 'mailing' },
              ],
              validation: [
                {
                  type: 'required',
                  message: 'Address type is required',
                },
              ],
            },
            {
              id: 'country',
              type: 'dropdown',
              label: 'Address Country',
              description: 'Country for this address (independent of the jurisdiction country above)',
              items: [
                { label: 'United States', value: 'US' },
                { label: 'Canada', value: 'CA' },
                { label: 'United Kingdom', value: 'UK' },
                { label: 'France', value: 'FR' },
                { label: 'Germany', value: 'DE' },
              ],
              validation: [
                {
                  type: 'required',
                  message: 'Address country is required',
                },
              ],
              layout: {
                width: 'half',
              },
            },
            {
              id: 'state',
              type: 'text',
              label: 'State / Province',
              description: 'Required for US and Canadian addresses',
              validation: [
                {
                  type: 'required',
                  message: 'State/Province is required',
                },
              ],
              status: {
                hidden: '{{not (or (eq country "US") (eq country "CA"))}}',
              },
              layout: {
                width: 'half',
              },
            },
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
              layout: {
                width: 'half',
              },
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
              layout: {
                width: 'half',
              },
            },
            {
              id: 'companyName',
              type: 'text',
              label: 'Company Name',
              description: 'Legal name at this business address',
              validation: [
                {
                  type: 'required',
                  message: 'Company name is required for business addresses',
                },
              ],
              status: {
                hidden: '{{not (eq addressType "business")}}',
              },
            },
            {
              id: 'vatNumber',
              type: 'text',
              label: 'VAT Number',
              description: 'VAT/GST identifier for non-US business addresses',
              validation: [
                {
                  type: 'required',
                  message: 'VAT number is required for non-US business addresses',
                },
              ],
              status: {
                hidden: '{{not (and (eq addressType "business") (ne country "US"))}}',
              },
              layout: {
                width: 'half',
              },
            },
            {
              id: 'attentionTo',
              type: 'text',
              label: 'Attention To',
              description: 'Recipient name for mailing addresses',
              validation: [
                {
                  type: 'required',
                  message: 'Attention to is required for mailing addresses',
                },
              ],
              status: {
                hidden: '{{not (eq addressType "mailing")}}',
              },
            },
          ],
        },
        // Repeatable block that references address-block; filled from caseContext.addresses at load
        {
          id: 'addresses-block',
          title: 'Addresses',
          description: 'Add multiple addresses. Click a summary to edit — type and country control which fields appear.',
          repeatable: true,
          repeatablePopin: true,
          repeatableSummaryTemplate:
            '{{#if street}}{{street}}{{#if city}}, {{city}}{{/if}}{{#if addressType}} ({{addressType}}){{/if}}{{else}}New address{{/if}}',
          repeatableBlockRef: 'address-block',
          minInstances: 1,
          maxInstances: 5,
          repeatableDefaultSource: 'addresses',
          fields: [],
        },
        {
          id: 'signatory-block',
          title: 'Authorized Signatory',
          description: 'A single authorized signatory. Hidden status depends on Entity Type and Country on the main form. Default values map caseContext.signatories with @index.',
          includeInMainValidation: false,
          status: {
            hidden: 'true',
          },
          layout: {
            mode: 'grid',
            columns: 2,
            gap: 'md',
          },
          fields: [
            {
              id: 'signatoryName',
              type: 'text',
              label: 'Signatory Name',
              description: 'Legal name of the authorized signatory',
              defaultValue: '{{caseContext.signatories.@index.name}}',
              validation: [
                {
                  type: 'required',
                  message: 'Signatory name is required',
                },
              ],
            },
            {
              id: 'signatoryRole',
              type: 'dropdown',
              label: 'Role',
              description: 'Options change with Entity Type on the main form',
              defaultValue: '{{caseContext.signatories.@index.role}}',
              items:
                '{{#if (eq entityType "individual")}}' +
                '[{"label":"Self","value":"self"},{"label":"Attorney","value":"attorney"}]' +
                '{{else}}' +
                '[{"label":"Director","value":"director"},{"label":"Officer","value":"officer"},{"label":"UBO","value":"ubo"}]' +
                '{{/if}}',
              validation: [
                {
                  type: 'required',
                  message: 'Role is required',
                },
              ],
              layout: {
                width: 'half',
              },
            },
            {
              id: 'signatoryEmail',
              type: 'text',
              label: 'Signatory Email',
              description: 'Seeded from caseContext.signatories via @index; new rows use /api/demo/signatory-load',
              defaultValue: '{{caseContext.signatories.@index.email}}',
              validation: [
                {
                  type: 'required',
                  message: 'Signatory email is required',
                },
                {
                  type: 'pattern',
                  value: '^[^@]+@[^@]+\\.[^@]+$',
                  message: 'Please enter a valid email address',
                },
              ],
              layout: {
                width: 'half',
              },
            },
            {
              id: 'signatoryTitle',
              type: 'text',
              label: 'Job Title',
              description: 'Visible when Entity Type is Corporation',
              defaultValue: '{{caseContext.signatories.@index.title}}',
              validation: [
                {
                  type: 'required',
                  message: 'Job title is required for corporate signatories',
                },
              ],
              status: {
                hidden: '{{not (eq entityType "corporation")}}',
              },
            },
            {
              id: 'ownershipPercent',
              type: 'number',
              label: 'Ownership Percent',
              description: 'Visible when Entity Type is Corporation',
              defaultValue: '{{caseContext.signatories.@index.ownership}}',
              validation: [
                {
                  type: 'required',
                  message: 'Ownership percent is required for corporate signatories',
                },
              ],
              status: {
                hidden: '{{not (eq entityType "corporation")}}',
              },
              layout: {
                width: 'half',
              },
            },
            {
              id: 'ssn',
              type: 'text',
              label: 'SSN',
              description: 'Visible when Country on the main form is United States',
              defaultValue: '{{caseContext.signatories.@index.ssn}}',
              validation: [
                {
                  type: 'required',
                  message: 'SSN is required for US cases',
                },
              ],
              status: {
                hidden: '{{not (eq country "US")}}',
              },
              layout: {
                width: 'half',
              },
            },
            {
              id: 'nationalId',
              type: 'text',
              label: 'National ID',
              description: 'Visible when Country on the main form is not United States',
              defaultValue: '{{caseContext.signatories.@index.nationalId}}',
              validation: [
                {
                  type: 'required',
                  message: 'National ID is required for non-US cases',
                },
              ],
              status: {
                hidden: '{{eq country "US"}}',
              },
            },
          ],
        },
        {
          id: 'signatories-block',
          title: 'Authorized Signatories',
          description:
            'Existing rows are seeded from caseContext.signatories via @index defaultValues. Hidden fields follow Entity Type and Country on the main form. New rows are filled from /api/demo/signatory-load.',
          repeatable: true,
          repeatablePopin: true,
          repeatableSummaryTemplate:
            '{{#if signatoryName}}{{signatoryName}}{{#if signatoryRole}} ({{signatoryRole}}){{/if}}{{else}}New signatory{{/if}}',
          repeatableBlockRef: 'signatory-block',
          repeatableDefaultSource: 'signatories',
          minInstances: 0,
          maxInstances: 5,
          popinLoad: {
            url: '/api/demo/signatory-load?entityType={{entityType}}&country={{country}}',
          },
          fields: [],
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
          id: 'parent-companies-block',
          title: 'Parent Companies',
          description: 'Add parent companies; click a summary to edit details in a popin.',
          status: {
            hidden: '{{not (eq entityType "corporation")}}',
          },
          repeatable: true,
          repeatablePopin: true,
          repeatableSummaryTemplate: '{{#if name}}{{name}} ({{registrationNumber}}){{else}}New parent company{{/if}}',
          layout: {
            mode: 'grid',
            columns: 2,
            gap: 'md',
          },
          fields: [
            {
              id: 'parentCompanies.selector',
              type: 'autocomplete',
              label: 'Parent Company',
              description: 'Search and select an existing parent company to auto-fill this row.',
              repeatableGroupId: 'parentCompanies',
              dataSource: {
                url: '/api/data-sources/parent-companies',
                itemsTemplate: '{"label":"{{item.name}} ({{item.registrationNumber}})","value":"{{item.id}}"}',
              },
              validation: [],
              autoFill: {
                mappings: [
                  { from: 'name', to: 'name' },
                  { from: 'registrationNumber', to: 'registrationNumber' },
                  { from: 'address.line1', to: 'address.line1' },
                  { from: 'address.city', to: 'address.city' },
                  { from: 'address.country', to: 'address.country' },
                ],
                overwrite: true,
              },
              layout: {
                width: 'half',
              },
            },
            {
              id: 'parentCompanies.name',
              type: 'text',
              label: 'Parent Company Name',
              description: 'Name of the selected parent company (row-specific).',
              repeatableGroupId: 'parentCompanies',
              validation: [],
              layout: {
                width: 'half',
              },
            },
            {
              id: 'parentCompanies.registrationNumber',
              type: 'text',
              label: 'Registration Number',
              description: 'Registration number of the selected parent company.',
              repeatableGroupId: 'parentCompanies',
              validation: [],
              layout: {
                width: 'half',
              },
            },
            {
              id: 'parentCompanies.address.line1',
              type: 'text',
              label: 'Address Line 1',
              description: 'Street address of the parent company.',
              repeatableGroupId: 'parentCompanies',
              validation: [],
              layout: {
                width: 'half',
              },
            },
            {
              id: 'parentCompanies.address.city',
              type: 'text',
              label: 'City',
              description: 'City of the parent company.',
              repeatableGroupId: 'parentCompanies',
              validation: [],
              layout: {
                width: 'half',
              },
            },
            {
              id: 'parentCompanies.address.country',
              type: 'text',
              label: 'Country',
              description: 'Country of the parent company.',
              repeatableGroupId: 'parentCompanies',
              validation: [],
              layout: {
                width: 'half',
              },
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
          layout: {
            mode: 'grid',
            columns: 2,
            gap: 'md',
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
              layout: {
                width: 'half',
              },
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
              layout: {
                width: 'half',
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
              layout: {
                width: 'half',
                groupId: 'idDocuments',
                groupRole: 'leftStack',
              },
            },
            {
              id: 'passportIssuingCountry',
              type: 'text',
              label: 'Passport Issuing Country',
              description: 'Country that issued the passport',
              validation: [],
              layout: {
                width: 'half',
                groupId: 'idDocuments',
                groupRole: 'right',
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
          id: 'document-card-demo',
          title: 'Document card (upload popin)',
          description:
            'Opens uploads in a dialog so session state survives form remounts when rules or context change. Uses demo POST /api/upload.',
          fields: [
            {
              id: 'demo_proof_of_identity',
              type: 'document',
              label: 'Proof of identity',
              description:
                'Click **Manage uploads** to open the popin. Choose PDF or images; **Validate** commits files to the form (demo stores data URLs).',
              validation: [],
              document: {
                docType: 'demo_proof_of_identity',
                category: 'uploadableByProspect',
                layout: 'single',
                requestedDefault: true,
                allowOptional: true,
                allowComment: true,
                allowClientConfirmation: true,
                allowFrontOfficeName: true,
                file: {
                  acceptedFormats: ['application/pdf', 'image/png', 'image/jpeg'],
                  maxSizeBytes: 5 * 1024 * 1024,
                  multiple: true,
                  uploadUrl: '/api/upload',
                },
              },
            },
          ],
        },
        {
          id: 'additional-info',
          title: 'Additional Information',
          description: 'Optional additional details',
          layout: {
            mode: 'grid',
            columns: 2,
            gap: 'md',
          },
          fields: [
            {
              id: 'newsletter',
              type: 'checkbox',
              label: 'Subscribe to newsletter',
              description: 'Receive updates via email (default from caseContext if available)',
              defaultValue: '{{#if caseContext.newsletter}}true{{else}}false{{/if}}',
              validation: [],
              layout: {
                width: 'half',
              },
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
              status: {
                disabled: '{{not newsletter}}',
              },
              layout: {
                width: 'half',
              },
            },
            {
              id: 'documents',
              type: 'file',
              label: 'Supporting Documents',
              description: 'Upload any supporting documents (default URL from caseContext if available)',
              defaultValue: '{{caseContext.documentUrl}}',
              validation: [],
              layout: {
                width: 'half',
                groupId: 'attachmentsRow',
              },
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
              layout: {
                width: 'half',
                groupId: 'attachmentsRow',
              },
            },
          ],
        },
        // Non-repeatable emergency contact block (referenced by repeatable block)
        {
          id: 'emergency-contact-block',
          title: 'Emergency Contact',
          description: 'A single emergency contact entry',
          fields: [
            {
              id: 'emergencyName',
              type: 'text',
              label: 'Full Name',
              description: 'Full name of the emergency contact',
              validation: [
                {
                  type: 'required',
                  message: 'Emergency contact name is required',
                },
              ],
            },
            {
              id: 'emergencyRelationship',
              type: 'dropdown',
              label: 'Relationship',
              description: 'Relationship to the contact. Template items demo: varies by entityType.',
              items:
                '{{#if (eq entityType "individual")}}' +
                '[{"label":"Spouse","value":"spouse"},{"label":"Parent","value":"parent"},{"label":"Friend","value":"friend"}]' +
                '{{else}}' +
                '[{"label":"Director","value":"director"},{"label":"Officer","value":"officer"},{"label":"Shareholder","value":"shareholder"}]' +
                '{{/if}}',
              validation: [
                {
                  type: 'required',
                  message: 'Relationship is required',
                },
              ],
            },
            {
              id: 'emergencyPhone',
              type: 'text',
              label: 'Phone Number',
              description: 'Phone number for emergency contact',
              validation: [
                {
                  type: 'required',
                  message: 'Emergency contact phone is required',
                },
                {
                  type: 'pattern',
                  value: /^[\d\s\-\+\(\)]+$/,
                  message: 'Invalid phone number format',
                },
              ],
            },
          ],
        },
        // Popin block - standalone, never renders inline
        // This popin contains both regular fields and a repeatable group
        {
          id: 'contact-info',
          title: 'Contact Information',
          description: 'Additional contact details (opens in popin dialog)',
          popin: true,
          includeInMainValidation: false,
          repeatable: true, // Enable repeatable groups in this popin
          layout: {
            mode: 'grid',
            columns: 2,
            gap: 'md',
          },
          // Load existing contact details when the popin opens
          popinLoad: {
            url: '/api/popin-demo/contact-load',
          },
          // Submit contact details to demo endpoint when Validate is clicked
          popinSubmit: {
            url: '/api/popin-demo/contact-submit',
            method: 'POST',
            // Include emergency contacts in payload
            // - Use whitespace control {{~json ...~}} to prevent parse errors with closing braces
            // - Provide fallback "[]" so payload stays valid JSON when group is empty/undefined
            // - Use lookup helper to access 'emergency-contacts' (with hyphen) to match the repeatableGroupId
            payloadTemplate: '{"contactEmail":"{{formData.contactEmail}}","contactPhone":"{{formData.contactPhone}}","contactAlternateEmail":"{{formData.contactAlternateEmail}}","emergencyContacts":{{~json (lookup formData "emergency-contacts") "[]"~}}}',
          },
          fields: [
            // Regular fields (no repeatableGroupId) — laid out in a 2-column grid
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
              layout: { width: 'half' },
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
              layout: { width: 'half' },
            },
            {
              id: 'contactAlternateEmail',
              type: 'text',
              label: 'Alternate Email',
              description: 'Optional alternate email address',
              validation: [],
            },
            // Repeatable emergency contact fields — 2-column grid inside each instance
            {
              id: 'emergency-contacts.emergencyName',
              type: 'text',
              label: 'Full Name',
              description: 'Full name of the emergency contact',
              repeatableGroupId: 'emergency-contacts',
              validation: [
                {
                  type: 'required',
                  message: 'Emergency contact name is required',
                },
              ],
            },
            {
              id: 'emergency-contacts.emergencyRelationship',
              type: 'dropdown',
              label: 'Relationship',
              description: 'Relationship to the contact',
              repeatableGroupId: 'emergency-contacts',
              items: [
                { label: 'Spouse', value: 'spouse' },
                { label: 'Parent', value: 'parent' },
                { label: 'Sibling', value: 'sibling' },
                { label: 'Child', value: 'child' },
                { label: 'Friend', value: 'friend' },
                { label: 'Colleague', value: 'colleague' },
                { label: 'Other', value: 'other' },
              ],
              validation: [
                {
                  type: 'required',
                  message: 'Relationship is required',
                },
              ],
              layout: { width: 'half' },
            },
            {
              id: 'emergency-contacts.emergencyPhone',
              type: 'text',
              label: 'Phone Number',
              description: 'Phone number for emergency contact',
              repeatableGroupId: 'emergency-contacts',
              validation: [
                {
                  type: 'required',
                  message: 'Emergency contact phone is required',
                },
                {
                  type: 'pattern',
                  value: /^[\d\s\-\+\(\)]+$/,
                  message: 'Invalid phone number format',
                },
              ],
              layout: { width: 'half' },
            },
          ],
          minInstances: 0, // Minimum emergency contacts (0 = optional)
          maxInstances: 5, // Maximum emergency contacts
        },
      ],
      queryInvalidation: {
        'contact-info': [
          ['case'],
          ['form', 'data-source'],
        ],
        'addresses-block': [['case']],
        'signatories-block': [['case']],
      },
      submission: {
        url: '/api/submit',
        method: 'POST',
      },
      draft: {
        url: '/api/form/draft',
        method: 'PUT',
        debounceMs: 1000,
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
