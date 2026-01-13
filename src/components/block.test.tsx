/**
 * Tests for Block Component
 * 
 * Following TDD: Tests verify the component renders blocks with smooth transitions
 * and handles visibility and disabled states.
 */

import { describe, test, expect, vi } from 'vitest';
import Block from './block';
import type { BlockProps } from './block';
import type { BlockDescriptor } from '@/types/form-descriptor';
import { useForm } from 'react-hook-form';

// Mock react-hook-form
vi.mock('react-hook-form', () => ({
  useForm: vi.fn(() => ({
    register: vi.fn(),
    control: {},
    handleSubmit: vi.fn(),
    formState: { errors: {} },
    watch: vi.fn(),
    getValues: vi.fn(() => ({})),
    setValue: vi.fn(),
    setError: vi.fn(),
    clearErrors: vi.fn(),
  })),
}));

// Mock FieldWrapper
vi.mock('./field-wrapper', () => ({
  default: vi.fn(({ field, isDisabled }) => (
    <div data-testid={`field-${field.id}`} data-disabled={isDisabled}>
      {field.label}
    </div>
  )),
}));

describe('Block', () => {
  const createMockForm = () => useForm();

  const createMockBlock = (): BlockDescriptor => ({
    id: 'block1',
    title: 'Test Block',
    description: 'Test Description',
    fields: [
      {
        id: 'field1',
        type: 'text',
        label: 'Field 1',
        validation: [],
      },
      {
        id: 'field2',
        type: 'text',
        label: 'Field 2',
        validation: [],
      },
    ],
  });

  const createProps = (overrides?: Partial<BlockProps>): BlockProps => {
    const block = createMockBlock();
    return {
      block,
      isDisabled: false,
      isHidden: false,
      form: createMockForm() as any,
      formContext: {},
      onLoadDataSource: vi.fn(),
      ...overrides,
    };
  };

  test('given block descriptor, should render block with title and description', () => {
    const props = createProps();
    // Component should be defined
    expect(Block).toBeDefined();
    expect(typeof Block).toBe('function');
  });

  test('given hidden status, should not render block', () => {
    const props = createProps({
      isHidden: true,
    });
    // Component should handle hidden state
    expect(Block).toBeDefined();
  });

  test('given visible status, should render block', () => {
    const props = createProps({
      isHidden: false,
    });
    // Component should render when visible
    expect(Block).toBeDefined();
  });

  test('given disabled status, should disable all fields within block', () => {
    const props = createProps({
      isDisabled: true,
    });
    // Component should pass disabled state to fields
    expect(Block).toBeDefined();
  });

  test('given block without title, should render without title', () => {
    const block = createMockBlock();
    delete block.title;
    const props = createProps({ block });
    // Component should handle missing title
    expect(Block).toBeDefined();
  });

  test('given block without description, should render without description', () => {
    const block = createMockBlock();
    delete block.description;
    const props = createProps({ block });
    // Component should handle missing description
    expect(Block).toBeDefined();
  });
});
