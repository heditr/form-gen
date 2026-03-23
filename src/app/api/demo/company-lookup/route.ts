import { NextResponse } from 'next/server';

interface LookupSuccessResponse {
  legalName: string;
}

interface LookupErrorResponse {
  code: string;
  message: string;
}

export async function GET(request: Request): Promise<NextResponse<LookupSuccessResponse | LookupErrorResponse>> {
  const { searchParams } = new URL(request.url);
  const registration = searchParams.get('registration')?.trim() ?? '';

  if (registration === 'REG-OK') {
    return NextResponse.json(
      {
        legalName: 'Acme Holdings Ltd',
      },
      { status: 200 }
    );
  }

  if (registration === 'REG-404') {
    return NextResponse.json(
      {
        code: 'COMPANY_NOT_FOUND',
        message: 'Company not found, manual entry allowed.',
      },
      { status: 404 }
    );
  }

  return NextResponse.json(
    {
      code: 'INVALID_LOOKUP_INPUT',
      message: 'Use REG-OK for success or REG-404 for resilient fallback.',
    },
    { status: 400 }
  );
}
