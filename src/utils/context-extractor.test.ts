/**
 * Tests for context extractor
 * 
 * Following TDD: Tests verify CaseContext extraction from CasePrefill and form data
 * works correctly.
 */

import { describe, test, expect } from 'vitest';
import {
  initializeCaseContext,
  identifyDiscriminantFields,
  updateCaseContext,
  hasContextChanged,
} from './context-extractor';
import type { FieldDescriptor, CaseContext, CasePrefill } from '@/types/form-descriptor';

describe('context extractor', () => {
  describe('initializeCaseContext', () => {
    test('given CasePrefill provided at case creation, should initialize CaseContext with incorporationCountry, onboardingCountries, processType, and needSignature', () => {
      const casePrefill: CasePrefill = {
        incorporationCountry: 'US',
        onboardingCountries: ['US', 'CA'],
        processType: 'standard',
        needSignature: true,
      };

      const context = initializeCaseContext(casePrefill);

      expect(context.incorporationCountry).toBe('US');
      expect(context.onboardingCountries).toEqual(['US', 'CA']);
      expect(context.processType).toBe('standard');
      expect(context.needSignature).toBe(true);
    });

    test('given partial CasePrefill, should initialize with available properties', () => {
      const casePrefill: CasePrefill = {
        incorporationCountry: 'US',
        processType: 'standard',
      };

      const context = initializeCaseContext(casePrefill);

      expect(context.incorporationCountry).toBe('US');
      expect(context.processType).toBe('standard');
      expect(context.onboardingCountries).toBeUndefined();
      expect(context.needSignature).toBeUndefined();
    });

    test('given empty CasePrefill, should return empty context', () => {
      const context = initializeCaseContext({});

      expect(context).toEqual({});
    });
  });

  describe('identifyDiscriminantFields', () => {
    test('given form data and field descriptors, should identify discriminant fields', () => {
      const fields: FieldDescriptor[] = [
        {
          id: 'jurisdiction',
          type: 'dropdown',
          label: 'Jurisdiction',
          validation: [],
          isDiscriminant: true,
        },
        {
          id: 'entityType',
          type: 'dropdown',
          label: 'Entity Type',
          validation: [],
          isDiscriminant: true,
        },
        {
          id: 'email',
          type: 'text',
          label: 'Email',
          validation: [],
          isDiscriminant: false,
        },
      ];

      const discriminantFields = identifyDiscriminantFields(fields);

      expect(discriminantFields).toHaveLength(2);
      expect(discriminantFields[0].id).toBe('jurisdiction');
      expect(discriminantFields[1].id).toBe('entityType');
    });

    test('given fields with no discriminant flags, should return empty array', () => {
      const fields: FieldDescriptor[] = [
        {
          id: 'email',
          type: 'text',
          label: 'Email',
          validation: [],
        },
      ];

      const discriminantFields = identifyDiscriminantFields(fields);

      expect(discriminantFields).toEqual([]);
    });
  });

  describe('updateCaseContext', () => {
    test('given discriminant field values, should update CaseContext object', () => {
      const initialContext: CaseContext = {
        incorporationCountry: 'US',
        processType: 'standard',
      };

      const discriminantFields: FieldDescriptor[] = [
        {
          id: 'jurisdiction',
          type: 'dropdown',
          label: 'Jurisdiction',
          validation: [],
          isDiscriminant: true,
        },
        {
          id: 'entityType',
          type: 'dropdown',
          label: 'Entity Type',
          validation: [],
          isDiscriminant: true,
        },
      ];

      const formData = {
        jurisdiction: 'CA',
        entityType: 'individual',
        email: 'test@example.com', // Not a discriminant field
      };

      const updatedContext = updateCaseContext(initialContext, formData, discriminantFields);

      expect(updatedContext.incorporationCountry).toBe('US'); // Preserved from initial
      expect(updatedContext.processType).toBe('standard'); // Preserved from initial
      expect(updatedContext.jurisdiction).toBe('CA'); // Updated from form data
      expect(updatedContext.entityType).toBe('individual'); // Updated from form data
      expect(updatedContext.email).toBeUndefined(); // Not a discriminant field
    });

    test('given missing discriminant field values, should preserve existing or set undefined', () => {
      const initialContext: CaseContext = {
        jurisdiction: 'US',
      };

      const discriminantFields: FieldDescriptor[] = [
        {
          id: 'jurisdiction',
          type: 'dropdown',
          label: 'Jurisdiction',
          validation: [],
          isDiscriminant: true,
        },
        {
          id: 'entityType',
          type: 'dropdown',
          label: 'Entity Type',
          validation: [],
          isDiscriminant: true,
        },
      ];

      const formData = {
        // entityType is missing
      };

      const updatedContext = updateCaseContext(initialContext, formData, discriminantFields);

      expect(updatedContext.jurisdiction).toBe('US'); // Preserved
      expect(updatedContext.entityType).toBeUndefined(); // Missing in form data
    });

    test('given empty form data, should preserve initial context', () => {
      const initialContext: CaseContext = {
        incorporationCountry: 'US',
      };

      const discriminantFields: FieldDescriptor[] = [];

      const updatedContext = updateCaseContext(initialContext, {}, discriminantFields);

      expect(updatedContext).toEqual(initialContext);
    });
  });

  describe('hasContextChanged', () => {
    test('given context changes, should detect when CaseContext has changed requiring re-hydration', () => {
      const oldContext: CaseContext = {
        incorporationCountry: 'US',
        jurisdiction: 'US',
        entityType: 'individual',
      };

      const newContext: CaseContext = {
        incorporationCountry: 'US',
        jurisdiction: 'CA',
        entityType: 'individual',
      };

      const hasChanged = hasContextChanged(oldContext, newContext);

      expect(hasChanged).toBe(true);
    });

    test('given identical contexts, should return false', () => {
      const oldContext: CaseContext = {
        incorporationCountry: 'US',
        jurisdiction: 'US',
        entityType: 'individual',
      };

      const newContext: CaseContext = {
        incorporationCountry: 'US',
        jurisdiction: 'US',
        entityType: 'individual',
      };

      const hasChanged = hasContextChanged(oldContext, newContext);

      expect(hasChanged).toBe(false);
    });

    test('given context with new property, should detect change', () => {
      const oldContext: CaseContext = {
        incorporationCountry: 'US',
      };

      const newContext: CaseContext = {
        incorporationCountry: 'US',
        jurisdiction: 'CA',
      };

      const hasChanged = hasContextChanged(oldContext, newContext);

      expect(hasChanged).toBe(true);
    });

    test('given context with removed property, should detect change', () => {
      const oldContext: CaseContext = {
        incorporationCountry: 'US',
        jurisdiction: 'US',
      };

      const newContext: CaseContext = {
        incorporationCountry: 'US',
      };

      const hasChanged = hasContextChanged(oldContext, newContext);

      expect(hasChanged).toBe(true);
    });

    test('given null to value change, should detect change', () => {
      const oldContext: CaseContext = {
        jurisdiction: null,
      };

      const newContext: CaseContext = {
        jurisdiction: 'US',
      };

      const hasChanged = hasContextChanged(oldContext, newContext);

      expect(hasChanged).toBe(true);
    });

    test('given empty contexts, should return false', () => {
      const hasChanged = hasContextChanged({}, {});

      expect(hasChanged).toBe(false);
    });
  });
});
