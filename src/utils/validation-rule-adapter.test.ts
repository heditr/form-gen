/**
 * Tests for validation rule adapter
 * 
 * Following TDD: Tests verify conversion of ValidationRule[] to react-hook-form
 * validation rules and Zod schema works correctly.
 */

import { describe, test, expect } from 'vitest';
import { z } from 'zod';
import {
  convertToReactHookFormRules,
  convertToZodSchema,
} from './validation-rule-adapter';
import type { ValidationRule } from '@/types/form-descriptor';

describe('validation rule adapter', () => {
  describe('convertToReactHookFormRules', () => {
    test('given required rule, should map to react-hook-form required validation', () => {
      const rules: ValidationRule[] = [
        { type: 'required', message: 'This field is required' },
      ];

      const result = convertToReactHookFormRules(rules);

      expect(result.required).toBe('This field is required');
    });

    test('given minLength rule, should map to react-hook-form minLength validation', () => {
      const rules: ValidationRule[] = [
        { type: 'minLength', value: 3, message: 'Must be at least 3 characters' },
      ];

      const result = convertToReactHookFormRules(rules);

      expect(result.minLength).toEqual({
        value: 3,
        message: 'Must be at least 3 characters',
      });
    });

    test('given maxLength rule, should map to react-hook-form maxLength validation', () => {
      const rules: ValidationRule[] = [
        { type: 'maxLength', value: 10, message: 'Must be at most 10 characters' },
      ];

      const result = convertToReactHookFormRules(rules);

      expect(result.maxLength).toEqual({
        value: 10,
        message: 'Must be at most 10 characters',
      });
    });

    test('given pattern rule, should map to react-hook-form pattern validation', () => {
      const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const rules: ValidationRule[] = [
        { type: 'pattern', value: regex, message: 'Invalid email format' },
      ];

      const result = convertToReactHookFormRules(rules);

      expect(result.pattern).toEqual({
        value: regex,
        message: 'Invalid email format',
      });
    });

    test('given custom rule, should map to react-hook-form validate function', () => {
      const customValidator = (value: any) => value === 'valid' || 'Value must be "valid"';
      const rules: ValidationRule[] = [
        { type: 'custom', value: customValidator, message: 'Custom validation failed' },
      ];

      const result = convertToReactHookFormRules(rules);

      expect(typeof result.validate).toBe('function');
      expect(result.validate('valid')).toBe(true);
      expect(result.validate('invalid')).toBe('Custom validation failed');
    });

    test('given multiple rules, should combine into single validation object', () => {
      const rules: ValidationRule[] = [
        { type: 'required', message: 'Required' },
        { type: 'minLength', value: 3, message: 'Min 3 chars' },
        { type: 'maxLength', value: 10, message: 'Max 10 chars' },
      ];

      const result = convertToReactHookFormRules(rules);

      expect(result.required).toBe('Required');
      expect(result.minLength).toEqual({ value: 3, message: 'Min 3 chars' });
      expect(result.maxLength).toEqual({ value: 10, message: 'Max 10 chars' });
    });

    test('given empty rules array, should return empty object', () => {
      const rules: ValidationRule[] = [];

      const result = convertToReactHookFormRules(rules);

      expect(result).toEqual({});
    });

    test('given custom rule with function that returns boolean, should use message on false', () => {
      const customValidator = (value: any) => value.length > 5;
      const rules: ValidationRule[] = [
        { type: 'custom', value: customValidator, message: 'Must be longer than 5 characters' },
      ];

      const result = convertToReactHookFormRules(rules);

      expect(result.validate('short')).toBe('Must be longer than 5 characters');
      expect(result.validate('longer value')).toBe(true);
    });
  });

  describe('convertToZodSchema', () => {
    test('given required rule, should create Zod schema with required validation', () => {
      const rules: ValidationRule[] = [
        { type: 'required', message: 'This field is required' },
      ];

      const schema = convertToZodSchema(rules, 'text');

      const result = schema.safeParse('');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('This field is required');
      }

      const successResult = schema.safeParse('value');
      expect(successResult.success).toBe(true);
    });

    test('given minLength rule, should create Zod schema with min validation', () => {
      const rules: ValidationRule[] = [
        { type: 'minLength', value: 3, message: 'Must be at least 3 characters' },
      ];

      const schema = convertToZodSchema(rules, 'text');

      const result = schema.safeParse('ab');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Must be at least 3 characters');
      }

      const successResult = schema.safeParse('abc');
      expect(successResult.success).toBe(true);
    });

    test('given maxLength rule, should create Zod schema with max validation', () => {
      const rules: ValidationRule[] = [
        { type: 'maxLength', value: 5, message: 'Must be at most 5 characters' },
      ];

      const schema = convertToZodSchema(rules, 'text');

      const result = schema.safeParse('toolong');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Must be at most 5 characters');
      }

      const successResult = schema.safeParse('short');
      expect(successResult.success).toBe(true);
    });

    test('given pattern rule, should create Zod schema with regex validation', () => {
      const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const rules: ValidationRule[] = [
        { type: 'pattern', value: regex, message: 'Invalid email format' },
      ];

      const schema = convertToZodSchema(rules, 'text');

      const result = schema.safeParse('invalid-email');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid email format');
      }

      const successResult = schema.safeParse('test@example.com');
      expect(successResult.success).toBe(true);
    });

    test('given pattern rule as string from JSON, should convert to RegExp and validate correctly', () => {
      // Simulate pattern coming from JSON API (like phone number validation)
      const patternString = '^\\(\\d{3}\\) \\d{3}-\\d{4}$'; // This is what comes from JSON.parse
      const rules: ValidationRule[] = [
        { type: 'pattern', value: patternString as unknown as RegExp, message: 'Phone number must be in format (XXX) XXX-XXXX' },
      ];

      const schema = convertToZodSchema(rules, 'text');

      const invalidResult = schema.safeParse('1234567890');
      expect(invalidResult.success).toBe(false);
      if (!invalidResult.success) {
        expect(invalidResult.error.issues[0].message).toBe('Phone number must be in format (XXX) XXX-XXXX');
      }

      const validResult = schema.safeParse('(123) 456-7890');
      expect(validResult.success).toBe(true);
    });

    test('given custom rule, should create Zod schema with refine validation', () => {
      const customValidator = (value: unknown) => value === 'valid';
      const rules: ValidationRule[] = [
        { type: 'custom', value: customValidator, message: 'Value must be "valid"' },
      ];

      const schema = convertToZodSchema(rules, 'text');

      const result = schema.safeParse('invalid');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Value must be "valid"');
      }

      const successResult = schema.safeParse('valid');
      expect(successResult.success).toBe(true);
    });

    test('given multiple rules, should combine into single Zod schema', () => {
      const rules: ValidationRule[] = [
        { type: 'required', message: 'Required' },
        { type: 'minLength', value: 3, message: 'Min 3 chars' },
        { type: 'maxLength', value: 10, message: 'Max 10 chars' },
      ];

      const schema = convertToZodSchema(rules, 'text');

      const emptyResult = schema.safeParse('');
      expect(emptyResult.success).toBe(false);

      const shortResult = schema.safeParse('ab');
      expect(shortResult.success).toBe(false);

      const longResult = schema.safeParse('this is too long');
      expect(longResult.success).toBe(false);

      const validResult = schema.safeParse('valid');
      expect(validResult.success).toBe(true);
    });

    test('given empty rules array, should return Zod string schema without validations', () => {
      const rules: ValidationRule[] = [];

      const schema = convertToZodSchema(rules, 'text');

      const result = schema.safeParse('any value');
      expect(result.success).toBe(true);
    });

    test('given required and minLength together, should apply both validations', () => {
      const rules: ValidationRule[] = [
        { type: 'required', message: 'Required' },
        { type: 'minLength', value: 3, message: 'Min 3 chars' },
      ];

      const schema = convertToZodSchema(rules, 'text');

      const emptyResult = schema.safeParse('');
      expect(emptyResult.success).toBe(false);

      const shortResult = schema.safeParse('ab');
      expect(shortResult.success).toBe(false);

      const validResult = schema.safeParse('abc');
      expect(validResult.success).toBe(true);
    });

    test('given number field type, should create Zod number schema', () => {
      const rules: ValidationRule[] = [];

      const schema = convertToZodSchema(rules, 'number');

      const stringResult = schema.safeParse('not a number');
      expect(stringResult.success).toBe(false);

      const numberResult = schema.safeParse(42);
      expect(numberResult.success).toBe(true);
    });

    test('given number field with required rule, should validate number is not NaN', () => {
      const rules: ValidationRule[] = [
        { type: 'required', message: 'Number is required' },
      ];

      const schema = convertToZodSchema(rules, 'number');

      const undefinedResult = schema.safeParse(undefined);
      expect(undefinedResult.success).toBe(false);

      const nanResult = schema.safeParse(NaN);
      expect(nanResult.success).toBe(false);

      const validResult = schema.safeParse(42);
      expect(validResult.success).toBe(true);
    });

    test('given number field with custom rule, should apply custom validation', () => {
      const customValidator = (value: unknown) => typeof value === 'number' && value > 0;
      const rules: ValidationRule[] = [
        { type: 'custom', value: customValidator, message: 'Must be positive' },
      ];

      const schema = convertToZodSchema(rules, 'number');

      const negativeResult = schema.safeParse(-5);
      expect(negativeResult.success).toBe(false);
      if (!negativeResult.success) {
        expect(negativeResult.error.issues[0].message).toBe('Must be positive');
      }

      const positiveResult = schema.safeParse(5);
      expect(positiveResult.success).toBe(true);
    });
  });
});
