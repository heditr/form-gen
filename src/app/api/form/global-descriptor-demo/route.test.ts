/**
 * Tests for demo global descriptor — authorized signatories repeatable popin.
 */

import { describe, test, expect } from 'vitest';
import { GET } from './route';

describe('GET /api/form/global-descriptor-demo', () => {
  test('given the demo descriptor, should include a signatories popin whose hidden fields depend on main-form values', async () => {
    const response = await GET(new Request('http://localhost:3000/api/form/global-descriptor-demo'));
    const descriptor = await response.json();

    expect(response.status).toBe(200);

    const signatoriesBlock = descriptor.blocks.find(
      (block: { id: string }) => block.id === 'signatories-block'
    );
    expect(signatoriesBlock?.repeatablePopin).toBe(true);
    expect(signatoriesBlock?.popinLoad?.url).toBe(
      '/api/demo/signatory-load?entityType={{entityType}}&country={{country}}'
    );

    const fieldById = Object.fromEntries(
      (signatoriesBlock?.fields ?? []).map((field: { id: string }) => [field.id, field])
    );

    expect(fieldById['signatories.signatoryTitle']?.status?.hidden).toBe(
      '{{not (eq entityType "corporation")}}'
    );
    expect(fieldById['signatories.ownershipPercent']?.status?.hidden).toBe(
      '{{not (eq entityType "corporation")}}'
    );
    expect(fieldById['signatories.ssn']?.status?.hidden).toBe('{{not (eq country "US")}}');
    expect(fieldById['signatories.nationalId']?.status?.hidden).toBe('{{eq country "US"}}');
  });
});
