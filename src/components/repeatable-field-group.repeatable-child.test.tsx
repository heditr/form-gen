/**
 * Tests for RepeatableFieldGroup with repeatableChild.
 *
 * One root row may hold one inline child list of the same group. These tests use
 * the real FieldWrapper and a real zod resolver; only the popin manager hooks
 * are replaced.
 */

import { describe, test, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, within, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { BlockDescriptor, FieldDescriptor, RepeatableChildConfig } from '@/types/form-descriptor';
import { registerHandlebarsHelpers } from '@/utils/handlebars-helpers';
import { buildZodSchemaFromDescriptor } from '@/utils/form-descriptor-integration';
import RepeatableFieldGroup from './repeatable-field-group';

const mockInvalidateQueriesForBlock = vi.fn().mockResolvedValue(undefined);
const mockFlushDraftSave = vi.fn().mockResolvedValue(undefined);

vi.mock('@/hooks/use-form-query', () => ({
  useDataSource: () => ({ data: undefined, isLoading: undefined }),
}));

vi.mock('./popin-manager', () => ({
  useInvalidateQueriesForBlock: () => mockInvalidateQueriesForBlock,
  useFlushDraftSave: () => mockFlushDraftSave,
}));

const sectorFields: FieldDescriptor[] = [
  {
    id: 'businessSectors.sector',
    type: 'dropdown',
    label: 'Sector',
    repeatableGroupId: 'businessSectors',
    items: [
      { label: 'Holding', value: 'holding' },
      { label: 'Software', value: 'software' },
      { label: 'Retail', value: 'retail' },
    ],
    validation: [{ type: 'required', message: 'Sector is required' }],
  },
  {
    id: 'businessSectors.percentage',
    type: 'number',
    label: 'Percentage',
    repeatableGroupId: 'businessSectors',
    validation: [],
  },
];

const childConfig = (overrides: Partial<RepeatableChildConfig> = {}): RepeatableChildConfig => ({
  property: 'subsectors',
  maxDepth: 2,
  title: 'Subsector',
  addLabel: 'Add subsector',
  triggerField: 'sector',
  triggerValues: ['holding'],
  minInstances: 0,
  maxInstances: 5,
  ...overrides,
});

const sectorBlock = (overrides: Partial<BlockDescriptor> = {}): BlockDescriptor => ({
  id: 'business-sectors-block',
  title: 'Business sector',
  repeatable: true,
  minInstances: 0,
  maxInstances: 10,
  repeatableChild: childConfig(),
  fields: sectorFields,
  ...overrides,
});

type HarnessProps = {
  block?: BlockDescriptor;
  rows?: unknown[];
  isHidden?: boolean;
  isDisabled?: boolean;
  onForm?: (form: UseFormReturn<FieldValues>) => void;
};

function Harness({ block = sectorBlock(), rows = [], isHidden = false, isDisabled = false, onForm }: HarnessProps) {
  const schema = buildZodSchemaFromDescriptor({
    blocks: [block],
    submission: { url: '/x', method: 'POST' },
  });
  const form = useForm<FieldValues>({
    defaultValues: { businessSectors: rows },
    resolver: zodResolver(schema) as never,
    mode: 'onBlur',
  });
  onForm?.(form);
  return (
    <RepeatableFieldGroup
      block={block}
      groupId="businessSectors"
      fields={block.fields}
      isDisabled={isDisabled}
      isHidden={isHidden}
      form={form}
      formContext={{}}
      onLoadDataSource={vi.fn()}
      dataSourceCache={{}}
    />
  );
}

const renderGroup = (props: HarnessProps = {}) => {
  const holder: { form?: UseFormReturn<FieldValues> } = {};
  const utils = render(<Harness {...props} onForm={(form) => (holder.form = form)} />);
  return { holder, ...utils };
};

const rootRow = (index: number) => screen.getByTestId(`repeatable-instance-businessSectors-${index}`);
const sectorSelect = (path: string) =>
  within(screen.getByTestId(`dropdown-field-${path}`)).getByRole('combobox');

const sub = (sector: string, percentage = 10) => ({ sector, percentage });

describe('RepeatableFieldGroup with repeatableChild', () => {
  beforeAll(() => {
    registerHandlebarsHelpers();
  });

  beforeEach(() => {
    mockFlushDraftSave.mockClear();
    mockInvalidateQueriesForBlock.mockClear();
  });

  test('given an empty group, should show "Add Business sector" and append one root row on click', async () => {
    const { holder } = renderGroup();

    await userEvent.click(screen.getByRole('button', { name: 'Add Business sector' }));

    expect(holder.form?.getValues('businessSectors')).toHaveLength(1);
    expect(rootRow(0)).toBeInTheDocument();
  });

  test('given a root row whose sector is a trigger value, should show Add subsector on that row', () => {
    renderGroup({ rows: [{ sector: 'holding', percentage: 70 }] });

    expect(within(rootRow(0)).getByRole('button', { name: 'Add subsector' })).toBeInTheDocument();
  });

  test('given a root row whose sector is not a trigger value, should show neither Add subsector nor a nested section', () => {
    renderGroup({ rows: [{ sector: 'retail', percentage: 30 }] });

    expect(screen.queryByRole('button', { name: 'Add subsector' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  test('given a trigger row with no child list, should not write an empty child list into the form values', () => {
    const { holder } = renderGroup({ rows: [{ sector: 'holding', percentage: 70 }] });

    expect(holder.form?.getValues('businessSectors.0')).toEqual({ sector: 'holding', percentage: 70 });
  });

  test('given the user clicks Add subsector, should create the child list with one default row and show it indented in a labelled group', async () => {
    const { holder } = renderGroup({ rows: [{ sector: 'retail', percentage: 30 }, { sector: 'holding', percentage: 70 }] });

    await userEvent.click(within(rootRow(1)).getByRole('button', { name: 'Add subsector' }));

    expect(holder.form?.getValues('businessSectors.1.subsectors')).toEqual([{ sector: '', percentage: 0 }]);
    const group = screen.getByRole('group', { name: 'Subsectors of Business sector 2' });
    expect(within(rootRow(1)).getByRole('group')).toBe(group);
    expect(within(group).getByRole('button', { name: 'Add subsector' })).toBeInTheDocument();
  });

  test('given the user clicks Add subsector, should move focus to the first field of the new child row', async () => {
    renderGroup({ rows: [{ sector: 'holding', percentage: 70 }] });

    await userEvent.click(within(rootRow(0)).getByRole('button', { name: 'Add subsector' }));

    await waitFor(() => expect(sectorSelect('businessSectors.0.subsectors.0.sector')).toHaveFocus());
  });

  test('given a subsector row set to a trigger value, should show no Add control or nested section on that row', () => {
    renderGroup({ rows: [{ sector: 'holding', percentage: 70, subsectors: [sub('holding')] }] });

    const child = screen.getByTestId('repeatable-child-instance-businessSectors-0-0');
    expect(within(child).queryByRole('button', { name: /Add/ })).not.toBeInTheDocument();
    expect(within(child).queryByRole('group')).not.toBeInTheDocument();
    expect(screen.getAllByRole('group')).toHaveLength(1);
  });

  test('given two holding rows with subsectors, should leave the other list untouched when one list changes', async () => {
    const { holder } = renderGroup({
      rows: [
        { sector: 'holding', percentage: 50, subsectors: [sub('software', 1)] },
        { sector: 'holding', percentage: 50, subsectors: [sub('retail', 2)] },
      ],
    });
    const secondList = screen.getByTestId('repeatable-child-group-businessSectors-1');
    const secondRow = rootRow(1);

    await userEvent.click(
      within(screen.getByTestId('repeatable-child-group-businessSectors-0')).getByRole('button', { name: 'Add subsector' })
    );

    expect(holder.form?.getValues('businessSectors.0.subsectors')).toHaveLength(2);
    expect(holder.form?.getValues('businessSectors.1.subsectors')).toEqual([sub('retail', 2)]);
    expect(screen.getByTestId('repeatable-child-group-businessSectors-1')).toBe(secondList);
    expect(rootRow(1)).toBe(secondRow);
  });

  test('given a root row is removed, should keep the other row, its list, and its DOM nodes', async () => {
    const { holder } = renderGroup({
      rows: [
        { sector: 'retail', percentage: 30 },
        { sector: 'holding', percentage: 70, subsectors: [sub('software', 5), sub('retail', 6)] },
      ],
    });
    const holdingRow = rootRow(1);
    const list = screen.getByTestId('repeatable-child-group-businessSectors-1');

    await userEvent.click(screen.getByRole('button', { name: 'Remove Business sector 1' }));

    expect(holder.form?.getValues('businessSectors')).toEqual([
      { sector: 'holding', percentage: 70, subsectors: [sub('software', 5), sub('retail', 6)] },
    ]);
    expect(rootRow(0)).toBe(holdingRow);
    expect(screen.getByTestId('repeatable-child-group-businessSectors-0')).toBe(list);
    expect(screen.getByRole('group', { name: 'Subsectors of Business sector 1' })).toBe(list);
  });

  test('given a root row with subsectors is removed, should remove the row and its subsectors', async () => {
    const { holder } = renderGroup({
      rows: [{ sector: 'holding', percentage: 70, subsectors: [sub('software')] }],
    });

    await userEvent.click(screen.getByRole('button', { name: 'Remove Business sector 1' }));

    expect(holder.form?.getValues('businessSectors')).toEqual([]);
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  test('given root minInstances, should disable root Remove at the floor but not child Remove', () => {
    renderGroup({
      block: sectorBlock({ minInstances: 1 }),
      rows: [{ sector: 'holding', percentage: 70, subsectors: [sub('software')] }],
    });

    expect(screen.getByRole('button', { name: 'Remove Business sector 1' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove subsector 1 of business sector 1' })).toBeEnabled();
  });

  test('given the user changes a root sector to a non-trigger value, should drop only its subsectors, flush the draft and announce it', async () => {
    const { holder } = renderGroup({
      rows: [
        { sector: 'holding', percentage: 50, subsectors: [sub('software', 1)] },
        { sector: 'holding', percentage: 50, subsectors: [sub('retail', 2)] },
      ],
    });
    const otherList = screen.getByTestId('repeatable-child-group-businessSectors-1');

    await userEvent.selectOptions(sectorSelect('businessSectors.0.sector'), 'software');

    await waitFor(() =>
      expect(holder.form?.getValues('businessSectors.0')).toEqual({ sector: 'software', percentage: 50 })
    );
    expect(holder.form?.getValues('businessSectors.1.subsectors')).toEqual([sub('retail', 2)]);
    expect(screen.queryByTestId('repeatable-child-group-businessSectors-0')).not.toBeInTheDocument();
    expect(screen.getByTestId('repeatable-child-group-businessSectors-1')).toBe(otherList);
    expect(mockFlushDraftSave).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Subsectors removed because the sector changed');
  });

  test('given the user changes a sector between two trigger values, should keep its subsectors', async () => {
    const { holder } = renderGroup({
      block: sectorBlock({ repeatableChild: childConfig({ triggerValues: ['holding', 'software'] }) }),
      rows: [{ sector: 'holding', percentage: 50, subsectors: [sub('retail', 2)] }],
    });

    await userEvent.selectOptions(sectorSelect('businessSectors.0.sector'), 'software');

    expect(holder.form?.getValues('businessSectors.0.subsectors')).toEqual([sub('retail', 2)]);
  });

  test('given the user changes a sector whose list was empty, should not announce a removal', async () => {
    renderGroup({ rows: [{ sector: 'holding', percentage: 50, subsectors: [] }] });

    await userEvent.selectOptions(sectorSelect('businessSectors.0.sector'), 'retail');

    await waitFor(() => expect(screen.queryByTestId('repeatable-child-group-businessSectors-0')).not.toBeInTheDocument());
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  test('given a programmatic change of the trigger value, should keep the child list in form state', async () => {
    const { holder } = renderGroup({
      rows: [{ sector: 'holding', percentage: 50, subsectors: [sub('retail', 2)] }],
    });

    act(() => holder.form?.setValue('businessSectors.0.sector', 'retail'));

    expect(holder.form?.getValues('businessSectors.0.subsectors')).toEqual([sub('retail', 2)]);
    expect(mockFlushDraftSave).not.toHaveBeenCalled();
  });

  test('given a subsector row is edited, should not run the clear policy', async () => {
    const { holder } = renderGroup({
      rows: [{ sector: 'holding', percentage: 50, subsectors: [sub('holding', 2)] }],
    });

    await userEvent.selectOptions(sectorSelect('businessSectors.0.subsectors.0.sector'), 'retail');

    expect(holder.form?.getValues('businessSectors.0.subsectors')).toEqual([sub('retail', 2)]);
    expect(mockFlushDraftSave).not.toHaveBeenCalled();
  });

  test('given an invalid subsector field, should show the error under that field only', async () => {
    const { holder } = renderGroup({
      rows: [
        { sector: 'retail', percentage: 30 },
        { sector: 'holding', percentage: 70, subsectors: [sub('software'), { sector: '', percentage: 5 }] },
      ],
    });

    await act(async () => {
      await holder.form?.trigger();
    });

    const badField = screen.getByTestId('dropdown-field-businessSectors.1.subsectors.1.sector');
    expect(await within(badField).findByText('Sector is required')).toBeInTheDocument();
    expect(screen.getAllByText('Sector is required')).toHaveLength(1);
  });

  test('given a hidden block, should render nothing', () => {
    const { container } = renderGroup({
      isHidden: true,
      rows: [{ sector: 'holding', percentage: 70, subsectors: [sub('software')] }],
    });

    expect(container).toBeEmptyDOMElement();
  });

  test('given a stale child list under a row that no longer opens the child level, should not render it', () => {
    renderGroup({ rows: [{ sector: 'retail', percentage: 30, subsectors: [sub('software')] }] });

    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  test('given a block without repeatableChild, should render no child controls, announcer, or child test ids', () => {
    const { container } = renderGroup({
      block: sectorBlock({ repeatableChild: undefined }),
      rows: [{ sector: 'holding', percentage: 70, subsectors: [sub('software')] }],
    });

    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(container.querySelector('[data-testid^="repeatable-child"]')).toBeNull();
  });
});
