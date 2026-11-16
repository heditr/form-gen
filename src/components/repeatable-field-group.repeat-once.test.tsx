/**
 * Tests for repeatOnce fields inside RepeatableFieldGroup.
 *
 * The field is drawn once with the group, above or below the rows in
 * declaration order. Root rows and child rows render grouped fields only.
 */

import { describe, test, expect, vi, beforeAll } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const addressBlock = (fields: FieldDescriptor[]): BlockDescriptor => ({
  id: 'addresses-block',
  title: 'Addresses',
  repeatable: true,
  fields,
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
    textField('activityCountry', 'Country of activity', { repeatOnce: true }),
    textField('businessSectors.sector', 'Sector', { repeatableGroupId: 'businessSectors' }),
    textField('businessSectors.percentage', 'Percentage', { repeatableGroupId: 'businessSectors' }),
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

describe('RepeatableFieldGroup repeatOnce', () => {
  beforeAll(() => {
    registerHandlebarsHelpers();
  });

  const leadingBlock = addressBlock([
    textField('country', 'Country', { repeatOnce: true }),
    textField('addresses.street', 'Street', { repeatableGroupId: 'addresses' }),
    textField('addresses.city', 'City', { repeatableGroupId: 'addresses' }),
  ]);

  test('given several rows, should show the once-field a single time above the rows', () => {
    renderGroup({
      block: leadingBlock,
      groupId: 'addresses',
      values: {
        country: 'FR',
        addresses: [
          { street: '1 main', city: 'Paris' },
          { street: '2 main', city: 'Lyon' },
        ],
      },
    });

    expect(screen.getAllByLabelText('Country')).toHaveLength(1);
    expect(screen.getAllByLabelText('Street')).toHaveLength(2);
    expect(screen.getByTestId('text-field-country')).toBeInTheDocument();
    expect(screen.queryByTestId('text-field-addresses.0.country')).not.toBeInTheDocument();
    expect(screen.queryByTestId('text-field-addresses.1.country')).not.toBeInTheDocument();
    expect(
      follows(screen.getByLabelText('Country'), screen.getByTestId('repeatable-instance-addresses-0'))
    ).toBe(true);
  });

  test('given a once-field declared after the grouped fields, should show it below Add', () => {
    renderGroup({
      block: addressBlock([
        textField('addresses.street', 'Street', { repeatableGroupId: 'addresses' }),
        textField('notes', 'Notes', { repeatOnce: true }),
      ]),
      groupId: 'addresses',
      values: { notes: '', addresses: [{ street: '1 main' }] },
    });

    expect(screen.getAllByLabelText('Notes')).toHaveLength(1);
    expect(follows(screen.getByRole('button', { name: 'Add Addresses' }), screen.getByLabelText('Notes'))).toBe(true);
  });

  test('given an empty list, should still show a leading once-field', () => {
    renderGroup({
      block: leadingBlock,
      groupId: 'addresses',
      values: { country: 'FR', addresses: [] },
    });

    expect(screen.getByLabelText('Country')).toHaveValue('FR');
    expect(screen.getByText(/No instances yet/)).toBeInTheDocument();
    expect(follows(screen.getByLabelText('Country'), screen.getByRole('button', { name: 'Add Addresses' }))).toBe(true);
  });

  test('given a once-field value, should keep it when a row is added or removed', async () => {
    const user = userEvent.setup();
    const { holder } = renderGroup({
      block: leadingBlock,
      groupId: 'addresses',
      values: {
        country: '',
        addresses: [{ street: '1 main', city: 'Paris' }, { street: '2 main', city: 'Lyon' }],
      },
    });

    await user.type(screen.getByLabelText('Country'), 'FR');
    await user.click(screen.getByRole('button', { name: 'Add Addresses' }));

    expect(holder.form?.getValues('country')).toBe('FR');
    expect(screen.getAllByLabelText('Country')).toHaveLength(1);
    expect(screen.getAllByLabelText('Street')).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: 'Remove Addresses 1' }));

    expect(holder.form?.getValues('country')).toBe('FR');
    expect(screen.getAllByLabelText('Street')).toHaveLength(2);
  });

  test('given repeatableChild, should keep the once-field out of root rows and child rows', () => {
    renderGroup({
      block: sectorBlock(),
      groupId: 'businessSectors',
      values: {
        activityCountry: 'FR',
        businessSectors: [
          {
            sector: 'holding',
            percentage: '60',
            subsectors: [{ sector: 'retail', percentage: '10' }],
          },
        ],
      },
    });

    const root = screen.getByTestId('repeatable-instance-businessSectors-0');
    const child = screen.getByTestId('repeatable-child-instance-businessSectors-0-0');

    expect(screen.getAllByLabelText('Country of activity')).toHaveLength(1);
    expect(screen.getByTestId('text-field-activityCountry')).toBeInTheDocument();
    expect(within(root).queryByLabelText('Country of activity')).not.toBeInTheDocument();
    expect(within(child).queryByLabelText('Country of activity')).not.toBeInTheDocument();
    expect(within(child).getByLabelText('Sector')).toBeInTheDocument();
    expect(screen.queryByTestId('text-field-businessSectors.0.activityCountry')).not.toBeInTheDocument();
    expect(screen.queryByTestId('text-field-businessSectors.0.subsectors.0.activityCountry')).not.toBeInTheDocument();
  });
});
