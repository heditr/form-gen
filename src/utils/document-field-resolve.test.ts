import { describe, test, expect } from 'vitest';
import { resolveFieldByIdFromDescriptor } from './document-field-resolve';
import type { FieldDescriptor, GlobalFormDescriptor } from '@/types/form-descriptor';

describe('resolveFieldByIdFromDescriptor', () => {
  const fieldA: FieldDescriptor = {
    id: 'a',
    type: 'text',
    label: 'A',
    validation: [],
  };

  const desc: GlobalFormDescriptor = {
    version: '1',
    blocks: [
      { id: 'b1', title: 'B1', layout: 'stack', fields: [fieldA] },
      { id: 'b2', title: 'B2', layout: 'stack', fields: [] },
    ],
    submission: {},
  };

  test('given a nested id, should find the field', () => {
    expect(resolveFieldByIdFromDescriptor(desc, 'a')).toBe(fieldA);
  });

  test('given unknown id, should return null', () => {
    expect(resolveFieldByIdFromDescriptor(desc, 'missing')).toBeNull();
  });
});
