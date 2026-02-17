/**
 * Tests for Handlebars helpers
 * 
 * Following TDD: Tests verify custom helpers work correctly
 * for form logic evaluation.
 */

import { describe, test, expect } from 'vitest';
import Handlebars from 'handlebars';
import { registerHandlebarsHelpers } from './handlebars-helpers';

describe('handlebars helpers', () => {
  beforeAll(() => {
    registerHandlebarsHelpers();
  });

  describe('comparison helpers', () => {
    test('given eq helper, should compare two values for equality', () => {
      const template = Handlebars.compile('{{#if (eq a b)}}equal{{else}}not equal{{/if}}');
      expect(template({ a: 5, b: 5 })).toBe('equal');
      expect(template({ a: 5, b: 10 })).toBe('not equal');
    });

    test('given ne helper, should compare two values for inequality', () => {
      const template = Handlebars.compile('{{#if (ne a b)}}not equal{{else}}equal{{/if}}');
      expect(template({ a: 5, b: 10 })).toBe('not equal');
      expect(template({ a: 5, b: 5 })).toBe('equal');
    });

    test('given gt helper, should check if first value is greater than second', () => {
      const template = Handlebars.compile('{{#if (gt a b)}}greater{{else}}not greater{{/if}}');
      expect(template({ a: 10, b: 5 })).toBe('greater');
      expect(template({ a: 5, b: 10 })).toBe('not greater');
    });

    test('given lt helper, should check if first value is less than second', () => {
      const template = Handlebars.compile('{{#if (lt a b)}}less{{else}}not less{{/if}}');
      expect(template({ a: 5, b: 10 })).toBe('less');
      expect(template({ a: 10, b: 5 })).toBe('not less');
    });

    test('given gte helper, should check if first value is greater than or equal to second', () => {
      const template = Handlebars.compile('{{#if (gte a b)}}greater or equal{{else}}less{{/if}}');
      expect(template({ a: 10, b: 10 })).toBe('greater or equal');
      expect(template({ a: 10, b: 5 })).toBe('greater or equal');
      expect(template({ a: 5, b: 10 })).toBe('less');
    });

    test('given lte helper, should check if first value is less than or equal to second', () => {
      const template = Handlebars.compile('{{#if (lte a b)}}less or equal{{else}}greater{{/if}}');
      expect(template({ a: 5, b: 5 })).toBe('less or equal');
      expect(template({ a: 5, b: 10 })).toBe('less or equal');
      expect(template({ a: 10, b: 5 })).toBe('greater');
    });
  });

  describe('logic helpers', () => {
    test('given and helper, should return true if all arguments are truthy', () => {
      const template = Handlebars.compile('{{#if (and a b)}}both true{{else}}not both true{{/if}}');
      expect(template({ a: true, b: true })).toBe('both true');
      expect(template({ a: true, b: false })).toBe('not both true');
      expect(template({ a: false, b: true })).toBe('not both true');
    });

    test('given or helper, should return true if any argument is truthy', () => {
      const template = Handlebars.compile('{{#if (or a b)}}at least one true{{else}}both false{{/if}}');
      expect(template({ a: true, b: false })).toBe('at least one true');
      expect(template({ a: false, b: true })).toBe('at least one true');
      expect(template({ a: false, b: false })).toBe('both false');
    });

    test('given not helper, should return negation of value', () => {
      const template = Handlebars.compile('{{#if (not a)}}false{{else}}true{{/if}}');
      expect(template({ a: false })).toBe('false');
      expect(template({ a: true })).toBe('true');
    });
  });

  describe('data helpers', () => {
    test('given contains helper, should check if array contains value', () => {
      const template = Handlebars.compile('{{#if (contains arr val)}}contains{{else}}does not contain{{/if}}');
      expect(template({ arr: [1, 2, 3], val: 2 })).toBe('contains');
      expect(template({ arr: [1, 2, 3], val: 5 })).toBe('does not contain');
    });

    test('given contains helper, should check if string contains substring', () => {
      const template = Handlebars.compile('{{#if (contains str sub)}}contains{{else}}does not contain{{/if}}');
      expect(template({ str: 'hello world', sub: 'world' })).toBe('contains');
      expect(template({ str: 'hello world', sub: 'foo' })).toBe('does not contain');
    });

    test('given isEmpty helper, should check if value is empty', () => {
      const template = Handlebars.compile('{{#if (isEmpty val)}}empty{{else}}not empty{{/if}}');
      expect(template({ val: '' })).toBe('empty');
      expect(template({ val: [] })).toBe('empty');
      expect(template({ val: null })).toBe('empty');
      expect(template({ val: undefined })).toBe('empty');
      expect(template({ val: 'hello' })).toBe('not empty');
      expect(template({ val: [1, 2] })).toBe('not empty');
    });

    test('given json helper, should stringify objects to JSON', () => {
      const template = Handlebars.compile('{{json obj}}');
      expect(template({ obj: { name: 'John', age: 30 } })).toBe('{"name":"John","age":30}');
      expect(template({ obj: [1, 2, 3] })).toBe('[1,2,3]');
      expect(template({ obj: null })).toBe('null');
      expect(template({ obj: [] })).toBe('[]');
      expect(template({ obj: {} })).toBe('{}');
      // JSON.stringify(undefined) returns undefined, but helper normalizes to valid JSON
      expect(template({ obj: undefined })).toBe('null');
    });

    test('given json helper with fallback, should use fallback for null/undefined', () => {
      const template = Handlebars.compile('{{json obj "[]"}}');
      expect(template({ obj: undefined })).toBe('[]');
      expect(template({ obj: null })).toBe('[]');
    });

    test('given json helper with nested arrays, should stringify correctly', () => {
      const template = Handlebars.compile('{{json contacts}}');
      const contacts = [
        { name: 'John', phone: '123-456-7890' },
        { name: 'Jane', phone: '098-765-4321' },
      ];
      const result = template({ contacts });
      expect(result).toBe('[{"name":"John","phone":"123-456-7890"},{"name":"Jane","phone":"098-765-4321"}]');
    });

    test('given json helper in JSON template, should work correctly', () => {
      // Test that json helper works when embedded in a JSON string template
      // Use whitespace control {{~json ...~}} to prevent parse errors with closing braces
      const template = Handlebars.compile('{"email":"{{email}}","contacts":{{~json contacts~}}}');
      const contacts = [
        { name: 'John', phone: '123-456-7890' },
      ];
      const result = template({ email: 'test@example.com', contacts });
      expect(result).toBe('{"email":"test@example.com","contacts":[{"name":"John","phone":"123-456-7890"}]}');
    });
  });

  describe('nested data access', () => {
    test('given context access, should enable nested form data access via dot notation', () => {
      const template = Handlebars.compile('{{user.name}} - {{user.email}}');
      const context = {
        user: {
          name: 'John Doe',
          email: 'john@example.com',
        },
      };
      expect(template(context)).toBe('John Doe - john@example.com');
    });

    test('given nested object access, should access deeply nested properties', () => {
      const template = Handlebars.compile('{{person.address.city}}');
      const context = {
        person: {
          address: {
            city: 'New York',
          },
        },
      };
      expect(template(context)).toBe('New York');
    });
  });
});
