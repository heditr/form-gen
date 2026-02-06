/**
 * Tests for block resolver utility
 * 
 * Tests the utility that resolves blocks by ID from mergedDescriptor
 * for popin triggers.
 */

import { describe, test, expect, vi, beforeAll } from 'vitest';
import { resolveBlockById } from './block-resolver';
import type { GlobalFormDescriptor, BlockDescriptor } from '@/types/form-descriptor';
import type { FormContext } from './template-evaluator';
import { registerHandlebarsHelpers } from './handlebars-helpers';

describe('block-resolver', () => {
  beforeAll(() => {
    registerHandlebarsHelpers();
  });
  const createTestDescriptor = (blocks: BlockDescriptor[]): GlobalFormDescriptor => ({
    blocks,
    submission: {
      url: '/api/submit',
      method: 'POST',
    },
  });

  const createFormContext = (overrides: Record<string, unknown> = {}): FormContext => {
    // Create a proper FormContext object
    const context: FormContext = {};
    for (const [key, value] of Object.entries(overrides)) {
      context[key] = value as string | number | boolean | null | undefined;
    }
    return context;
  };

  describe('resolveBlockById', () => {
    test('given block ID reference, should lookup block in mergedDescriptor.blocks array by ID', () => {
      const block: BlockDescriptor = {
        id: 'contact-info',
        title: 'Contact Information',
        fields: [],
      };
      const descriptor = createTestDescriptor([block]);
      const context: FormContext = {};

      const result = resolveBlockById('contact-info', descriptor, context);

      expect(result).toBeDefined();
      expect(result?.block.id).toBe('contact-info');
      expect(result?.block.title).toBe('Contact Information');
    });

    test('given block not found, should log error and return null', () => {
      const descriptor = createTestDescriptor([]);
      const context = createFormContext();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = resolveBlockById('non-existent', descriptor, context);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Block "non-existent" not found')
      );

      consoleErrorSpy.mockRestore();
    });

    test('given block found, should return block with evaluated status templates', () => {
      const block: BlockDescriptor = {
        id: 'contact-info',
        title: 'Contact Information',
        fields: [],
        status: {
          hidden: '{{#if hideContact}}true{{else}}false{{/if}}',
          disabled: '{{#if readonly}}true{{else}}false{{/if}}',
        },
      };
      const descriptor = createTestDescriptor([block]);
      const context: FormContext = { hideContact: false, readonly: true };

      const result = resolveBlockById('contact-info', descriptor, context);

      expect(result).toBeDefined();
      expect(result?.isHidden).toBe(false);
      expect(result?.isDisabled).toBe(true);
    });

    test('given block visibility, should respect block status.hidden template before allowing popin open', () => {
      const block: BlockDescriptor = {
        id: 'contact-info',
        title: 'Contact Information',
        fields: [],
        status: {
          hidden: '{{#if hideContact}}true{{else}}false{{/if}}',
        },
      };
      const descriptor = createTestDescriptor([block]);
      const context: FormContext = { hideContact: true };

      const result = resolveBlockById('contact-info', descriptor, context);

      expect(result).toBeDefined();
      expect(result?.isHidden).toBe(true);
    });

    test('given block disabled state, should respect block status.disabled template (can still open but fields disabled)', () => {
      const block: BlockDescriptor = {
        id: 'contact-info',
        title: 'Contact Information',
        fields: [],
        status: {
          disabled: '{{#if readonly}}true{{else}}false{{/if}}',
        },
      };
      const descriptor = createTestDescriptor([block]);
      const context: FormContext = { readonly: true };

      const result = resolveBlockById('contact-info', descriptor, context);

      expect(result).toBeDefined();
      expect(result?.isDisabled).toBe(true);
      // Block can still be resolved even if disabled
      expect(result?.block).toBeDefined();
    });

    test('given performance needs, should cache block lookup map for O(1) access', () => {
      const blocks: BlockDescriptor[] = [
        { id: 'block1', title: 'Block 1', fields: [] },
        { id: 'block2', title: 'Block 2', fields: [] },
        { id: 'block3', title: 'Block 3', fields: [] },
      ];
      const descriptor = createTestDescriptor(blocks);
      const context = createFormContext();

      // First call should build cache
      const result1 = resolveBlockById('block2', descriptor, context);
      expect(result1?.block.id).toBe('block2');

      // Second call should use cache
      const result2 = resolveBlockById('block2', descriptor, context);
      expect(result2?.block.id).toBe('block2');

      // Third call with different block should still work
      const result3 = resolveBlockById('block1', descriptor, context);
      expect(result3?.block.id).toBe('block1');
    });

    test('given multiple blocks with same ID pattern, should resolve correct block', () => {
      const blocks: BlockDescriptor[] = [
        { id: 'contact-info', title: 'Contact Info', fields: [] },
        { id: 'address-info', title: 'Address Info', fields: [] },
        { id: 'owner-info', title: 'Owner Info', fields: [] },
      ];
      const descriptor = createTestDescriptor(blocks);
      const context = createFormContext();

      const result = resolveBlockById('address-info', descriptor, context);

      expect(result?.block.id).toBe('address-info');
      expect(result?.block.title).toBe('Address Info');
    });

    test('given block without status templates, should return default values', () => {
      const block: BlockDescriptor = {
        id: 'simple-block',
        title: 'Simple Block',
        fields: [],
      };
      const descriptor = createTestDescriptor([block]);
      const context = createFormContext();

      const result = resolveBlockById('simple-block', descriptor, context);

      expect(result).toBeDefined();
      expect(result?.isHidden).toBe(false);
      expect(result?.isDisabled).toBe(false);
    });
  });
});
