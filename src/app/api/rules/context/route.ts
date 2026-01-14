/**
 * Rules Context API Route
 * 
 * POST /api/rules/context
 * Accepts CaseContext and returns RulesObject with updated validation rules
 * and status conditions for form re-hydration.
 */

import { NextResponse } from 'next/server';
import type { CaseContext, RulesObject } from '@/types/form-descriptor';

/**
 * Validation error format
 */
interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

/**
 * Error response format
 */
interface ErrorResponse {
  error: string;
  errors?: ValidationError[];
}

/**
 * POST handler for rules re-hydration
 * 
 * @param request - Next.js Request object with CaseContext in body
 * @returns Response with RulesObject or error response
 */
export async function POST(
  request: Request
): Promise<NextResponse<RulesObject | ErrorResponse>> {
  try {
    // Only allow POST method
    if (request.method !== 'POST') {
      return NextResponse.json(
        { error: 'Method not allowed' },
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    let caseContext: CaseContext;
    try {
      const body = await request.json();
      
      // Validate that body is an object
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return NextResponse.json(
          { error: 'Invalid request body. Expected CaseContext object.' },
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      caseContext = body as CaseContext;
    } catch (error) {
      // JSON parsing error
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate CaseContext structure
    // CaseContext allows dynamic properties, but we should validate basic structure
    const validationErrors: ValidationError[] = [];

    // Validate that all values are of allowed types
    for (const [key, value] of Object.entries(caseContext)) {
      if (
        value !== null &&
        value !== undefined &&
        typeof value !== 'string' &&
        typeof value !== 'number' &&
        typeof value !== 'boolean' &&
        !Array.isArray(value)
      ) {
        validationErrors.push({
          field: key,
          message: `Invalid type for field '${key}'. Expected string, number, boolean, array, null, or undefined.`,
          code: 'INVALID_TYPE',
        });
      }

      // If it's an array, validate all elements are strings
      if (Array.isArray(value)) {
        const invalidElements = value.filter(
          (item) => typeof item !== 'string'
        );
        if (invalidElements.length > 0) {
          validationErrors.push({
            field: key,
            message: `Array field '${key}' must contain only string values.`,
            code: 'INVALID_ARRAY_ELEMENT',
          });
        }
      }
    }

    // If validation errors exist, return them
    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          errors: validationErrors,
        },
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Evaluate rules based on CaseContext
    // This demonstrates how rules change based on entity type and jurisdiction
    const rulesObject: RulesObject = {
      blocks: [],
      fields: [],
    };

    // Add entity-type specific validation rules
    if (caseContext.entityType === 'corporation') {
      rulesObject.fields = [
        ...(rulesObject.fields || []),
        {
          id: 'corporationName',
          validation: [
            {
              type: 'required',
              message: 'Corporation name is required',
            },
            {
              type: 'minLength',
              value: 3,
              message: 'Corporation name must be at least 3 characters',
            },
          ],
        },
        {
          id: 'taxId',
          validation: [
            {
              type: 'required',
              message: 'Tax ID is required for corporations',
            },
            {
              type: 'pattern',
              value: '^\\d{2}-\\d{7}$' as unknown as RegExp,
              message: 'Tax ID must be in format XX-XXXXXXX',
            },
          ],
        },
      ];
    }

    if (caseContext.entityType === 'individual') {
      rulesObject.fields = [
        ...(rulesObject.fields || []),
        {
          id: 'dateOfBirth',
          validation: [
            {
              type: 'required',
              message: 'Date of birth is required for individuals',
            },
          ],
        },
      ];

      // US-specific rules for individuals
      if (caseContext.country === 'US') {
        rulesObject.fields = [
          ...(rulesObject.fields || []),
          {
            id: 'ssn',
            validation: [
              {
                type: 'required',
                message: 'SSN is required for US individuals',
              },
              {
                type: 'pattern',
                value: '^\\d{3}-\\d{2}-\\d{4}$' as unknown as RegExp,
                message: 'SSN must be in format XXX-XX-XXXX',
              },
            ],
          },
        ];
      }

      // Non-US rules for individuals
      if (caseContext.country && caseContext.country !== 'US') {
        rulesObject.fields = [
          ...(rulesObject.fields || []),
          {
            id: 'passportNumber',
            validation: [
              {
                type: 'required',
                message: 'Passport number is required for non-US individuals',
              },
              {
                type: 'minLength',
                value: 6,
                message: 'Passport number must be at least 6 characters',
              },
            ],
          },
        ];
      }
    }

    // Country-specific validation rules
    if (caseContext.country === 'US') {
      rulesObject.fields = [
        ...(rulesObject.fields || []),
        {
          id: 'phone',
          validation: [
            {
              type: 'required',
              message: 'Phone number is required',
            },
            {
              type: 'pattern',
              value: '^\\(\\d{3}\\) \\d{3}-\\d{4}$' as unknown as RegExp,
              message: 'Phone number must be in format (XXX) XXX-XXXX',
            },
          ],
        },
      ];
    }

    if (caseContext.country === 'CA') {
      rulesObject.fields = [
        ...(rulesObject.fields || []),
        {
          id: 'phone',
          validation: [
            {
              type: 'required',
              message: 'Phone number is required',
            },
            {
              type: 'pattern',
              value: '^\\d{3}-\\d{3}-\\d{4}$' as unknown as RegExp,
              message: 'Phone number must be in format XXX-XXX-XXXX',
            },
          ],
        },
      ];
    }

    // Update status conditions based on context
    if (caseContext.entityType) {
      rulesObject.blocks = [
        ...(rulesObject.blocks || []),
        {
          id: 'corporation-details',
          status: {
            hidden: caseContext.entityType !== 'corporation' ? 'true' : 'false',
          },
        },
        {
          id: 'individual-details',
          status: {
            hidden: caseContext.entityType !== 'individual' ? 'true' : 'false',
          },
        },
        {
          id: 'partnership-details',
          status: {
            hidden: caseContext.entityType !== 'partnership' ? 'true' : 'false',
          },
        },
        {
          id: 'trust-details',
          status: {
            hidden: caseContext.entityType !== 'trust' ? 'true' : 'false',
          },
        },
      ];
    }

    return NextResponse.json(rulesObject, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    // Handle unexpected errors
    console.error('Error processing rules context:', error);

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
