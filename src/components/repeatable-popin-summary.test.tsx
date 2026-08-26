/**
 * Tests for RepeatablePopinSummary query invalidation on remove
 */

import { describe, test, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm, FormProvider } from 'react-hook-form';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { BlockDescriptor } from '@/types/form-descriptor';
import type { FormContext } from '@/utils/template-evaluator';
import { registerHandlebarsHelpers } from '@/utils/handlebars-helpers';
import RepeatablePopinSummary from './repeatable-popin-summary';

const mockOpenPopin = vi.fn();
const mockInvalidateQueriesForBlock = vi.fn().mockResolvedValue(undefined);
const mockFlushDraftSave = vi.fn().mockResolvedValue(undefined);

vi.mock('./popin-manager', () => ({
  usePopinManager: () => ({ openPopin: mockOpenPopin }),
  useInvalidateQueriesForBlock: () => mockInvalidateQueriesForBlock,
  useFlushDraftSave: () => mockFlushDraftSave,
}));

describe('RepeatablePopinSummary', () => {
  beforeAll(() => {
    registerHandlebarsHelpers();
  });

  const createMockBlock = (): BlockDescriptor => ({
    id: 'addresses-block',
    title: 'Addresses',
    repeatable: true,
    repeatablePopin: true,
    fields: [
      {
        id: 'addresses.street',
        type: 'text',
        label: 'Street',
        repeatableGroupId: 'addresses',
        validation: [],
      },
    ],
  });

  test('given remove on summary row, should flush draft before invalidating queries for block id', async () => {
    const user = userEvent.setup();
    const block = createMockBlock();
    mockInvalidateQueriesForBlock.mockClear();
    mockFlushDraftSave.mockClear();

    const Wrapper = () => {
      const form = useForm({
        defaultValues: {
          addresses: [
            { street: '123 Main St' },
            { street: '456 Oak Ave' },
          ],
        },
      }) as unknown as UseFormReturn<FieldValues>;

      return (
        <FormProvider {...form}>
          <RepeatablePopinSummary
            block={block}
            groupId="addresses"
            fields={block.fields}
            isDisabled={false}
            isHidden={false}
            form={form}
            formContext={{} as FormContext}
          />
        </FormProvider>
      );
    };

    render(<Wrapper />);

    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    await user.click(removeButtons[0]);

    expect(mockFlushDraftSave).toHaveBeenCalled();
    expect(mockInvalidateQueriesForBlock).toHaveBeenCalledWith('addresses-block');
    expect(mockFlushDraftSave.mock.invocationCallOrder[0]).toBeLessThan(
      mockInvalidateQueriesForBlock.mock.invocationCallOrder[0]
    );
  });
});
