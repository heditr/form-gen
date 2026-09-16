/**
 * Tests for demo global descriptor — authorized signatories repeatable popin.
 */

import { describe, test, expect } from 'vitest';
import { GET } from './route';
import { extractDefaultValues } from '@/utils/form-descriptor-integration';
import type { GlobalFormDescriptor } from '@/types/form-descriptor';

describe('GET /api/form/global-descriptor-demo', () => {
  test('given the demo descriptor, should include a signatories popin whose hidden fields depend on main-form values', async () => {
    const response = await GET(new Request('http://localhost:3000/api/form/global-descriptor-demo'));
    const descriptor = await response.json();

    expect(response.status).toBe(200);

    const signatoriesBlock = descriptor.blocks.find(
      (block: { id: string }) => block.id === 'signatories-block'
    );
    expect(signatoriesBlock?.repeatablePopin).toBe(true);
    expect(signatoriesBlock?.repeatableDefaultSource).toBe('signatories');
    expect(signatoriesBlock?.popinLoad?.url).toBe(
      '/api/demo/signatory-load?entityType={{entityType}}&country={{country}}'
    );

    const fieldById = Object.fromEntries(
      (signatoriesBlock?.fields ?? []).map((field: { id: string }) => [field.id, field])
    );

    expect(fieldById['signatories.signatoryName']?.defaultValue).toBe(
      '{{caseContext.signatories.@index.name}}'
    );
    expect(fieldById['signatories.signatoryRole']?.defaultValue).toBe(
      '{{caseContext.signatories.@index.role}}'
    );
    expect(fieldById['signatories.signatoryEmail']?.defaultValue).toBe(
      '{{caseContext.signatories.@index.email}}'
    );
    expect(fieldById['signatories.signatoryTitle']?.defaultValue).toBe(
      '{{caseContext.signatories.@index.title}}'
    );
    expect(fieldById['signatories.ownershipPercent']?.defaultValue).toBe(
      '{{caseContext.signatories.@index.ownership}}'
    );
    expect(fieldById['signatories.ssn']?.defaultValue).toBe(
      '{{caseContext.signatories.@index.ssn}}'
    );
    expect(fieldById['signatories.nationalId']?.defaultValue).toBe(
      '{{caseContext.signatories.@index.nationalId}}'
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

  test('given backend signatories with unmapped keys, should seed rows via @index defaultValues', async () => {
    const response = await GET(new Request('http://localhost:3000/api/form/global-descriptor-demo'));
    const descriptor = (await response.json()) as GlobalFormDescriptor;

    const defaultValues = extractDefaultValues(descriptor, {
      caseContext: {
        signatories: [
          {
            name: 'Ada Lovelace',
            role: 'director',
            email: 'ada.lovelace@example.com',
            title: 'Managing Director',
            ownership: 40,
            ssn: '123-45-6789',
          },
          {
            name: 'Alan Turing',
            role: 'officer',
            email: 'alan.turing@example.com',
            title: 'CTO',
            ownership: 15,
            nationalId: 'AB123456C',
          },
        ],
      },
    });

    expect(defaultValues.signatories).toEqual([
      {
        signatoryName: 'Ada Lovelace',
        signatoryRole: 'director',
        signatoryEmail: 'ada.lovelace@example.com',
        signatoryTitle: 'Managing Director',
        ownershipPercent: 40,
        ssn: '123-45-6789',
        nationalId: '',
      },
      {
        signatoryName: 'Alan Turing',
        signatoryRole: 'officer',
        signatoryEmail: 'alan.turing@example.com',
        signatoryTitle: 'CTO',
        ownershipPercent: 15,
        ssn: '',
        nationalId: 'AB123456C',
      },
    ]);
  });
});
