/**
 * Block field visibility when status comes from FormStatusProvider or local templates.
 */

import { describe, test, expect } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import type { BlockDescriptor, GlobalFormDescriptor } from '@/types/form-descriptor';
import { FormStatusProvider } from '@/context/form-status-context';
import Block from './block';

const cityBlock: BlockDescriptor = {
  id: 'address',
  title: 'Address',
  fields: [
    {
      id: 'city',
      type: 'text',
      label: 'City',
      validation: [],
      status: {
        hidden: '{{#if (eq hideCity "yes")}}true{{else}}false{{/if}}',
        readonly: '{{#if freezeCity}}true{{else}}false{{/if}}',
      },
    },
  ],
};

const providerDescriptor: GlobalFormDescriptor = {
  blocks: [cityBlock],
  submission: { url: '/api/submit', method: 'POST' },
};

async function renderBlock({
  statusMode,
  defaultValues,
  formContext,
  isReadonly = false,
}: {
  statusMode: 'context' | 'local';
  defaultValues: Record<string, string>;
  formContext: Record<string, string | boolean>;
  isReadonly?: boolean;
}) {
  function Harness() {
    const form = useForm({ defaultValues });
    return (
      <FormStatusProvider form={form} caseContext={{}} descriptor={providerDescriptor}>
        <Block
          block={cityBlock}
          isDisabled={false}
          isHidden={false}
          isReadonly={isReadonly}
          statusMode={statusMode}
          form={form}
          formContext={formContext}
          onLoadDataSource={() => {}}
          dataSourceCache={{}}
        />
      </FormStatusProvider>
    );
  }

  render(<Harness />);
  await act(async () => {
    await Promise.resolve();
  });
}

describe('Block field status', () => {
  test('given context mode and a hidden field in the status map, should not render that field', async () => {
    await renderBlock({
      statusMode: 'context',
      defaultValues: { hideCity: 'yes', city: 'Paris' },
      formContext: { hideCity: 'no' },
    });

    expect(screen.queryByLabelText('City')).not.toBeInTheDocument();
  });

  test('given context mode and a readonly block, should mark the field readonly without disabling it', async () => {
    await renderBlock({
      statusMode: 'context',
      defaultValues: { hideCity: 'no', city: 'Paris' },
      formContext: {},
      isReadonly: true,
    });

    const input = screen.getByLabelText('City');
    expect(input).toHaveAttribute('readonly');
    expect(input).toHaveAttribute('aria-readonly', 'true');
    expect(input).not.toBeDisabled();
  });

  test('given local mode, should hide the field from form context and ignore the ancestor status map', async () => {
    await renderBlock({
      statusMode: 'local',
      defaultValues: { hideCity: 'no', city: 'Paris' },
      formContext: { hideCity: 'yes' },
    });

    expect(screen.queryByLabelText('City')).not.toBeInTheDocument();
  });
});
