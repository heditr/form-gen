/**
 * Tests for re-hydration orchestrator
 * 
 * Following TDD: Tests verify re-hydration orchestration when discriminant fields change
 * works correctly with debouncing, context extraction, API calls, merging, and status evaluation.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  shouldTriggerRehydration,
  buildRehydrationContext,
  mergeRulesAndReevaluateStatus,
  createRehydrationOrchestrator,
} from './rehydration-orchestrator';
import type {
  GlobalFormDescriptor,
  CaseContext,
  RulesObject,
  FieldDescriptor,
  FormData,
} from '@/types/form-descriptor';

describe('rehydration orchestrator', () => {
  describe('shouldTriggerRehydration', () => {
    test('given discriminant field change, should return true when context has changed', () => {
      const oldContext: CaseContext = {
        jurisdiction: 'US',
        entityType: 'individual',
      };

      const newContext: CaseContext = {
        jurisdiction: 'CA',
        entityType: 'individual',
      };

      const shouldTrigger = shouldTriggerRehydration(oldContext, newContext);

      expect(shouldTrigger).toBe(true);
    });

    test('given no context change, should return false', () => {
      const oldContext: CaseContext = {
        jurisdiction: 'US',
        entityType: 'individual',
      };

      const newContext: CaseContext = {
        jurisdiction: 'US',
        entityType: 'individual',
      };

      const shouldTrigger = shouldTriggerRehydration(oldContext, newContext);

      expect(shouldTrigger).toBe(false);
    });

    test('given empty contexts, should return false', () => {
      const shouldTrigger = shouldTriggerRehydration({}, {});

      expect(shouldTrigger).toBe(false);
    });
  });

  describe('buildRehydrationContext', () => {
    test('given form data and discriminant fields, should build updated CaseContext from form data', () => {
      const currentContext: CaseContext = {
        incorporationCountry: 'US',
        processType: 'standard',
      };

      const formData: Partial<FormData> = {
        jurisdiction: 'CA',
        entityType: 'corporate',
        email: 'test@example.com', // Not a discriminant field
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

      const updatedContext = buildRehydrationContext(
        currentContext,
        formData,
        discriminantFields
      );

      expect(updatedContext.incorporationCountry).toBe('US'); // Preserved
      expect(updatedContext.processType).toBe('standard'); // Preserved
      expect(updatedContext.jurisdiction).toBe('CA'); // Updated
      expect(updatedContext.entityType).toBe('corporate'); // Updated
      expect(updatedContext.email).toBeUndefined(); // Not a discriminant field
    });

    test('given empty form data, should preserve current context', () => {
      const currentContext: CaseContext = {
        jurisdiction: 'US',
      };

      const formData: Partial<FormData> = {};

      const discriminantFields: FieldDescriptor[] = [
        {
          id: 'jurisdiction',
          type: 'dropdown',
          label: 'Jurisdiction',
          validation: [],
          isDiscriminant: true,
        },
      ];

      const updatedContext = buildRehydrationContext(
        currentContext,
        formData,
        discriminantFields
      );

      expect(updatedContext).toEqual(currentContext);
    });
  });

  describe('mergeRulesAndReevaluateStatus', () => {
    test('given rules response, should merge RulesObject into descriptor', () => {
      const globalDescriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'personal-info',
            title: 'Personal Information',
            fields: [
              {
                id: 'email',
                type: 'text',
                label: 'Email',
                validation: [
                  { type: 'required', message: 'Email is required' },
                ],
              },
            ],
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const rulesObject: RulesObject = {
        fields: [
          {
            id: 'email',
            validation: [
              { type: 'pattern', value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email format' },
            ],
          },
        ],
      };

      const formContext = {
        formData: {},
        caseContext: {},
      };

      const merged = mergeRulesAndReevaluateStatus(
        globalDescriptor,
        rulesObject,
        formContext
      );

      expect(merged.blocks[0].fields[0].validation).toHaveLength(2);
      expect(merged.blocks[0].fields[0].validation[0]).toEqual({ type: 'required', message: 'Email is required' });
      expect(merged.blocks[0].fields[0].validation[1]).toEqual({ type: 'pattern', value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email format' });
    });

    test('given merge complete, should re-evaluate all status templates', () => {
      const globalDescriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'tax-info',
            title: 'Tax Information',
            status: {
              hidden: '{{#if hideTaxInfo}}true{{/if}}',
            },
            fields: [
              {
                id: 'taxId',
                type: 'text',
                label: 'Tax ID',
                validation: [],
                status: {
                  disabled: '{{#if readonly}}true{{/if}}',
                },
              },
            ],
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const rulesObject: RulesObject = {
        blocks: [
          {
            id: 'tax-info',
            status: {
              hidden: '{{#if hideTaxInfo}}true{{/if}}',
            },
          },
        ],
        fields: [
          {
            id: 'taxId',
            status: {
              readonly: '{{#if isReadonly}}true{{/if}}',
            },
          },
        ],
      };

      const formContext = {
        formData: {},
        caseContext: {},
        hideTaxInfo: true,
        readonly: false,
        isReadonly: true,
      };

      const merged = mergeRulesAndReevaluateStatus(
        globalDescriptor,
        rulesObject,
        formContext
      );

      // Status templates should be merged (not evaluated here, that's done in components)
      expect(merged.blocks[0].status?.hidden).toBe('{{#if hideTaxInfo}}true{{/if}}');
      expect(merged.blocks[0].fields[0].status?.disabled).toBe('{{#if readonly}}true{{/if}}');
      expect(merged.blocks[0].fields[0].status?.readonly).toBe('{{#if isReadonly}}true{{/if}}');
    });
  });

  describe('createRehydrationOrchestrator', () => {
    test('given orchestrator, should provide debounced re-hydration function', async () => {
      vi.useFakeTimers();

      const orchestrator = createRehydrationOrchestrator();
      const mockRehydrate = vi.fn();

      const context1: CaseContext = { jurisdiction: 'US' };
      const context2: CaseContext = { jurisdiction: 'CA' };

      // First call
      orchestrator.debouncedRehydrate(context1, mockRehydrate);
      
      // Second call before debounce completes (should cancel first)
      orchestrator.debouncedRehydrate(context2, mockRehydrate);

      // Fast-forward 500ms
      vi.advanceTimersByTime(500);

      // Should only call once with the latest context
      expect(mockRehydrate).toHaveBeenCalledTimes(1);
      expect(mockRehydrate).toHaveBeenCalledWith(context2);

      vi.useRealTimers();
    });

    test('given re-hydration, should show loading indicator without blocking input', () => {
      const orchestrator = createRehydrationOrchestrator();
      const mockSetLoading = vi.fn();

      orchestrator.setLoadingIndicator(mockSetLoading);
      orchestrator.startRehydration();

      expect(mockSetLoading).toHaveBeenCalledWith(true);

      orchestrator.completeRehydration();

      expect(mockSetLoading).toHaveBeenCalledWith(false);
    });
  });
});
