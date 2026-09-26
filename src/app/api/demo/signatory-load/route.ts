/**
 * Demo Signatory Load API Route
 *
 * GET /api/demo/signatory-load?entityType=&country=
 * Returns suggested values for a new authorized-signatory repeatable popin row.
 * Defaults follow main-form entity type and jurisdiction country.
 */

import { NextResponse } from 'next/server';

interface SignatoryLoadResponse {
  signatoryRole: 'self' | 'director';
  signatoryEmail: string;
  signatoryTitle?: string;
  ownershipPercent?: number;
}

function countryEmail(country: string): string {
  const suffix = country.trim().toLowerCase() || 'us';
  return `signatory.${suffix}@example.com`;
}

function corporationTitle(country: string): string {
  return country === 'FR' ? 'Gérant' : 'Managing Director';
}

export async function GET(
  request: Request
): Promise<NextResponse<SignatoryLoadResponse | { error: string }>> {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType')?.trim() ?? '';
    const country = searchParams.get('country')?.trim() ?? '';

    if (entityType === 'individual') {
      const contact: SignatoryLoadResponse = {
        signatoryRole: 'self',
        signatoryEmail: countryEmail(country),
      };
      return NextResponse.json(contact, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const corporation: SignatoryLoadResponse = {
      signatoryRole: 'director',
      signatoryEmail: countryEmail(country),
      signatoryTitle: corporationTitle(country),
      ownershipPercent: 25,
    };

    return NextResponse.json(corporation, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error loading demo signatory defaults:', error);
    return NextResponse.json(
      { error: 'Failed to load signatory defaults' },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
