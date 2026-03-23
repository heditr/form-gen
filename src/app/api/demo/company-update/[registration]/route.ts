import { NextResponse } from 'next/server';

interface UpdateRequestBody {
  companyName?: string;
}

interface UpdateResponse {
  ok: boolean;
  registration: string;
  companyName: string;
}

interface UpdateErrorResponse {
  error: string;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ registration: string }> }
): Promise<NextResponse<UpdateResponse | UpdateErrorResponse>> {
  const { registration } = await params;
  const body = (await request.json().catch(() => ({}))) as UpdateRequestBody;
  const companyName = body.companyName?.trim() ?? '';

  if (!registration || !companyName) {
    return NextResponse.json(
      { error: 'registration and companyName are required' },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      registration,
      companyName,
    },
    { status: 200 }
  );
}
