/**
 * Tests for default value evaluator
 * 
 * Following TDD: Tests verify Handlebars template evaluation
 * for field default values with proper type conversion.
 */

import { describe, test, expect, beforeAll } from 'vitest';
import { registerHandlebarsHelpers } from './handlebars-helpers';
import { evaluateDefaultValue } from './default-value-evaluator';
import type { FieldType } from '@/types/form-descriptor';
import type { FormContext } from './template-evaluator';

describe('default-value-evaluator', () => {
  beforeAll(() => {
    registerHandlebarsHelpers();
  });

  describe('evaluateDefaultValue', () => {
    describe('non-string defaultValue', () => {
      test('given a number defaultValue, should return value unchanged', () => {
        const result = evaluateDefaultValue(42, 'number', {});
        
        expect(result).toBe(42);
      });

      test('given a boolean defaultValue, should return value unchanged', () => {
        const result = evaluateDefaultValue(true, 'checkbox', {});
        
        expect(result).toBe(true);
      });

      test('given a null defaultValue, should return null', () => {
        const result = evaluateDefaultValue(null, 'text', {});
        
        expect(result).toBeNull();
      });

      test('given an undefined defaultValue, should return undefined', () => {
        const result = evaluateDefaultValue(undefined, 'text', {});
        
        expect(result).toBeUndefined();
      });
    });

    describe('string defaultValue (template evaluation)', () => {
      describe('text field', () => {
        test('given a template string and context, should evaluate and return string', () => {
          const template = 'Hello {{user.name}}';
          const context: FormContext = { user: { name: 'John' } };
          
          const result = evaluateDefaultValue(template, 'text', context);
          
          expect(result).toBe('Hello John');
        });

        test('given a template with caseContext, should evaluate with context values', () => {
          const template = '{{caseContext.country}}';
          const context: FormContext = { caseContext: { country: 'US' } };
          
          const result = evaluateDefaultValue(template, 'text', context);
          
          expect(result).toBe('US');
        });

        test('given a template with formData, should evaluate with form values', () => {
          const template = '{{formData.firstName}} {{formData.lastName}}';
          const context: FormContext = { 
            formData: { firstName: 'John', lastName: 'Doe' } 
          };
          
          const result = evaluateDefaultValue(template, 'text', context);
          
          expect(result).toBe('John Doe');
        });
      });

      describe('dropdown field', () => {
        test('given a template string, should evaluate and return string', () => {
          const template = '{{caseContext.defaultCountry}}';
          const context: FormContext = { caseContext: { defaultCountry: 'CA' } };
          
          const result = evaluateDefaultValue(template, 'dropdown', context);
          
          expect(result).toBe('CA');
        });
      });

      describe('autocomplete field', () => {
        test('given a template string, should evaluate and return string', () => {
          const template = '{{formData.city}}';
          const context: FormContext = { formData: { city: 'New York' } };
          
          const result = evaluateDefaultValue(template, 'autocomplete', context);
          
          expect(result).toBe('New York');
        });
      });

      describe('date field', () => {
        test('given a template string, should evaluate and return string', () => {
          const template = '{{caseContext.defaultDate}}';
          const context: FormContext = { caseContext: { defaultDate: '2024-01-01' } };
          
          const result = evaluateDefaultValue(template, 'date', context);
          
          expect(result).toBe('2024-01-01');
        });
      });

      describe('checkbox field', () => {
        test('given a template evaluating to "true", should parse to boolean true', () => {
          const template = '{{#if caseContext.needSignature}}true{{else}}false{{/if}}';
          const context: FormContext = { caseContext: { needSignature: true } };
          
          const result = evaluateDefaultValue(template, 'checkbox', context);
          
          expect(result).toBe(true);
        });

        test('given a template evaluating to "false", should parse to boolean false', () => {
          const template = '{{#if caseContext.needSignature}}true{{else}}false{{/if}}';
          const context: FormContext = { caseContext: { needSignature: false } };
          
          const result = evaluateDefaultValue(template, 'checkbox', context);
          
          expect(result).toBe(false);
        });

        test('given a template evaluating to "1", should parse to boolean true', () => {
          const template = '1';
          const context: FormContext = {};
          
          const result = evaluateDefaultValue(template, 'checkbox', context);
          
          expect(result).toBe(true);
        });

        test('given a template evaluating to empty string, should parse to boolean false', () => {
          const template = '';
          const context: FormContext = {};
          
          const result = evaluateDefaultValue(template, 'checkbox', context);
          
          expect(result).toBe(false);
        });
      });

      describe('number field', () => {
        test('given a template evaluating to number string, should parse to number', () => {
          const template = '{{caseContext.defaultAmount}}';
          const context: FormContext = { caseContext: { defaultAmount: '100' } };
          
          const result = evaluateDefaultValue(template, 'number', context);
          
          expect(result).toBe(100);
        });

        test('given a template evaluating to numeric string, should parse to number', () => {
          const template = '42';
          const context: FormContext = {};
          
          const result = evaluateDefaultValue(template, 'number', context);
          
          expect(result).toBe(42);
        });

        test('given a template evaluating to decimal string, should parse to number', () => {
          const template = '3.14';
          const context: FormContext = {};
          
          const result = evaluateDefaultValue(template, 'number', context);
          
          expect(result).toBe(3.14);
        });

        test('given a template evaluating to invalid number, should return 0', () => {
          const template = 'not-a-number';
          const context: FormContext = {};
          
          const result = evaluateDefaultValue(template, 'number', context);
          
          expect(result).toBe(0);
        });
      });

      describe('radio field', () => {
        test('given a template evaluating to string, should return string', () => {
          const template = '{{caseContext.defaultOption}}';
          const context: FormContext = { caseContext: { defaultOption: 'option1' } };
          
          const result = evaluateDefaultValue(template, 'radio', context);
          
          expect(result).toBe('option1');
        });

        test('given a template evaluating to number string, should return number', () => {
          const template = '{{caseContext.defaultValue}}';
          const context: FormContext = { caseContext: { defaultValue: '42' } };
          
          const result = evaluateDefaultValue(template, 'radio', context);
          
          // Radio can return string or number, but template always returns string
          // We'll keep it as string unless it's a pure number
          expect(result).toBe('42');
        });
      });

      describe('file field', () => {
        test('given a template evaluating to URL string, should return URL string', () => {
          const template = '{{caseContext.documentUrl}}';
          const context: FormContext = { caseContext: { documentUrl: 'https://example.com/file.pdf' } };
          
          const result = evaluateDefaultValue(template, 'file', context);
          
          expect(result).toBe('https://example.com/file.pdf');
        });

        test('given a template evaluating to "null", should return null', () => {
          const template = 'null';
          const context: FormContext = {};
          
          const result = evaluateDefaultValue(template, 'file', context);
          
          expect(result).toBeNull();
        });

        test('given a template evaluating to empty string, should return null', () => {
          const template = '';
          const context: FormContext = {};
          
          const result = evaluateDefaultValue(template, 'file', context);
          
          expect(result).toBeNull();
        });

        test('given a template evaluating to whitespace, should return null', () => {
          const template = '   ';
          const context: FormContext = {};
          
          const result = evaluateDefaultValue(template, 'file', context);
          
          expect(result).toBeNull();
        });
      });

      describe('error handling', () => {
        test('given an invalid template, should return fallback for text field', () => {
          const template = '{{#invalid syntax}}';
          const context: FormContext = {};
          
          const result = evaluateDefaultValue(template, 'text', context);
          
          expect(result).toBe('');
        });

        test('given an invalid template, should return fallback for checkbox field', () => {
          const template = '{{#invalid syntax}}';
          const context: FormContext = {};
          
          const result = evaluateDefaultValue(template, 'checkbox', context);
          
          expect(result).toBe(false);
        });

        test('given an invalid template, should return fallback for number field', () => {
          const template = '{{#invalid syntax}}';
          const context: FormContext = {};
          
          const result = evaluateDefaultValue(template, 'number', context);
          
          expect(result).toBe(0);
        });

        test('given an invalid template, should return fallback for file field', () => {
          const template = '{{#invalid syntax}}';
          const context: FormContext = {};
          
          const result = evaluateDefaultValue(template, 'file', context);
          
          expect(result).toBeNull();
        });
      });
    });
  });
});
