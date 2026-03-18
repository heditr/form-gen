import { describe, test, expect, beforeAll } from 'vitest';
import { registerHandlebarsHelpers } from '@/utils/handlebars-helpers';
import {
  evaluateItemsArrayTemplate,
  evaluateValidationArrayTemplate,
  evaluateTemplateJsonArray,
} from './array-template-evaluator';

describe('array-template-evaluator', () => {
  beforeAll(() => {
    registerHandlebarsHelpers();
  });

  describe('evaluateTemplateJsonArray', () => {
    test('given an array, should return it unchanged', () => {
      const result = evaluateTemplateJsonArray([1, 2], {}, []);
      expect(result).toEqual([1, 2]);
    });

    test('given a handlebars template producing JSON array, should parse it', () => {
      const result = evaluateTemplateJsonArray('{{json items "[]"}}', { items: [1, 2] }, []);
      expect(result).toEqual([1, 2]);
    });

    test('given invalid JSON output, should return fallback', () => {
      const result = evaluateTemplateJsonArray('{{#if true}}not-json{{/if}}', {}, ['x']);
      expect(result).toEqual(['x']);
    });
  });

  describe('evaluateItemsArrayTemplate', () => {
    test('given items array, should return array', () => {
      const result = evaluateItemsArrayTemplate([{ label: 'A', value: 'a' }], {});
      expect(result).toEqual([{ label: 'A', value: 'a' }]);
    });

    test('given items template, should return parsed FieldItem[]', () => {
      const template = '{{#if (eq caseContext.country "US")}}[{"label":"SSN","value":"ssn"}]{{else}}[]{{/if}}';
      const result = evaluateItemsArrayTemplate(template, { caseContext: { country: 'US' } });
      expect(result).toEqual([{ label: 'SSN', value: 'ssn' }]);
    });

    test('given items template with invalid elements, should filter them out', () => {
      const template = '[{"label":"A","value":"a"},{"label":5}]';
      const result = evaluateItemsArrayTemplate(template, {});
      expect(result).toEqual([{ label: 'A', value: 'a' }]);
    });
  });

  describe('evaluateValidationArrayTemplate', () => {
    test('given validation array, should return array', () => {
      const result = evaluateValidationArrayTemplate([{ type: 'required', message: 'Required' }], {});
      expect(result).toEqual([{ type: 'required', message: 'Required' }]);
    });

    test('given validation template, should return parsed ValidationRule[]', () => {
      const template =
        '{{#if (eq caseContext.country "US")}}' +
        '[{"type":"required","message":"Required"},{"type":"pattern","value":"^\\\\d+$","message":"Digits"}]' +
        '{{else}}[]{{/if}}';
      const result = evaluateValidationArrayTemplate(template, { caseContext: { country: 'US' } });
      expect(result).toEqual([
        { type: 'required', message: 'Required' },
        { type: 'pattern', value: '^\\d+$', message: 'Digits' },
      ]);
    });

    test('given template returning custom rule, should ignore it', () => {
      const template = '[{"type":"custom","message":"Nope","value":"x"},{"type":"required","message":"Ok"}]';
      const result = evaluateValidationArrayTemplate(template, {});
      expect(result).toEqual([{ type: 'required', message: 'Ok' }]);
    });
  });
});

