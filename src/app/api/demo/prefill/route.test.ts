/**
 * Tests for demo prefill API route.
 */

import { describe, test, expect } from 'vitest';
import { GET } from './route';

describe('GET /api/demo/prefill', () => {
  test('given the demo prefill, should include signatories with backend keys for @index mapping', async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.casePrefill.signatories).toEqual([
      {
        name: 'Ada Lovelace',
        role: 'director',
        email: 'ada.lovelace@example.com',
        title: 'Managing Director',
        ownership: 40,
        ssn: '123-45-6789',
        powerOfAttorney: 'POA-1843-ADA',
      },
      {
        name: 'Alan Turing',
        role: 'officer',
        email: 'alan.turing@example.com',
        title: 'CTO',
        ownership: 15,
        nationalId: 'AB123456C',
        powerOfAttorney: 'POA-1912-ALAN',
      },
    ]);
  });

  test('given the demo prefill, should include business sectors whose holding row carries subsectors', async () => {
    const response = await GET();
    const body = await response.json();

    const holding = body.casePrefill.businessSectors.find(
      (row: { sector: string }) => row.sector === 'holding'
    );
    expect(holding.subsectors.length).toBeGreaterThan(0);
    expect(holding.subsectors[0]).toEqual({ sector: expect.any(String), percentage: expect.any(Number) });
  });
});
