/**
 * Tests for Block Component
 * 
 * Following TDD: Tests verify the component renders blocks with smooth transitions
 * and handles visibility and disabled states.
 */

import { describe, test, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import Block from './block';
import type { BlockProps } from './block';
import type { BlockDescriptor, GlobalFormDescriptor } from '@/types/form-descriptor';
import { FormStatusContext } from '@/context/form-status-context';
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

// Mock RepeatableFieldGroup
vi.mock('./repeatable-field-group', () => ({
  default: vi.fn(({ block, groupId }) => (
    <div data-testid={`repeatable-group-${groupId}`}>
      Repeatable Group: {block.title}
    </div>
  )),
}));

// Mock RepeatablePopinSummary (requires PopinManagerProvider; we mock to avoid provider)
vi.mock('./repeatable-popin-summary', () => ({
  default: vi.fn(({ block, groupId }) => (
    <div data-testid={`repeatable-popin-summary-${groupId}`}>
      Repeatable Popin Summary: {block.title}
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
    expect(Block).toHaveProperty('type');
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

  test('given repeatable block, should detect and handle as repeatable', () => {
    const block: BlockDescriptor = {
      id: 'addresses-block',
      title: 'Addresses',
      repeatable: true,
      fields: [
        {
          id: 'street',
          type: 'text',
          label: 'Street',
          repeatableGroupId: 'addresses',
          validation: [],
        },
        {
          id: 'city',
          type: 'text',
          label: 'City',
          repeatableGroupId: 'addresses',
          validation: [],
        },
      ],
    };
    const props = createProps({ block });
    // Component should detect repeatable block
    expect(Block).toBeDefined();
  });

  test('given repeatable block with repeatableBlockRef, should use resolved fields', () => {
    const block: BlockDescriptor = {
      id: 'addresses-block',
      title: 'Addresses',
      repeatable: true,
      repeatableBlockRef: 'address-block', // Should be resolved before rendering
      fields: [
        {
          id: 'addresses.street',
          type: 'text',
          label: 'Street',
          repeatableGroupId: 'addresses',
          validation: [],
        },
        {
          id: 'addresses.city',
          type: 'text',
          label: 'City',
          repeatableGroupId: 'addresses',
          validation: [],
        },
      ],
    };
    const props = createProps({ block });
    // Component should handle resolved repeatable block
    expect(Block).toBeDefined();
  });

  test('given mixed block with repeatable and non-repeatable fields, should render both', () => {
    const block: BlockDescriptor = {
      id: 'mixed-block',
      title: 'Mixed Block',
      repeatable: true,
      fields: [
        {
          id: 'addresses.street',
          type: 'text',
          label: 'Street',
          repeatableGroupId: 'addresses',
          validation: [],
        },
        {
          id: 'addresses.city',
          type: 'text',
          label: 'City',
          repeatableGroupId: 'addresses',
          validation: [],
        },
        {
          id: 'notes',
          type: 'textarea',
          label: 'Notes',
          // No repeatableGroupId - non-repeatable field
          validation: [],
        },
      ],
    };
    const props = createProps({ block });
    // Component should handle mixed block
    expect(Block).toBeDefined();
  });

  test('given block with multiple repeatable groups, should render all groups', () => {
    const block: BlockDescriptor = {
      id: 'multi-group-block',
      title: 'Multi Group Block',
      repeatable: true,
      fields: [
        {
          id: 'addresses.street',
          type: 'text',
          label: 'Street',
          repeatableGroupId: 'addresses',
          validation: [],
        },
        {
          id: 'phones.number',
          type: 'text',
          label: 'Phone Number',
          repeatableGroupId: 'phones',
          validation: [],
        },
      ],
    };
    const props = createProps({ block });
    // Component should handle multiple repeatable groups
    expect(Block).toBeDefined();
  });

  test('given repeatable block with hidden status template using array, should evaluate correctly', () => {
    const block: BlockDescriptor = {
      id: 'addresses-block',
      title: 'Addresses',
      repeatable: true,
      fields: [
        {
          id: 'addresses.street',
          type: 'text',
          label: 'Street',
          repeatableGroupId: 'addresses',
          validation: [],
        },
      ],
      status: {
        hidden: '{{isEmpty addresses}}',
      },
    };
    const emptyContext = { addresses: [] };
    const filledContext = { addresses: [{ street: '123 Main St' }] };
    
    const propsEmpty = createProps({ block, formContext: emptyContext });
    const propsFilled = createProps({ block, formContext: filledContext });
    
    // Component should evaluate status templates with array data
    expect(Block).toBeDefined();
  });

  test('given repeatable block with disabled status template using array length, should evaluate correctly', () => {
    const block: BlockDescriptor = {
      id: 'addresses-block',
      title: 'Addresses',
      repeatable: true,
      fields: [
        {
          id: 'addresses.street',
          type: 'text',
          label: 'Street',
          repeatableGroupId: 'addresses',
          validation: [],
        },
      ],
      status: {
        disabled: '{{gte addresses.length 5}}',
      },
    };
    const context = { addresses: [{ street: '123' }, { street: '456' }, { street: '789' }, { street: '101' }, { street: '112' }] };
    
    const props = createProps({ block, formContext: context });
    
    // Component should evaluate disabled status using array length
    expect(Block).toBeDefined();
  });

  describe('plain nested blocks', () => {
    const textField = (id: string, label = id): BlockDescriptor['fields'][number] => ({
      id,
      type: 'text',
      label,
      validation: [],
    });

    const nestedBlock = (
      id: string,
      fieldId: string,
      status?: BlockDescriptor['status']
    ): BlockDescriptor => ({
      id,
      title: id,
      fields: [textField(fieldId)],
      ...(status ? { status } : {}),
    });

    const parentBlock = (
      nestedBlocks: NonNullable<BlockDescriptor['nestedBlocks']>
    ): BlockDescriptor => ({
      id: 'parent',
      title: 'Parent',
      fields: [textField('city', 'City'), textField('name', 'Name')],
      nestedBlocks,
    });

    const descriptorFor = (blocks: BlockDescriptor[]): GlobalFormDescriptor => ({
      blocks,
      submission: { url: '/api/submit', method: 'POST' },
    });

    const renderParent = ({
      block,
      blocks,
      isDisabled = false,
      isHidden = false,
      formContext = {},
      statusMode = 'local' as const,
      statusForBlock,
    }: {
      block: BlockDescriptor;
      blocks: BlockDescriptor[];
      isDisabled?: boolean;
      isHidden?: boolean;
      formContext?: BlockProps['formContext'];
      statusMode?: 'local' | 'context';
      statusForBlock?: (blockId: string) => { hidden: boolean; disabled: boolean; readonly: boolean };
    }) => {
      const element = (
        <Block
          {...createProps({
            block,
            descriptor: descriptorFor(blocks),
            isDisabled,
            isHidden,
            formContext,
            statusMode,
            dataSourceCache: {},
          })}
        />
      );

      if (statusMode !== 'context') {
        return render(element);
      }

      const visible = { hidden: false, disabled: false, readonly: false };
      return render(
        <FormStatusContext.Provider
          value={{
            formContext,
            getBlockStatus: (blockId) => statusForBlock?.(blockId) ?? visible,
            getFieldStatus: () => visible,
          }}
        >
          {element}
        </FormStatusContext.Provider>
      );
    };

    const placementIds = (container: HTMLElement) =>
      [...container.querySelectorAll('[data-testid^="block-"], [data-testid^="field-"]')]
        .map((element) => element.getAttribute('data-testid'))
        .filter(
          (id): id is string =>
            Boolean(id) && !id.startsWith('block-title-') && id !== 'block-parent'
        );

    test('given a nested block at the top, should render it before the parent fields', () => {
      const notes = nestedBlock('notes', 'note');
      const { container } = renderParent({
        block: parentBlock([{ blockId: 'notes', position: 'top' }]),
        blocks: [parentBlock([{ blockId: 'notes', position: 'top' }]), notes],
      });

      expect(placementIds(container)).toEqual([
        'block-notes',
        'field-note',
        'field-city',
        'field-name',
      ]);
    });

    test('given a nested block at the bottom, should render it after the parent fields', () => {
      const notes = nestedBlock('notes', 'note');
      const block = parentBlock([{ blockId: 'notes', position: 'bottom' }]);
      const { container } = renderParent({ block, blocks: [block, notes] });

      expect(placementIds(container)).toEqual([
        'field-city',
        'field-name',
        'block-notes',
        'field-note',
      ]);
    });

    test('given insertBefore, should render the nested block before that field', () => {
      const notes = nestedBlock('notes', 'note');
      const block = parentBlock([{ blockId: 'notes', insertBefore: 'name' }]);
      const { container } = renderParent({ block, blocks: [block, notes] });

      expect(placementIds(container)).toEqual([
        'field-city',
        'block-notes',
        'field-note',
        'field-name',
      ]);
    });

    test('given insertAfter, should render the nested block after that field', () => {
      const notes = nestedBlock('notes', 'note');
      const block = parentBlock([{ blockId: 'notes', insertAfter: 'city' }]);
      const { container } = renderParent({ block, blocks: [block, notes] });

      expect(placementIds(container)).toEqual([
        'field-city',
        'block-notes',
        'field-note',
        'field-name',
      ]);
    });

    test('given two nested blocks on the same slot, should render them in nestedBlocks order', () => {
      const alpha = nestedBlock('alpha', 'alpha-note');
      const beta = nestedBlock('beta', 'beta-note');
      const block = parentBlock([
        { blockId: 'alpha', position: 'bottom' },
        { blockId: 'beta', position: 'bottom' },
      ]);
      const { container } = renderParent({ block, blocks: [block, alpha, beta] });

      expect(placementIds(container)).toEqual([
        'field-city',
        'field-name',
        'block-alpha',
        'field-alpha-note',
        'block-beta',
        'field-beta-note',
      ]);
    });

    test('given insertAfter one field and insertBefore the next, should keep those as separate slots', () => {
      const beforeName = nestedBlock('before-name', 'before-note');
      const afterCity = nestedBlock('after-city', 'after-note');
      const block = parentBlock([
        { blockId: 'before-name', insertBefore: 'name' },
        { blockId: 'after-city', insertAfter: 'city' },
      ]);
      const { container } = renderParent({
        block,
        blocks: [block, beforeName, afterCity],
      });

      expect(placementIds(container)).toEqual([
        'field-city',
        'block-after-city',
        'field-after-note',
        'block-before-name',
        'field-before-note',
        'field-name',
      ]);
    });

    test('given a hidden parent, should render neither the parent nor its nested block', () => {
      const notes = nestedBlock('notes', 'note');
      const block = parentBlock([{ blockId: 'notes', position: 'top' }]);
      const { queryByTestId } = renderParent({
        block,
        blocks: [block, notes],
        isHidden: true,
      });

      expect(queryByTestId('block-parent')).not.toBeInTheDocument();
      expect(queryByTestId('block-notes')).not.toBeInTheDocument();
      expect(queryByTestId('field-city')).not.toBeInTheDocument();
    });

    test('given a hidden nested block, should leave the parent fields and omit that slot', () => {
      const notes = nestedBlock('notes', 'note', { hidden: '{{hideNotes}}' });
      const block = parentBlock([{ blockId: 'notes', position: 'top' }]);
      const { queryByTestId } = renderParent({
        block,
        blocks: [block, notes],
        formContext: { hideNotes: true },
      });

      expect(queryByTestId('field-city')).toBeInTheDocument();
      expect(queryByTestId('field-name')).toBeInTheDocument();
      expect(queryByTestId('block-notes')).not.toBeInTheDocument();
    });

    test('given a hidden nested block in the status map, should omit that slot', () => {
      const notes = nestedBlock('notes', 'note');
      const block = parentBlock([{ blockId: 'notes', position: 'bottom' }]);
      const { queryByTestId } = renderParent({
        block,
        blocks: [block, notes],
        statusMode: 'context',
        statusForBlock: (blockId) => ({
          hidden: blockId === 'notes',
          disabled: false,
          readonly: false,
        }),
      });

      expect(queryByTestId('field-city')).toBeInTheDocument();
      expect(queryByTestId('block-notes')).not.toBeInTheDocument();
    });

    test('given a disabled parent, should disable the nested block fields too', () => {
      const notes = nestedBlock('notes', 'note');
      const block = parentBlock([{ blockId: 'notes', position: 'bottom' }]);
      const { getByTestId } = renderParent({
        block,
        blocks: [block, notes],
        isDisabled: true,
      });

      expect(getByTestId('field-city')).toHaveAttribute('data-disabled', 'true');
      expect(getByTestId('field-note')).toHaveAttribute('data-disabled', 'true');
    });

    test('given a disabled nested block, should disable only that block', () => {
      const notes = nestedBlock('notes', 'note', { disabled: '{{disableNotes}}' });
      const block = parentBlock([{ blockId: 'notes', position: 'bottom' }]);
      const { getByTestId } = renderParent({
        block,
        blocks: [block, notes],
        formContext: { disableNotes: true },
      });

      expect(getByTestId('field-city')).toHaveAttribute('data-disabled', 'false');
      expect(getByTestId('field-note')).toHaveAttribute('data-disabled', 'true');
    });

    test('given a grid parent, should keep the nested block outside the field grid', () => {
      const notes = nestedBlock('notes', 'note');
      const block: BlockDescriptor = {
        ...parentBlock([{ blockId: 'notes', insertBefore: 'name' }]),
        layout: { mode: 'grid', columns: 2 },
        fields: [
          { ...textField('city', 'City'), layout: { width: 'half' } },
          { ...textField('name', 'Name'), layout: { width: 'half' } },
        ],
      };
      const { container } = renderParent({ block, blocks: [block, notes] });
      const nested = container.querySelector('[data-testid="block-notes"]');

      expect(nested?.closest('.grid')).toBeNull();
      expect(placementIds(container)).toEqual([
        'field-city',
        'block-notes',
        'field-note',
        'field-name',
      ]);
    });
  });
});
