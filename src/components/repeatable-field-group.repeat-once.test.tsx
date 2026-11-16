/**
 * Tests for the one repeat-once progress bar inside RepeatableFieldGroup.
 *
 * The bar is drawn once after the root rows. A child list draws the same
 * field again, totaling only that list.
 */

import { describe, test, expect, vi, beforeAll } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { BlockDescriptor, FieldDescriptor, RepeatableChildConfig } from '@/types/form-descriptor';
import { registerHandlebarsHelpers } from '@/utils/handlebars-helpers';
import RepeatableFieldGroup from './repeatable-field-group';

vi.mock('@/hooks/use-form-query', () => ({
  useDataSource: () => ({ data: undefined, isLoading: undefined }),
}));

vi.mock('./popin-manager', () => ({
  useInvalidateQueriesForBlock: () => vi.fn().mockResolvedValue(undefined),
  useFlushDraftSave: () => vi.fn().mockResolvedValue(undefined),
}));

const textField = (
  id: string,
  label: string,
  extra: Partial<FieldDescriptor> = {}
): FieldDescriptor => ({
  id,
  type: 'text',
  label,
  validation: [],
  ...extra,
});

const progressField = (): FieldDescriptor => ({
  id: 'sectorShare',
  type: 'progress',
  label: 'Total share',
  repeatOnce: true,
  progress: { sumField: 'percentage', max: 100 },
  validation: [],
});

const childConfig = (): RepeatableChildConfig => ({
  property: 'subsectors',
  maxDepth: 2,
  title: 'Subsector',
  addLabel: 'Add subsector',
  triggerField: 'sector',
  triggerValues: ['holding'],
});

const sectorBlock = (): BlockDescriptor => ({
  id: 'business-sectors-block',
  title: 'Business sector',
  repeatable: true,
  repeatableChild: childConfig(),
  fields: [
    textField('businessSectors.sector', 'Sector', { repeatableGroupId: 'businessSectors' }),
    {
      id: 'businessSectors.percentage',
      type: 'number',
      label: 'Percentage',
      repeatableGroupId: 'businessSectors',
      validation: [],
    },
    progressField(),
  ],
});

type HarnessProps = {
  block: BlockDescriptor;
  groupId: string;
  values: Record<string, unknown>;
  onForm?: (form: UseFormReturn<FieldValues>) => void;
};

function Harness({ block, groupId, values, onForm }: HarnessProps) {
  const form = useForm<FieldValues>({ defaultValues: values });
  onForm?.(form);
  return (
    <RepeatableFieldGroup
      block={block}
      groupId={groupId}
      fields={block.fields}
      isDisabled={false}
      isHidden={false}
      form={form}
      formContext={{}}
      onLoadDataSource={vi.fn()}
      dataSourceCache={{}}
    />
  );
}

const renderGroup = (props: Omit<HarnessProps, 'onForm'>) => {
  const holder: { form?: UseFormReturn<FieldValues> } = {};
  const utils = render(<Harness {...props} onForm={(form) => (holder.form = form)} />);
  return { holder, ...utils };
};

const follows = (earlier: HTMLElement, later: HTMLElement) =>
  Boolean(earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('RepeatableFieldGroup repeatOnce progress', () => {
  beforeAll(() => {
    registerHandlebarsHelpers();
  });

  test('given sector rows, should show one bar after the rows and before Add with the root sum', () => {
    renderGroup({
      block: sectorBlock(),
      groupId: 'businessSectors',
      values: {
        businessSectors: [
          { sector: 'retail', percentage: 30 },
          { sector: 'software', percentage: 70 },
        ],
      },
    });

    const bars = screen.getAllByRole('progressbar', { name: 'Total share' });
    const add = screen.getByRole('button', { name: 'Add Business sector' });
    const lastRow = screen.getByTestId('repeatable-instance-businessSectors-1');

    expect(bars).toHaveLength(1);
    expect(bars[0]).toHaveAttribute('aria-valuenow', '100');
    expect(bars[0]).toHaveAttribute('aria-valuemax', '100');
    expect(bars[0]).toHaveAttribute('aria-readonly', 'true');
    expect(follows(lastRow, bars[0])).toBe(true);
    expect(follows(bars[0], add)).toBe(true);
    expect(screen.queryByTestId('text-field-businessSectors.0.sectorShare')).not.toBeInTheDocument();
  });

  test('given an empty list, should show the bar at zero before Add', () => {
    renderGroup({
      block: sectorBlock(),
      groupId: 'businessSectors',
      values: { businessSectors: [] },
    });

    const bar = screen.getByRole('progressbar', { name: 'Total share' });
    const add = screen.getByRole('button', { name: 'Add Business sector' });

    expect(bar).toHaveAttribute('aria-valuenow', '0');
    expect(follows(bar, add)).toBe(true);
  });

  test('given a child list, should show a second bar that sums only that list', () => {
    renderGroup({
      block: sectorBlock(),
      groupId: 'businessSectors',
      values: {
        businessSectors: [
          {
            sector: 'holding',
            percentage: 70,
            subsectors: [{ sector: 'software', percentage: 40 }],
          },
          { sector: 'retail', percentage: 30 },
        ],
      },
    });

    const child = screen.getByTestId('repeatable-child-group-businessSectors-0');
    const childBar = within(child).getByRole('progressbar', { name: 'Total share' });
    const childAdd = within(child).getByRole('button', { name: 'Add subsector' });
    const childRow = within(child).getByTestId('repeatable-child-instance-businessSectors-0-0');
    const rootBar = screen
      .getAllByRole('progressbar', { name: 'Total share' })
      .find((bar) => !child.contains(bar));

    expect(childBar).toHaveAttribute('aria-valuenow', '40');
    expect(follows(childRow, childBar)).toBe(true);
    expect(follows(childBar, childAdd)).toBe(true);
    expect(rootBar).toHaveAttribute('aria-valuenow', '100');
    expect(within(childRow).queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
