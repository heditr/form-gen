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
