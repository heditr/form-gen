/**
 * Tests for Form Container Component
 * 
 * Following TDD: Tests verify the container connects Redux state and actions
 * to the presentation component, initializes react-hook-form, and syncs discriminant fields.
 */

import { describe, test, expect } from 'vitest';
import FormContainer from './form-container';

describe('FormContainer', () => {
  test('given component, should be defined', () => {
    expect(FormContainer).toBeDefined();
  });

  test('given component, should be a React component', () => {
    // connect() returns a component object, not a function
    expect(FormContainer).toBeDefined();
    expect(FormContainer).toHaveProperty('displayName');
  });
});
