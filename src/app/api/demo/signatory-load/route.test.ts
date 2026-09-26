/**
 * Tests for demo signatory load API route.
 */

import { describe, test, expect } from 'vitest';
import { GET } from './route';

function createMockRequest(query: Record<string, string>): Request {
  const url = new URL('http://localhost:3000/api/demo/signatory-load');
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return new Request(url, { method: 'GET' });
}

describe('GET /api/demo/signatory-load', () => {
  test('given a US corporation, should return director defaults including title and ownership', async () => {
    const response = await GET(createMockRequest({ entityType: 'corporation', country: 'US' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      signatoryRole: 'director',
      signatoryEmail: 'signatory.us@example.com',
      signatoryTitle: 'Managing Director',
      ownershipPercent: 25,
    });
  });

  test('given a French corporation, should return a local title without US defaults', async () => {
    const response = await GET(createMockRequest({ entityType: 'corporation', country: 'FR' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.signatoryRole).toBe('director');
    expect(body.signatoryTitle).toBe('Gérant');
    expect(body.signatoryEmail).toBe('signatory.fr@example.com');
    expect(body.ownershipPercent).toBe(25);
  });

  test('given an individual, should return self role without corporation-only defaults', async () => {
    const response = await GET(createMockRequest({ entityType: 'individual', country: 'FR' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      signatoryRole: 'self',
      signatoryEmail: 'signatory.fr@example.com',
    });
    expect(body.signatoryTitle).toBeUndefined();
    expect(body.ownershipPercent).toBeUndefined();
  });
});
