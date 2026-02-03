/**
 * Form Validate API Route
 * 
 * POST /api/form/validate
 * Accepts caseId and formValues, performs comprehensive validation against
 * rehydrated rules and data sources, and returns field-level errors.
 */

import { NextResponse } from 'next/server';
import type { FormData, GlobalFormDescriptor, CaseContext, RulesObject } from '@/types/form-descriptor';
import { GET as getGlobalDescriptor } from '../global-descriptor/route';
import { POST as rehydrateRules } from '../../rules/context/route';
import { identifyDiscriminantFields, updateCaseContext } from '@/utils/context-extractor';
import { mergeDescriptorWithRules } from '@/utils/descriptor-merger';
import { validateFormValues } from '@/utils/form-validator';

/**
 * Request body format
 */
interface ValidateRequest {
  caseId: string;
  formValues: Partial<FormData>;
}

/**
 * Response format
 */
interface ValidateResponse {
  errors: Array<{
    field: string;
    message: string;
    code?: string;
  }>;
}

/**
 * Error response format
 */
interface ErrorResponse {
  error: string;
}

/**
 * POST handler for form validation
 * 
 * @param request - Next.js Request object with ValidateRequest in body
 * @returns Response with ValidateResponse or ErrorResponse
 */
export async function POST(
  request: Request
): Promise<NextResponse<ValidateResponse | ErrorResponse>> {
  try {
    // Only allow POST method
    if (request.method !== 'POST') {
      return NextResponse.json(
        { error: 'Method not allowed' },
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    let validateRequest: ValidateRequest;
    try {
      const body = await request.json();
      
      // Validate that body is an object
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return NextResponse.json(
          { error: 'Invalid request body. Expected object with caseId and formValues.' },
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Validate required fields
      if (!body.caseId || typeof body.caseId !== 'string') {
        return NextResponse.json(
          { error: 'Invalid request body. caseId is required and must be a string.' },
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      if (!body.formValues || typeof body.formValues !== 'object' || Array.isArray(body.formValues)) {
        return NextResponse.json(
          { error: 'Invalid request body. formValues is required and must be an object.' },
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      validateRequest = {
        caseId: body.caseId,
        formValues: body.formValues as Partial<FormData>,
      };
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

    // Fetch global form descriptor
    const descriptorRequest = new Request('http://localhost/api/form/global-descriptor', {
      method: 'GET',
    });
    const descriptorResponse = await getGlobalDescriptor(descriptorRequest);
    
    if (!descriptorResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch global form descriptor' },
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const globalDescriptor: GlobalFormDescriptor = await descriptorResponse.json();

    // Extract case context from discriminant fields
    const allFields = globalDescriptor.blocks.flatMap(block => block.fields);
    const discriminantFields = allFields.filter(field => field.isDiscriminant === true);
    const caseContext: CaseContext = updateCaseContext({}, validateRequest.formValues, discriminantFields);

    // Rehydrate validation rules
    const rulesRequest = new Request('http://localhost/api/rules/context', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(caseContext),
    });
    const rulesResponse = await rehydrateRules(rulesRequest);
    
    if (!rulesResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to rehydrate validation rules' },
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const rulesObject: RulesObject = await rulesResponse.json();

    // Merge global descriptor with rules to create merged descriptor
    const mergedDescriptor = mergeDescriptorWithRules(globalDescriptor, rulesObject);

    // Validate form values against merged descriptor
    const errors = await validateFormValues(mergedDescriptor, validateRequest.formValues);

    // Return validation response
    return NextResponse.json(
      { errors },
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    // Handle unexpected errors
    console.error('Error validating form:', error);

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
