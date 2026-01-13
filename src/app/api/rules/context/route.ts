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

    // TODO: In production, evaluate rules based on CaseContext
    // This would involve:
    // 1. Querying rules database/service based on context values
    // 2. Evaluating which rules apply based on jurisdiction, entity type, etc.
    // 3. Returning updated validation rules and status conditions
    // For now, return a mock RulesObject
    const rulesObject: RulesObject = {
      blocks: [],
      fields: [],
    };

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
