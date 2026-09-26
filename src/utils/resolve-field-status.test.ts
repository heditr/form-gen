/**
 * Tests for resolveFieldStatus — context map vs local template evaluation.
 */

import { describe, test, expect } from 'vitest';
import type { FieldDescriptor } from '@/types/form-descriptor';
import { resolveFieldStatus, type FieldStatusSource } from './resolve-field-status';

const cityField: FieldDescriptor = {
  id: 'city',
  type: 'text',
  label: 'City',
  validation: [],
  status: {
    hidden: '{{#if hideCity}}true{{else}}false{{/if}}',
    disabled: '{{#if lockCity}}true{{else}}false{{/if}}',
    readonly: '{{#if freezeCity}}true{{else}}false{{/if}}',
  },
};

describe('resolveFieldStatus', () => {
  test('given local mode, should evaluate field templates from form context', () => {
    const statusContext: FieldStatusSource = {
      getFieldStatus: () => ({ hidden: false, disabled: false, readonly: false }),
    };

    const status = resolveFieldStatus({
      field: cityField,
      formContext: { hideCity: true, lockCity: false, freezeCity: true },
      statusContext,
      statusMode: 'local',
    });

    expect(status).toEqual({ hidden: true, disabled: false, readonly: true });
  });

  test('given context mode, should read the status map instead of form context templates', () => {
    const statusContext: FieldStatusSource = {
      getFieldStatus: () => ({ hidden: true, disabled: false, readonly: true }),
    };

    const status = resolveFieldStatus({
      field: cityField,
      formContext: { hideCity: false, lockCity: false, freezeCity: false },
      statusContext,
      statusMode: 'context',
    });

    expect(status).toEqual({ hidden: true, disabled: false, readonly: true });
  });

  test('given a disabled or readonly block, should cascade that status onto the field', () => {
    const status = resolveFieldStatus({
      field: cityField,
      formContext: {},
      statusMode: 'local',
      blockDisabled: true,
      blockReadonly: true,
    });

    expect(status.disabled).toBe(true);
    expect(status.readonly).toBe(true);
    expect(status.hidden).toBe(false);
  });

  test('given context mode without a status source, should fall back to local evaluation', () => {
    const status = resolveFieldStatus({
      field: cityField,
      formContext: { hideCity: true },
      statusContext: null,
      statusMode: 'context',
    });

    expect(status.hidden).toBe(true);
  });
});
