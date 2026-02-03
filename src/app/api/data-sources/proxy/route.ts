/**
 * Data Source Proxy API Route
 * 
 * POST /api/data-sources/proxy
 * Proxies data source API calls with secure authentication credentials.
 * Keeps auth secrets server-side while maintaining declarative descriptors.
 */

import { NextResponse } from 'next/server';
import type { FormContext } from '@/utils/template-evaluator';
import { getDataSourceCredentials } from '@/utils/data-source-credentials';
import { evaluateTemplate } from '@/utils/template-evaluator';
import { transformResponse } from '@/utils/response-transformer';
import type { DataSourceConfig, FieldItem } from '@/types/form-descriptor';

/**
 * Request body format
 */
interface ProxyRequest {
  fieldId: string;
  dataSourceId: string;
  urlTemplate: string;
  itemsTemplate: string;
  formContext: FormContext;
}

/**
 * Response format
 */
interface ProxyResponse {
  items: FieldItem[];
}

/**
 * Error response format
 */
interface ErrorResponse {
  error: string;
}

/**
 * POST handler for data source proxy
 * 
 * @param request - Next.js Request object with ProxyRequest in body
 * @returns Response with ProxyResponse or ErrorResponse
 */
export async function POST(
  request: Request
): Promise<NextResponse<ProxyResponse | ErrorResponse>> {
  try {
    // Only allow POST method
    if (request.method !== 'POST') {
      return NextResponse.json(
        { error: 'Method not allowed' },
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    let proxyRequest: ProxyRequest;
    try {
      const body = await request.json();
      
      // Validate that body is an object
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return NextResponse.json(
          { error: 'Invalid request body. Expected object with fieldId, dataSourceId, urlTemplate, itemsTemplate, and formContext.' },
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

      if (!body.itemsTemplate || typeof body.itemsTemplate !== 'string') {
        return NextResponse.json(
          { error: 'Invalid request body. itemsTemplate is required and must be a string.' },
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

      proxyRequest = {
        fieldId: body.fieldId || '',
        dataSourceId: body.dataSourceId,
        urlTemplate: body.urlTemplate,
        itemsTemplate: body.itemsTemplate,
        formContext: body.formContext as FormContext,
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

    // Look up authentication credentials for the data source
    const authConfig = await getDataSourceCredentials(proxyRequest.dataSourceId);
    
    if (!authConfig) {
      return NextResponse.json(
        { error: `Data source configuration is incomplete: credentials not found for dataSourceId "${proxyRequest.dataSourceId}"` },
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Evaluate URL template server-side using formContext
    const url = evaluateTemplate(proxyRequest.urlTemplate, proxyRequest.formContext);

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
        { error: `Failed to load data source: ${response.status} ${response.statusText}` },
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const data = await response.json();

    // Transform response using itemsTemplate
    const dataSourceConfig: DataSourceConfig = {
      url: proxyRequest.urlTemplate,
      itemsTemplate: proxyRequest.itemsTemplate,
    };

    const items = transformResponse(data, dataSourceConfig, proxyRequest.formContext);

    // Return transformed items to frontend
    return NextResponse.json(
      { items },
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    // Handle unexpected errors
    console.error('Error proxying data source:', error);

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
