/**
 * Tests for schema fingerprint / validation target helpers.
 */

import { describe, test, expect, beforeAll } from 'vitest';
import type { GlobalFormDescriptor } from '@/types/form-descriptor';
import { registerHandlebarsHelpers } from '@/utils/handlebars-helpers';
import {
  collectValidationTargets,
  diffValidationTargets,
  getActiveValidationTargetIds,
  buildFormContextFromValues,
  omitStatusHiddenFormValues,
} from './schema-fingerprint';

describe('schema-fingerprint', () => {
  beforeAll(() => {
    registerHandlebarsHelpers();
  });

  const descriptor: GlobalFormDescriptor = {
    blocks: [
      {
        id: 'block1',
        title: 'Block 1',
        fields: [
          {
            id: 'country',
            type: 'text',
            label: 'Country',
            validation: [],
          },
          {
            id: 'ssn',
            type: 'text',
            label: 'SSN',
            validation: [{ type: 'required' }],
            status: {
              hidden: '{{#if (eq formData.country "US")}}false{{else}}true{{/if}}',
            },
          },
        ],
      },
    ],
    submission: { url: '/api/submit', method: 'POST' },
  };

  test('given formData country US, should include ssn in targets', () => {
    const context = buildFormContextFromValues({ country: 'US' });
    const targets = collectValidationTargets(descriptor, context);
    expect(targets.map((t) => t.id)).toContain('ssn');
  });

  test('given formData country FR, should exclude ssn from targets', () => {
    const context = buildFormContextFromValues({ country: 'FR' });
    const targets = collectValidationTargets(descriptor, context);
    expect(targets.map((t) => t.id)).not.toContain('ssn');
  });

  test('given target diff, should report newly visible and hidden ids', () => {
    const { newlyVisible, newlyHidden } = diffValidationTargets(
      [{ id: 'a', ruleFingerprint: 'none' }],
      [{ id: 'b', ruleFingerprint: 'required:' }]
    );
    expect(newlyVisible).toEqual(['b']);
    expect(newlyHidden).toEqual(['a']);
  });

  test('given caseContext-driven template, getActiveValidationTargetIds should pass caseContext', () => {
    const caseDriven: GlobalFormDescriptor = {
      blocks: [
        {
          id: 'block1',
          title: 'Block 1',
          fields: [
            {
              id: 'taxId',
              type: 'text',
              label: 'Tax ID',
              validation: [],
              status: {
                hidden:
                  '{{#if (eq caseContext.country "US")}}false{{else}}true{{/if}}',
              },
            },
          ],
        },
      ],
      submission: { url: '/api/submit', method: 'POST' },
    };

    const withoutContext = getActiveValidationTargetIds(caseDriven, {});
    expect(withoutContext).not.toContain('taxId');

    const withContext = getActiveValidationTargetIds(
      caseDriven,
      {},
      'main',
      { country: 'US' }
    );
    expect(withContext).toContain('taxId');
  });
});

describe('omitStatusHiddenFormValues', () => {
  beforeAll(() => {
    registerHandlebarsHelpers();
  });

  const createAddressDescriptor = (): GlobalFormDescriptor => ({
    blocks: [
      {
        id: 'addresses-block',
        title: 'Addresses',
        repeatable: true,
        fields: [
          {
            id: 'addresses.addressType',
            type: 'text',
            label: 'Address Type',
            repeatableGroupId: 'addresses',
            validation: [],
          },
          {
            id: 'addresses.country',
            type: 'text',
            label: 'Country',
            repeatableGroupId: 'addresses',
            validation: [],
          },
          {
            id: 'addresses.state',
            type: 'text',
            label: 'State',
            repeatableGroupId: 'addresses',
            validation: [],
            status: { hidden: '{{not (or (eq country "US") (eq country "CA"))}}' },
          },
          {
            id: 'addresses.street',
            type: 'text',
            label: 'Street',
            repeatableGroupId: 'addresses',
            validation: [],
          },
          {
            id: 'addresses.companyName',
            type: 'text',
            label: 'Company Name',
            repeatableGroupId: 'addresses',
            validation: [],
            status: { hidden: '{{not (eq addressType "business")}}' },
          },
          {
            id: 'addresses.vatNumber',
            type: 'text',
            label: 'VAT Number',
            repeatableGroupId: 'addresses',
            validation: [],
            status: {
              hidden: '{{not (and (eq addressType "business") (ne country "US"))}}',
            },
          },
          {
            id: 'addresses.attentionTo',
            type: 'text',
            label: 'Attention To',
            repeatableGroupId: 'addresses',
            validation: [],
            status: { hidden: '{{not (eq addressType "mailing")}}' },
          },
        ],
      },
    ],
    submission: { url: '/api/submit', method: 'POST' },
  });

  test('given a hidden top-level field, should omit it and keep visible fields', () => {
    const descriptor: GlobalFormDescriptor = {
      blocks: [
        {
          id: 'block1',
          title: 'Block 1',
          fields: [
            { id: 'country', type: 'text', label: 'Country', validation: [] },
            {
              id: 'ssn',
              type: 'text',
              label: 'SSN',
              validation: [],
              status: { hidden: '{{not (eq country "US")}}' },
            },
            {
              id: 'passportNumber',
              type: 'text',
              label: 'Passport',
              validation: [],
              status: { hidden: '{{eq country "US"}}' },
            },
          ],
        },
      ],
      submission: { url: '/api/submit', method: 'POST' },
    };

    const omitted = omitStatusHiddenFormValues(
      descriptor,
      { country: 'UK', ssn: '123-45-6789', passportNumber: 'P1' },
      {}
    );

    expect(omitted).toEqual({ country: 'UK', passportNumber: 'P1' });
  });

  test('given a hidden block, should omit that block\'s fields', () => {
    const descriptor: GlobalFormDescriptor = {
      blocks: [
        {
          id: 'visible-block',
          title: 'Visible',
          fields: [
            { id: 'name', type: 'text', label: 'Name', validation: [] },
          ],
        },
        {
          id: 'corporation-details',
          title: 'Corporation',
          status: { hidden: '{{not (eq entityType "corporation")}}' },
          fields: [
            { id: 'corporationName', type: 'text', label: 'Corp', validation: [] },
            { id: 'taxId', type: 'text', label: 'Tax ID', validation: [] },
          ],
        },
      ],
      submission: { url: '/api/submit', method: 'POST' },
    };

    const omitted = omitStatusHiddenFormValues(
      descriptor,
      {
        entityType: 'individual',
        name: 'Ada',
        corporationName: 'Acme',
        taxId: '12-3456789',
      },
      {}
    );

    expect(omitted).toEqual({ entityType: 'individual', name: 'Ada' });
  });

  test('given a residential US address row, should omit business and mailing keys and keep state', () => {
    const omitted = omitStatusHiddenFormValues(
      createAddressDescriptor(),
      {
        country: 'UK',
        addresses: [
          {
            addressType: 'residential',
            country: 'US',
            state: 'NY',
            street: '123 Main St',
            companyName: '',
            vatNumber: '',
            attentionTo: '',
          },
        ],
      },
      {}
    );

    expect(omitted.addresses).toEqual([
      {
        addressType: 'residential',
        country: 'US',
        state: 'NY',
        street: '123 Main St',
      },
    ]);
  });

  test('given a UK business address row, should omit state and attentionTo and keep company and VAT', () => {
    const omitted = omitStatusHiddenFormValues(
      createAddressDescriptor(),
      {
        country: 'US',
        addresses: [
          {
            addressType: 'business',
            country: 'UK',
            state: '',
            street: '10 Downing St',
            companyName: 'Acme UK Ltd',
            vatNumber: 'GB123',
            attentionTo: '',
          },
        ],
      },
      {}
    );

    expect(omitted.addresses).toEqual([
      {
        addressType: 'business',
        country: 'UK',
        street: '10 Downing St',
        companyName: 'Acme UK Ltd',
        vatNumber: 'GB123',
      },
    ]);
  });

  test('given a signatory row for an individual outside the US, should omit corporation and US-only keys', () => {
    const descriptor: GlobalFormDescriptor = {
      blocks: [
        {
          id: 'signatories-block',
          title: 'Signatories',
          repeatable: true,
          fields: [
            {
              id: 'signatories.signatoryName',
              type: 'text',
              label: 'Name',
              repeatableGroupId: 'signatories',
              validation: [],
            },
            {
              id: 'signatories.signatoryTitle',
              type: 'text',
              label: 'Title',
              repeatableGroupId: 'signatories',
              validation: [],
              status: { hidden: '{{not (eq entityType "corporation")}}' },
            },
            {
              id: 'signatories.ownershipPercent',
              type: 'number',
              label: 'Ownership',
              repeatableGroupId: 'signatories',
              validation: [],
              status: { hidden: '{{not (eq entityType "corporation")}}' },
            },
            {
              id: 'signatories.ssn',
              type: 'text',
              label: 'SSN',
              repeatableGroupId: 'signatories',
              validation: [],
              status: { hidden: '{{not (eq country "US")}}' },
            },
            {
              id: 'signatories.nationalId',
              type: 'text',
              label: 'National ID',
              repeatableGroupId: 'signatories',
              validation: [],
              status: { hidden: '{{eq country "US"}}' },
            },
          ],
        },
      ],
      submission: { url: '/api/submit', method: 'POST' },
    };

    const omitted = omitStatusHiddenFormValues(
      descriptor,
      {
        entityType: 'individual',
        country: 'UK',
        signatories: [
          {
            signatoryName: 'Ada Lovelace',
            signatoryTitle: 'Managing Director',
            ownershipPercent: 40,
            ssn: '123-45-6789',
            nationalId: 'AB123',
          },
        ],
      },
      {}
    );

    expect(omitted.signatories).toEqual([
      {
        signatoryName: 'Ada Lovelace',
        nationalId: 'AB123',
      },
    ]);
  });

  test('given a hidden repeatable block, should omit the group from values', () => {
    const descriptor: GlobalFormDescriptor = {
      blocks: [
        {
          id: 'parent-companies-block',
          title: 'Parent Companies',
          repeatable: true,
          status: { hidden: '{{not (eq entityType "corporation")}}' },
          fields: [
            {
              id: 'parentCompanies.name',
              type: 'text',
              label: 'Name',
              repeatableGroupId: 'parentCompanies',
              validation: [],
            },
          ],
        },
      ],
      submission: { url: '/api/submit', method: 'POST' },
    };

    const omitted = omitStatusHiddenFormValues(
      descriptor,
      {
        entityType: 'individual',
        parentCompanies: [{ name: 'HoldCo' }],
      },
      {}
    );

    expect(omitted).toEqual({ entityType: 'individual' });
  });

  test('given File values among hidden keys, should preserve File instances', () => {
    const proof = new File(['content'], 'proof.txt', { type: 'text/plain' });
    const descriptor: GlobalFormDescriptor = {
      blocks: [
        {
          id: 'block1',
          title: 'Block 1',
          fields: [
            { id: 'country', type: 'text', label: 'Country', validation: [] },
            {
              id: 'ssn',
              type: 'text',
              label: 'SSN',
              validation: [],
              status: { hidden: '{{not (eq country "US")}}' },
            },
            { id: 'proofFile', type: 'file', label: 'Proof', validation: [] },
          ],
        },
      ],
      submission: { url: '/api/submit', method: 'POST' },
    };

    const omitted = omitStatusHiddenFormValues(
      descriptor,
      { country: 'UK', ssn: '999-99-9999', proofFile: proof },
      {}
    );

    expect(omitted.proofFile).toBe(proof);
    expect(omitted).not.toHaveProperty('ssn');
  });

  test('given no hidden keys to remove, should return the same values object', () => {
    const descriptor: GlobalFormDescriptor = {
      blocks: [
        {
          id: 'block1',
          title: 'Block 1',
          fields: [
            { id: 'country', type: 'text', label: 'Country', validation: [] },
            {
              id: 'ssn',
              type: 'text',
              label: 'SSN',
              validation: [],
              status: { hidden: '{{not (eq country "US")}}' },
            },
          ],
        },
      ],
      submission: { url: '/api/submit', method: 'POST' },
    };
    const visible = { country: 'US', ssn: '123-45-6789' };
    const alreadyClean = { country: 'UK' };

    expect(omitStatusHiddenFormValues(descriptor, visible)).toBe(visible);
    expect(omitStatusHiddenFormValues(descriptor, alreadyClean)).toBe(alreadyClean);
    expect(omitStatusHiddenFormValues(null, visible)).toBe(visible);
  });
});
