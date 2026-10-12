/**
 * Tests for Handlebars helpers
 *
 * Following TDD: Tests verify custom helpers work correctly
 * for form logic evaluation.
 */

import { describe, test, expect } from 'vitest';
import { evaluateTemplate } from './template-evaluator';

describe('handlebars helpers', () => {
  describe('comparison helpers', () => {
    test('given eq helper, should compare two values for equality', () => {
      const template = '{{#if (eq a b)}}equal{{else}}not equal{{/if}}';
      expect(evaluateTemplate(template, { a: 5, b: 5 })).toBe('equal');
      expect(evaluateTemplate(template, { a: 5, b: 10 })).toBe('not equal');
    });

    test('given ne helper, should compare two values for inequality', () => {
      const template = '{{#if (ne a b)}}not equal{{else}}equal{{/if}}';
      expect(evaluateTemplate(template, { a: 5, b: 10 })).toBe('not equal');
      expect(evaluateTemplate(template, { a: 5, b: 5 })).toBe('equal');
    });

    test('given gt helper, should check if first value is greater than second', () => {
      const template = '{{#if (gt a b)}}greater{{else}}not greater{{/if}}';
      expect(evaluateTemplate(template, { a: 10, b: 5 })).toBe('greater');
      expect(evaluateTemplate(template, { a: 5, b: 10 })).toBe('not greater');
    });

    test('given lt helper, should check if first value is less than second', () => {
      const template = '{{#if (lt a b)}}less{{else}}not less{{/if}}';
      expect(evaluateTemplate(template, { a: 5, b: 10 })).toBe('less');
      expect(evaluateTemplate(template, { a: 10, b: 5 })).toBe('not less');
    });

    test('given gte helper, should check if first value is greater than or equal to second', () => {
      const template = '{{#if (gte a b)}}greater or equal{{else}}less{{/if}}';
      expect(evaluateTemplate(template, { a: 10, b: 10 })).toBe('greater or equal');
      expect(evaluateTemplate(template, { a: 10, b: 5 })).toBe('greater or equal');
      expect(evaluateTemplate(template, { a: 5, b: 10 })).toBe('less');
    });

    test('given lte helper, should check if first value is less than or equal to second', () => {
      const template = '{{#if (lte a b)}}less or equal{{else}}greater{{/if}}';
      expect(evaluateTemplate(template, { a: 5, b: 5 })).toBe('less or equal');
      expect(evaluateTemplate(template, { a: 5, b: 10 })).toBe('less or equal');
      expect(evaluateTemplate(template, { a: 10, b: 5 })).toBe('greater');
    });
  });

  describe('logic helpers', () => {
    test('given and helper, should return true if all arguments are truthy', () => {
      const template = '{{#if (and a b)}}both true{{else}}not both true{{/if}}';
      expect(evaluateTemplate(template, { a: true, b: true })).toBe('both true');
      expect(evaluateTemplate(template, { a: true, b: false })).toBe('not both true');
      expect(evaluateTemplate(template, { a: false, b: true })).toBe('not both true');
    });

    test('given or helper, should return true if any argument is truthy', () => {
      const template = '{{#if (or a b)}}at least one true{{else}}both false{{/if}}';
      expect(evaluateTemplate(template, { a: true, b: false })).toBe('at least one true');
      expect(evaluateTemplate(template, { a: false, b: true })).toBe('at least one true');
      expect(evaluateTemplate(template, { a: false, b: false })).toBe('both false');
    });

    test('given not helper, should return negation of value', () => {
      const template = '{{#if (not a)}}false{{else}}true{{/if}}';
      expect(evaluateTemplate(template, { a: false })).toBe('false');
      expect(evaluateTemplate(template, { a: true })).toBe('true');
    });
  });

  describe('data helpers', () => {
    test('given contains helper, should check if array contains value', () => {
      const template = '{{#if (contains arr val)}}contains{{else}}does not contain{{/if}}';
      expect(evaluateTemplate(template, { arr: [1, 2, 3], val: 2 })).toBe('contains');
      expect(evaluateTemplate(template, { arr: [1, 2, 3], val: 5 })).toBe('does not contain');
    });

    test('given contains helper, should check if string contains substring', () => {
      const template = '{{#if (contains str sub)}}contains{{else}}does not contain{{/if}}';
      expect(evaluateTemplate(template, { str: 'hello world', sub: 'world' })).toBe('contains');
      expect(evaluateTemplate(template, { str: 'hello world', sub: 'foo' })).toBe('does not contain');
    });

    test('given isEmpty helper, should check if value is empty', () => {
      const template = '{{#if (isEmpty val)}}empty{{else}}not empty{{/if}}';
      expect(evaluateTemplate(template, { val: '' })).toBe('empty');
      expect(evaluateTemplate(template, { val: [] })).toBe('empty');
      expect(evaluateTemplate(template, { val: null })).toBe('empty');
      expect(evaluateTemplate(template, { val: undefined })).toBe('empty');
      expect(evaluateTemplate(template, { val: 'hello' })).toBe('not empty');
      expect(evaluateTemplate(template, { val: [1, 2] })).toBe('not empty');
    });

    test('given json helper, should stringify objects to JSON', () => {
      const template = '{{json obj}}';
      expect(evaluateTemplate(template, { obj: { name: 'John', age: 30 } })).toBe('{"name":"John","age":30}');
      expect(evaluateTemplate(template, { obj: [1, 2, 3] })).toBe('[1,2,3]');
      expect(evaluateTemplate(template, { obj: null })).toBe('null');
      expect(evaluateTemplate(template, { obj: [] })).toBe('[]');
      expect(evaluateTemplate(template, { obj: {} })).toBe('{}');
      expect(evaluateTemplate(template, { obj: undefined })).toBe('null');
    });

    test('given json helper with fallback, should use fallback for null/undefined', () => {
      const template = '{{json obj "[]"}}';
      expect(evaluateTemplate(template, { obj: undefined })).toBe('[]');
      expect(evaluateTemplate(template, { obj: null })).toBe('[]');
    });

    test('given json helper with nested arrays, should stringify correctly', () => {
      const template = '{{json contacts}}';
      const contacts = [
        { name: 'John', phone: '123-456-7890' },
        { name: 'Jane', phone: '098-765-4321' },
      ];
      expect(evaluateTemplate(template, { contacts })).toBe(
        '[{"name":"John","phone":"123-456-7890"},{"name":"Jane","phone":"098-765-4321"}]'
      );
    });

    test('given json helper in JSON template, should work correctly', () => {
      const template = '{"email":"{{email}}","contacts":{{~json contacts~}}}';
      const contacts = [
        { name: 'John', phone: '123-456-7890' },
      ];
      expect(evaluateTemplate(template, { email: 'test@example.com', contacts })).toBe(
        '{"email":"test@example.com","contacts":[{"name":"John","phone":"123-456-7890"}]}'
      );
    });

    test('given lookup helper, should read a hyphenated key inside json', () => {
      const template = '{{~json (lookup formData "emergency-contacts") "[]"~}}';
      expect(evaluateTemplate(template, {
        formData: { 'emergency-contacts': [{ name: 'Ada' }] },
      })).toBe('[{"name":"Ada"}]');
    });
  });

  describe('nested data access', () => {
    test('given context access, should enable nested form data access via dot notation', () => {
      const template = '{{user.name}} - {{user.email}}';
      const context = {
        user: {
          name: 'John Doe',
          email: 'john@example.com',
        },
      };
      expect(evaluateTemplate(template, context)).toBe('John Doe - john@example.com');
    });

    test('given nested object access, should access deeply nested properties', () => {
      const template = '{{person.address.city}}';
      const context = {
        person: {
          address: {
            city: 'New York',
          },
        },
      };
      expect(evaluateTemplate(template, context)).toBe('New York');
    });
  });
});
