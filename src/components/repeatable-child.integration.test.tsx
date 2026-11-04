/**
 * Integration: useFormDescriptor + Block with repeatable child rows.
 *
 * Covers saved drafts with stale child lists, re-hydration that merges rules into
 * the descriptor while a child list is open, and the nested draft values.
 */

import { describe, test, expect, vi, beforeAll } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { GlobalFormDescriptor } from '@/types/form-descriptor';
import { registerHandlebarsHelpers } from '@/utils/handlebars-helpers';
import { mergeDescriptorWithRules } from '@/utils/descriptor-merger';
import { useFormDescriptor } from '@/hooks/use-form-descriptor';
import Block from './block';

vi.mock('@/hooks/use-form-query', () => ({
  useDataSource: () => ({ data: undefined, isLoading: undefined }),
}));

vi.mock('./popin-manager', () => ({
  useInvalidateQueriesForBlock: () => vi.fn().mockResolvedValue(undefined),
  useFlushDraftSave: () => vi.fn().mockResolvedValue(undefined),
}));

const descriptor: GlobalFormDescriptor = {
  version: '1',
  blocks: [
    {
      id: 'business-sectors-block',
      title: 'Business sector',
      repeatable: true,
      minInstances: 0,
      maxInstances: 10,
      repeatableChild: {
        property: 'subsectors',
        maxDepth: 2,
        title: 'Subsector',
        addLabel: 'Add subsector',
        triggerField: 'sector',
        triggerValues: ['holding'],
        maxInstances: 5,
      },
      fields: [
        {
          id: 'businessSectors.sector',
          type: 'dropdown',
          label: 'Sector',
          repeatableGroupId: 'businessSectors',
          items: [
            { label: 'Holding', value: 'holding' },
            { label: 'Retail', value: 'retail' },
          ],
          validation: [],
        },
        {
          id: 'businessSectors.percentage',
          type: 'number',
          label: 'Percentage',
          repeatableGroupId: 'businessSectors',
          validation: [],
        },
      ],
    },
  ],
  submission: { url: '/api/submit', method: 'POST' },
};

const sub = (sector: string, percentage = 10) => ({ sector, percentage });

type AppProps = {
  descriptor: GlobalFormDescriptor;
  savedFormData?: Record<string, unknown>;
  onForm: (form: UseFormReturn<FieldValues>) => void;
};

function App({ descriptor: current, savedFormData, onForm }: AppProps) {
  const { form } = useFormDescriptor(current, { savedFormData });
  onForm(form);
  return (
    <>
      {current.blocks.map((block) => (
        <Block
          key={block.id}
          block={block}
          isDisabled={false}
          isHidden={false}
          form={form}
          formContext={{}}
          onLoadDataSource={vi.fn()}
          dataSourceCache={{}}
          descriptor={current}
        />
      ))}
    </>
  );
}

const mount = (props: Omit<AppProps, 'onForm'>) => {
  const holder: { form?: UseFormReturn<FieldValues> } = {};
  const utils = render(<App {...props} onForm={(form) => (holder.form = form)} />);
  return { holder, ...utils };
};

describe('repeatable child rows with useFormDescriptor and Block', () => {
  beforeAll(() => {
    registerHandlebarsHelpers();
  });

  test('given a saved draft with a child list under a row that no longer opens it, should prune it and render no list', () => {
    const { holder } = mount({
      descriptor,
      savedFormData: { businessSectors: [{ sector: 'retail', percentage: 30, subsectors: [sub('retail')] }] },
    });

    expect(holder.form?.getValues('businessSectors')).toEqual([{ sector: 'retail', percentage: 30 }]);
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  test('given a saved draft with child lists, should render them and keep the nested tree in form values', () => {
    const rows = [
      { sector: 'holding', percentage: 60, subsectors: [sub('retail', 40), sub('holding', 20)] },
    ];
    const { holder } = mount({ descriptor, savedFormData: { businessSectors: rows } });

    expect(holder.form?.getValues('businessSectors')).toEqual(rows);
    expect(screen.getByRole('group', { name: 'Subsectors of Business sector 1' })).toBeInTheDocument();
  });

  test('given a rules re-hydration while a child list is open, should keep repeatableChild, the list, its values and its DOM node', async () => {
    const rows = [{ sector: 'holding', percentage: 60, subsectors: [sub('retail', 40)] }];
    const holder: { form?: UseFormReturn<FieldValues> } = {};
    const { rerender } = render(
      <App descriptor={descriptor} savedFormData={{ businessSectors: rows }} onForm={(form) => (holder.form = form)} />
    );
    const list = screen.getByRole('group', { name: 'Subsectors of Business sector 1' });
    await userEvent.click(within(list).getByRole('button', { name: 'Add subsector' }));

    const merged = mergeDescriptorWithRules(descriptor, {
      fields: [
        {
          id: 'businessSectors.percentage',
          validation: [{ type: 'required', message: 'Percentage is required' }],
        },
      ],
    });
    rerender(
      <App descriptor={merged} savedFormData={{ businessSectors: rows }} onForm={(form) => (holder.form = form)} />
    );

    expect(merged.blocks[0].repeatableChild).toEqual(descriptor.blocks[0].repeatableChild);
    expect(screen.getByRole('group', { name: 'Subsectors of Business sector 1' })).toBe(list);
    expect(holder.form?.getValues('businessSectors.0.subsectors')).toEqual([sub('retail', 40), { sector: '', percentage: 0 }]);
  });
});
