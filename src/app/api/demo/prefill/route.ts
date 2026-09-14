/**
 * Demo Prefill API Route
 *
 * GET /api/demo/prefill
 * Returns case prefill (CasePrefill) including an addresses array. The descriptor
 * uses repeatableDefaultSource: 'addresses' so the repeatable Addresses block is
 * filled from caseContext.addresses at initial page load via Handlebars/defaults.
 */

import { NextResponse } from 'next/server';
import type { CasePrefill } from '@/types/form-descriptor';

/** Response: case prefill for initial page load; addresses fill the repeatable block via repeatableDefaultSource */
interface DemoPrefillResponse {
  casePrefill: CasePrefill;
}

export async function GET(): Promise<NextResponse<DemoPrefillResponse | { error: string }>> {
  try {
    const casePrefill: CasePrefill = {
      incorporationCountry: 'US',
      processType: 'standard',
      needSignature: true,
      addresses: [
        {
          addressType: 'residential',
          country: 'US',
          state: 'NY',
          street: '123 Main St',
          city: 'New York',
          zip: '10001',
        },
        {
          addressType: 'business',
          country: 'US',
          state: 'CA',
          street: '1 Infinite Loop',
          city: 'Cupertino',
          zip: '95014',
          companyName: 'Acme Holdings',
        },
        {
          addressType: 'business',
          country: 'UK',
          street: '10 Downing St',
          city: 'London',
          zip: 'SW1A 2AA',
          companyName: 'Acme UK Ltd',
          vatNumber: 'GB123456789',
        },
        {
          addressType: 'mailing',
          country: 'FR',
          street: '10 Rue de Rivoli',
          city: 'Paris',
          zip: '75001',
          attentionTo: 'KYC Operations',
        },
      ],
    };

    return NextResponse.json({ casePrefill }, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Demo prefill error:', error);
    return NextResponse.json(
      { error: 'Failed to load demo prefill' },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
