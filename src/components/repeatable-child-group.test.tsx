/**
 * Tests for RepeatableChildGroup.
 *
 * The child list of one root row: an indented, labelled fieldset with its own
 * useFieldArray, Add and Remove controls, and per-list limits.
 */

import { describe, test, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { BlockDescriptor, FieldDescriptor, RepeatableChildConfig } from '@/types/form-descriptor';
import type { FormContext } from '@/utils/template-evaluator';
import { registerHandlebarsHelpers } from '@/utils/handlebars-helpers';
import RepeatableChildGroup from './repeatable-child-group';

type FieldWrapperMockProps = {
  field: FieldDescriptor;
  isHidden?: boolean;
  isDisabled?: boolean;
  form?: UseFormReturn<FieldValues>;
  formContext?: FormContext;
};

const fieldWrapperMock = vi.fn(({ field, isHidden, isDisabled, form }: FieldWrapperMockProps) =>
  isHidden ? null : (
    <div
      data-testid={`field-${field.id}`}
      data-value={String(form?.getValues(field.id as never) ?? '')}
      data-disabled={String(isDisabled ?? false)}
    >
      {field.label}
    </div>
  )
);

vi.mock('./field-wrapper', () => ({
  default: (props: FieldWrapperMockProps) => fieldWrapperMock(props),
}));

const mockInvalidateQueriesForBlock = vi.fn().mockResolvedValue(undefined);
const mockFlushDraftSave = vi.fn().mockResolvedValue(undefined);

vi.mock('./popin-manager', () => ({
  useInvalidateQueriesForBlock: () => mockInvalidateQueriesForBlock,
  useFlushDraftSave: () => mockFlushDraftSave,
}));

const fields: FieldDescriptor[] = [
  { id: 'businessSectors.sector', type: 'text', label: 'Sector', repeatableGroupId: 'businessSectors', validation: [] },
  { id: 'businessSectors.percentage', type: 'number', label: 'Percentage', repeatableGroupId: 'businessSectors', validation: [] },
];

const config = (overrides: Partial<RepeatableChildConfig> = {}): RepeatableChildConfig => ({
  property: 'subsectors',
  maxDepth: 2,
  title: 'Subsector',
  addLabel: 'Add subsector',
  triggerField: 'sector',
  triggerValues: ['holding'],
  ...overrides,
});

const block: BlockDescriptor = {
  id: 'business-sectors-block',
  title: 'Business sector',
  repeatable: true,
  repeatableChild: config(),
  fields,
};

type HarnessProps = {
  rootRows: unknown[];
  rootIndex?: number;
  childConfig?: RepeatableChildConfig;
  isDisabled?: boolean;
  onForm?: (form: UseFormReturn<FieldValues>) => void;
};

function Harness({ rootRows, rootIndex = 1, childConfig = config(), isDisabled = false, onForm }: HarnessProps) {
  const form = useForm<FieldValues>({ defaultValues: { businessSectors: rootRows } });
  onForm?.(form);
  const watchedRows = form.watch('businessSectors') as unknown[];
  return (
    <RepeatableChildGroup
      block={block}
      groupId="businessSectors"
      fields={fields}
      config={childConfig}
      rootIndex={rootIndex}
      rootRows={watchedRows}
      isDisabled={isDisabled}
      isReadonly={false}
      form={form}
      formContext={{}}
      onLoadDataSource={vi.fn()}
      dataSourceCache={{}}
    />
  );
}

const twoRoots = (subsectors: unknown[]) => [
  { sector: 'retail', percentage: 30 },
  { sector: 'holding', percentage: 70, subsectors },
];

const sub = (sector: string, percentage = 10) => ({ sector, percentage });

describe('RepeatableChildGroup', () => {
  beforeAll(() => {
    registerHandlebarsHelpers();
  });

  beforeEach(() => {
    fieldWrapperMock.mockClear();
    mockFlushDraftSave.mockClear();
    mockInvalidateQueriesForBlock.mockClear();
  });

  test('given a root row with child rows, should render a labelled fieldset with one child instance per row', () => {
    render(<Harness rootRows={twoRoots([sub('software'), sub('retail')])} />);

    const group = screen.getByRole('group', { name: 'Subsectors of Business sector 2' });
    expect(within(group).getByTestId('repeatable-child-instance-businessSectors-1-0')).toBeInTheDocument();
    expect(within(group).getByTestId('repeatable-child-instance-businessSectors-1-1')).toBeInTheDocument();
  });

  test('given child rows, should render each field at the dot-index child path', () => {
    render(<Harness rootRows={twoRoots([sub('software'), sub('retail', 20)])} />);

    expect(screen.getByTestId('field-businessSectors.1.subsectors.1.percentage')).toHaveAttribute('data-value', '20');
  });

  test('given child rows, should give each Remove button a unique accessible name and each row a heading', () => {
    render(<Harness rootRows={twoRoots([sub('software'), sub('retail')])} />);

    expect(screen.getByRole('button', { name: 'Remove subsector 1 of business sector 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove subsector 2 of business sector 2' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Subsector 1 of business sector 2' })).toBeInTheDocument();
  });

  test('given child rows, should expose depth, parentIndex and the list index to child row templates', () => {
    render(<Harness rootRows={twoRoots([sub('software'), sub('retail')])} />);

    const childCall = fieldWrapperMock.mock.calls
      .map(([props]) => props)
      .find((props) => props.field.id === 'businessSectors.1.subsectors.1.sector');
    expect(childCall?.formContext).toMatchObject({ index: 1, first: false, last: true, depth: 2, parentIndex: 1 });
  });

  test('given an empty child list, should render the fieldset with only the Add control', () => {
    render(<Harness rootRows={twoRoots([])} />);

    expect(screen.getByRole('group', { name: 'Subsectors of Business sector 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add subsector' })).toBeEnabled();
    expect(screen.queryByTestId('repeatable-child-instance-businessSectors-1-0')).not.toBeInTheDocument();
  });

  test('given the user clicks Add, should append one child row with field defaults under the child path', async () => {
    let form: UseFormReturn<FieldValues> | undefined;
    render(<Harness rootRows={twoRoots([sub('software')])} onForm={(next) => (form = next)} />);

    await userEvent.click(screen.getByRole('button', { name: 'Add subsector' }));

    expect(form?.getValues('businessSectors.1.subsectors')).toEqual([sub('software'), { sector: '', percentage: 0 }]);
    expect(screen.getByTestId('repeatable-child-instance-businessSectors-1-1')).toBeInTheDocument();
  });

  test('given the user clicks Add, should leave the other root row untouched', async () => {
    let form: UseFormReturn<FieldValues> | undefined;
    render(<Harness rootRows={twoRoots([])} onForm={(next) => (form = next)} />);

    await userEvent.click(screen.getByRole('button', { name: 'Add subsector' }));

    expect(form?.getValues('businessSectors.0')).toEqual({ sector: 'retail', percentage: 30 });
  });

  test('given child maxInstances, should disable Add when the list is full', () => {
    render(<Harness rootRows={twoRoots([sub('a'), sub('b')])} childConfig={config({ maxInstances: 2 })} />);

    expect(screen.getByRole('button', { name: 'Add subsector' })).toBeDisabled();
  });

  test('given child minInstances, should disable Remove when the list is at the minimum', () => {
    render(<Harness rootRows={twoRoots([sub('a')])} childConfig={config({ minInstances: 1 })} />);

    expect(screen.getByRole('button', { name: 'Remove subsector 1 of business sector 2' })).toBeDisabled();
  });

  test('given the user removes a child row, should remove it, flush the draft, then invalidate queries for the block', async () => {
    let form: UseFormReturn<FieldValues> | undefined;
    const order: string[] = [];
    mockFlushDraftSave.mockImplementationOnce(async () => void order.push('flush'));
    mockInvalidateQueriesForBlock.mockImplementationOnce(async () => void order.push('invalidate'));
    render(<Harness rootRows={twoRoots([sub('a'), sub('b')])} onForm={(next) => (form = next)} />);

    await userEvent.click(screen.getByRole('button', { name: 'Remove subsector 1 of business sector 2' }));

    await waitFor(() => expect(order).toEqual(['flush', 'invalidate']));
    expect(mockInvalidateQueriesForBlock).toHaveBeenCalledWith('business-sectors-block');
    expect(form?.getValues('businessSectors.1.subsectors')).toEqual([sub('b')]);
  });

  test('given the last child row is removed at min 0, should keep an empty list', async () => {
    let form: UseFormReturn<FieldValues> | undefined;
    render(<Harness rootRows={twoRoots([sub('a')])} onForm={(next) => (form = next)} />);

    await userEvent.click(screen.getByRole('button', { name: 'Remove subsector 1 of business sector 2' }));

    expect(form?.getValues('businessSectors.1.subsectors')).toEqual([]);
  });

  test('given a disabled block, should disable Add and Remove', () => {
    render(<Harness rootRows={twoRoots([sub('a')])} isDisabled />);

    expect(screen.getByRole('button', { name: 'Add subsector' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove subsector 1 of business sector 2' })).toBeDisabled();
  });

  test('given an array-level error on the child list, should show it as an alert for that list only', async () => {
    let form: UseFormReturn<FieldValues> | undefined;
    render(<Harness rootRows={twoRoots([sub('a')])} onForm={(next) => (form = next)} />);

    form?.setError('businessSectors.1.subsectors' as never, { type: 'custom', message: 'Subsectors must total 100' });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Subsectors must total 100');
    expect(alert).toHaveAttribute('data-testid', 'repeatable-child-error-businessSectors-1');
  });

  test('given a child row, should render no nested child controls', () => {
    render(<Harness rootRows={twoRoots([sub('holding')])} />);

    expect(screen.getAllByRole('group')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /^Add/ })).toHaveLength(1);
  });
});
