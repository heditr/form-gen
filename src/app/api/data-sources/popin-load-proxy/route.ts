/**
 * Popin Load Proxy API Route
 * 
 * POST /api/data-sources/popin-load-proxy
 * Proxies popin load API calls with secure authentication credentials.
 * Returns object data (not arrays) that gets merged into formContext.
 */

import { NextResponse } from 'next/server';
import type { FormContext } from '@/utils/template-evaluator';
import { getDataSourceCredentials } from '@/utils/data-source-credentials';
import { evaluateTemplate } from '@/utils/template-evaluator';

/**
 * Request body format
 */
interface PopinLoadProxyRequest {
  blockId: string;
  dataSourceId: string;
  urlTemplate: string;
  evaluatedUrl?: string; // Optional pre-evaluated URL (for caching)
  formContext: FormContext;
}

/**
 * Response format (object data, not array)
 */
interface PopinLoadProxyResponse {
  [key: string]: unknown;
}

/**
 * Error response format
 */
interface ErrorResponse {
  error: string;
}

/**
 * POST handler for popin load proxy
 * 
 * @param request - Next.js Request object with PopinLoadProxyRequest in body
 * @returns Response with PopinLoadProxyResponse or ErrorResponse
 */
export async function POST(
  request: Request
): Promise<NextResponse<PopinLoadProxyResponse | ErrorResponse>> {
  try {
    // Only allow POST method
    if (request.method !== 'POST') {
      return NextResponse.json(
        { error: 'Method not allowed' },
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    let proxyRequest: PopinLoadProxyRequest;
    try {
      const body = await request.json();
      
      // Validate that body is an object
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return NextResponse.json(
          { error: 'Invalid request body. Expected object with blockId, dataSourceId, urlTemplate, and formContext.' },
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Validate required fields
      if (!body.dataSourceId || typeof body.dataSourceId !== 'string') {
        return NextResponse.json(
          { error: 'Invalid request body. dataSourceId is required and must be a string.' },
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      if (!body.urlTemplate || typeof body.urlTemplate !== 'string') {
        return NextResponse.json(
          { error: 'Invalid request body. urlTemplate is required and must be a string.' },
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      if (!body.blockId || typeof body.blockId !== 'string') {
        return NextResponse.json(
          { error: 'Invalid request body. blockId is required and must be a string.' },
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      if (!body.formContext || typeof body.formContext !== 'object' || Array.isArray(body.formContext)) {
        return NextResponse.json(
          { error: 'Invalid request body. formContext is required and must be an object.' },
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      proxyRequest = body as PopinLoadProxyRequest;
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Get auth credentials from server-side storage using dataSourceId
    const authConfig = await getDataSourceCredentials(proxyRequest.dataSourceId);
    if (!authConfig) {
      return NextResponse.json(
        { error: `No credentials found for dataSourceId: ${proxyRequest.dataSourceId}` },
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Evaluate URL template (use pre-evaluated if provided, otherwise evaluate)
    const url = proxyRequest.evaluatedUrl || evaluateTemplate(proxyRequest.urlTemplate, proxyRequest.formContext);

    // Build headers with authentication
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (authConfig.type === 'bearer' && authConfig.token) {
      headers['Authorization'] = `Bearer ${authConfig.token}`;
    } else if (authConfig.type === 'apikey' && authConfig.token && authConfig.headerName) {
      headers[authConfig.headerName] = authConfig.token;
    } else if (authConfig.type === 'basic' && authConfig.username && authConfig.password) {
      // Basic authentication: Base64 encode username:password
      const credentials = Buffer.from(`${authConfig.username}:${authConfig.password}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }

    // Make proxied API call to external data source
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to load popin data: ${response.status} ${response.statusText}` },
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const data = await response.json();

    // Validate that response is an object (not an array)
    if (Array.isArray(data)) {
      return NextResponse.json(
        { error: 'Popin load response must be an object, not an array' },
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (typeof data !== 'object' || data === null) {
      return NextResponse.json(
        { error: 'Popin load response must be an object' },
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Return object data as-is (no transformation needed)
    return NextResponse.json(
      data as PopinLoadProxyResponse,
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    // Handle unexpected errors
    console.error('Error proxying popin load:', error);

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
