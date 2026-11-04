/**
 * Tests for RepeatableRowFields.
 *
 * Renders the fields of one repeatable row at any form path, so a root row
 * (`businessSectors.0`) and a child row (`businessSectors.0.subsectors.1`)
 * share one implementation.
 */

import { describe, test, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { BlockDescriptor, FieldDescriptor } from '@/types/form-descriptor';
import type { FormContext } from '@/utils/template-evaluator';
import { registerHandlebarsHelpers } from '@/utils/handlebars-helpers';
import RepeatableRowFields from './repeatable-row-fields';

type FieldWrapperMockProps = {
  field: FieldDescriptor;
  isHidden?: boolean;
  isDisabled?: boolean;
  isReadonly?: boolean;
  formContext?: FormContext;
  onAutoFillSelection?: (fieldId: string, selectedPayload: Record<string, unknown> | null) => void;
};

const fieldWrapperMock = vi.fn(({ field, isHidden, isDisabled, isReadonly }: FieldWrapperMockProps) =>
  isHidden ? null : (
    <div
      data-testid={`field-${field.id}`}
      data-disabled={String(isDisabled ?? false)}
      data-readonly={String(isReadonly ?? false)}
    >
      {field.label}
    </div>
  )
);

vi.mock('./field-wrapper', () => ({
  default: (props: FieldWrapperMockProps) => fieldWrapperMock(props),
}));

const baseFields: FieldDescriptor[] = [
  { id: 'businessSectors.sector', type: 'text', label: 'Sector', repeatableGroupId: 'businessSectors', validation: [] },
  { id: 'businessSectors.percentage', type: 'text', label: 'Percentage', repeatableGroupId: 'businessSectors', validation: [] },
];

const blockOf = (fields: FieldDescriptor[] = baseFields, layout?: BlockDescriptor['layout']): BlockDescriptor => ({
  id: 'business-sectors-block',
  title: 'Business sector',
  repeatable: true,
  fields,
  ...(layout ? { layout } : {}),
});

type HarnessProps = {
  fields?: FieldDescriptor[];
  rowPath: string;
  rowContext?: FormContext;
  isDisabled?: boolean;
  isReadonly?: boolean;
  layout?: BlockDescriptor['layout'];
  defaultValues?: FieldValues;
  onForm?: (form: UseFormReturn<FieldValues>) => void;
};

function Harness({
  fields = baseFields,
  rowPath,
  rowContext = {},
  isDisabled = false,
  isReadonly = false,
  layout,
  defaultValues = {},
  onForm,
}: HarnessProps) {
  const form = useForm<FieldValues>({ defaultValues });
  onForm?.(form);
  return (
    <RepeatableRowFields
      block={blockOf(fields, layout)}
      groupId="businessSectors"
      fields={fields}
      rowPath={rowPath}
      rowContext={rowContext}
      isDisabled={isDisabled}
      isReadonly={isReadonly}
      form={form}
      onLoadDataSource={vi.fn()}
      dataSourceCache={{}}
    />
  );
}

describe('RepeatableRowFields', () => {
  beforeAll(() => {
    registerHandlebarsHelpers();
  });

  beforeEach(() => {
    fieldWrapperMock.mockClear();
  });

  test('given a root row path, should render each field under the indexed path', () => {
    render(<Harness rowPath="businessSectors.0" />);

    expect(screen.getByTestId('field-businessSectors.0.sector')).toBeInTheDocument();
    expect(screen.getByTestId('field-businessSectors.0.percentage')).toBeInTheDocument();
  });

  test('given a child row path, should render each field under the child path', () => {
    render(<Harness rowPath="businessSectors.1.subsectors.2" />);

    expect(screen.getByTestId('field-businessSectors.1.subsectors.2.sector')).toBeInTheDocument();
  });

  test('given disabled and readonly rows, should pass both to every field', () => {
    render(<Harness rowPath="businessSectors.0" isDisabled isReadonly />);

    expect(screen.getByTestId('field-businessSectors.0.sector')).toHaveAttribute('data-disabled', 'true');
    expect(screen.getByTestId('field-businessSectors.0.sector')).toHaveAttribute('data-readonly', 'true');
  });

  test('given a hidden template using @index, should evaluate it against the row context', () => {
    const fields = baseFields.map((field) =>
      field.id === 'businessSectors.percentage' ? { ...field, status: { hidden: '{{eq @index 1}}' } } : field
    );

    render(<Harness fields={fields} rowPath="businessSectors.1" rowContext={{ index: 1 }} />);

    expect(screen.queryByTestId('field-businessSectors.1.percentage')).not.toBeInTheDocument();
    expect(screen.getByTestId('field-businessSectors.1.sector')).toBeInTheDocument();
  });

  test('given the row context, should pass it to each field as its form context', () => {
    render(<Harness rowPath="businessSectors.0" rowContext={{ index: 0, depth: 2 }} />);

    expect(fieldWrapperMock.mock.calls[0][0].formContext).toEqual({ index: 0, depth: 2 });
  });

  test('given grid layout, should render fields inside grid rows', () => {
    const { container } = render(
      <Harness rowPath="businessSectors.0" layout={{ mode: 'grid', columns: 2 }} />
    );

    expect(container.querySelector('.grid')).not.toBeNull();
  });

  test('given an autoFill selection on a child row, should write the mapped values under the child path', () => {
    const fields: FieldDescriptor[] = [
      {
        ...baseFields[0],
        id: 'businessSectors.sector',
        autoFill: { mappings: [{ from: 'name', to: 'percentage' }] },
      },
      baseFields[1],
    ];
    let form: UseFormReturn<FieldValues> | undefined;

    render(
      <Harness
        fields={fields}
        rowPath="businessSectors.0.subsectors.1"
        defaultValues={{ businessSectors: [{ subsectors: [{}, { sector: '', percentage: '' }] }] }}
        onForm={(next) => (form = next)}
      />
    );

    const sectorProps = fieldWrapperMock.mock.calls
      .map(([props]) => props)
      .find((props) => props.field.id === 'businessSectors.0.subsectors.1.sector');
    sectorProps?.onAutoFillSelection?.('businessSectors.0.subsectors.1.sector', { name: '42' });

    expect(form?.getValues('businessSectors.0.subsectors.1.percentage')).toBe('42');
  });
});
