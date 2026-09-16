/**
 * Tests for popin form context helpers.
 */

import { describe, test, expect, beforeAll } from 'vitest';
import { registerHandlebarsHelpers } from './handlebars-helpers';
import { evaluateHiddenStatus } from './template-evaluator';
import {
  getRepeatablePopinInstanceValues,
  buildPopinFormContext,
  getPopinLoadFieldValues,
} from './popin-form-context';
import type { FieldDescriptor } from '@/types/form-descriptor';

describe('getRepeatablePopinInstanceValues', () => {
  test('given edit context with a group index, should return a clone of that row', () => {
    const row = { street: '123 Main St', country: 'US', addressType: 'business' };
    const mainFormValues = {
      addresses: [row, { street: '456 Oak Ave', country: 'UK' }],
    };

    const result = getRepeatablePopinInstanceValues(mainFormValues, {
      groupId: 'addresses',
      index: 0,
    });

    expect(result).toEqual(row);
    expect(result).not.toBe(row);
  });

  test('given create mode with a negative index, should not return instance values', () => {
    const result = getRepeatablePopinInstanceValues(
      { addresses: [{ street: '123 Main St' }] },
      { groupId: 'addresses', index: -1 }
    );

    expect(result).toBeUndefined();
  });

  test('given a missing group array, should not return instance values', () => {
    const result = getRepeatablePopinInstanceValues(
      {},
      { groupId: 'addresses', index: 0 }
    );

    expect(result).toBeUndefined();
  });
});

describe('buildPopinFormContext', () => {
  beforeAll(() => {
    registerHandlebarsHelpers();
  });

  const companyNameField: FieldDescriptor = {
    id: 'companyName',
    type: 'text',
    label: 'Company Name',
    validation: [],
    status: {
      hidden: '{{not (eq addressType "business")}}',
    },
  };

  const stateField: FieldDescriptor = {
    id: 'state',
    type: 'text',
    label: 'State',
    validation: [],
    status: {
      hidden: '{{not (or (eq country "US") (eq country "CA"))}}',
    },
  };

  test('given colliding main-form keys, should let popin instance values win for status templates', () => {
    const context = buildPopinFormContext({
      mainFormValues: { country: 'FR', city: 'Paris' },
      popinValues: {
        country: 'US',
        city: 'New York',
        addressType: 'business',
        companyName: 'Acme',
      },
      initialFormContext: {
        country: 'FR',
        city: 'Paris',
        formData: { country: 'FR' },
      },
    });

    expect(context.country).toBe('US');
    expect(context.city).toBe('New York');
    expect(evaluateHiddenStatus(companyNameField, context)).toBe(false);
    expect(evaluateHiddenStatus(stateField, context)).toBe(false);
  });

  test('given a residential instance, should keep business-only fields hidden', () => {
    const context = buildPopinFormContext({
      mainFormValues: { country: 'US' },
      popinValues: {
        country: 'US',
        addressType: 'residential',
      },
    });

    expect(evaluateHiddenStatus(companyNameField, context)).toBe(true);
    expect(evaluateHiddenStatus(stateField, context)).toBe(false);
  });

  test('given main-form country that would hide a field, should still show it when the instance country matches', () => {
    const context = buildPopinFormContext({
      mainFormValues: { country: '' },
      initialFormContext: { country: '' },
      popinValues: { country: 'US', addressType: 'residential' },
    });

    expect(evaluateHiddenStatus(stateField, context)).toBe(false);
  });

  test('given a hidden template that reads a main-form-only key, should hide from that main-form value', () => {
    const ownershipField: FieldDescriptor = {
      id: 'ownershipPercent',
      type: 'text',
      label: 'Ownership Percent',
      validation: [],
      status: {
        hidden: '{{not (eq entityType "corporation")}}',
      },
    };

    const hiddenForIndividual = buildPopinFormContext({
      mainFormValues: { entityType: 'individual', country: 'US' },
      popinValues: { signatoryName: 'Ada' },
    });
    const visibleForCorporation = buildPopinFormContext({
      mainFormValues: { entityType: 'corporation', country: 'FR' },
      popinValues: { signatoryName: 'Ada' },
    });

    expect(evaluateHiddenStatus(ownershipField, hiddenForIndividual)).toBe(true);
    expect(evaluateHiddenStatus(ownershipField, visibleForCorporation)).toBe(false);
  });
});

describe('getPopinLoadFieldValues', () => {
  test('given create mode with prefixed group fields, should map load data onto base field ids', () => {
    const values = getPopinLoadFieldValues({
      fields: [
        { id: 'signatories.signatoryName', repeatableGroupId: 'signatories' },
        { id: 'signatories.signatoryRole', repeatableGroupId: 'signatories' },
        { id: 'ignored.other', repeatableGroupId: 'ignored' },
      ],
      popinLoadData: {
        signatoryName: 'Ada Lovelace',
        signatoryRole: 'director',
        extra: 'skip-me',
      },
      groupId: 'signatories',
    });

    expect(values).toEqual({
      signatoryName: 'Ada Lovelace',
      signatoryRole: 'director',
    });
  });

  test('given standalone popin fields, should copy load data for non-repeatable field ids', () => {
    const values = getPopinLoadFieldValues({
      fields: [
        { id: 'contactEmail' },
        { id: 'emergency-contacts.emergencyName', repeatableGroupId: 'emergency-contacts' },
      ],
      popinLoadData: {
        contactEmail: 'contact.demo@example.com',
        'emergency-contacts': [{ emergencyName: 'Jane' }],
      },
    });

    expect(values).toEqual({
      contactEmail: 'contact.demo@example.com',
    });
  });
});
