/**
 * Tests for PopinFormSession — repeatable edit seeding and status evaluation.
 */

import { describe, test, expect, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { registerHandlebarsHelpers } from '@/utils/handlebars-helpers';
import type { GlobalFormDescriptor, BlockDescriptor, CaseContext } from '@/types/form-descriptor';
import PopinFormSession from './popin-form-session';

describe('PopinFormSession', () => {
  beforeAll(() => {
    registerHandlebarsHelpers();
  });

  const repeatableBlock: BlockDescriptor = {
    id: 'addresses-block',
    title: 'Addresses',
    repeatable: true,
    repeatablePopin: true,
    fields: [
      {
        id: 'addresses.addressType',
        type: 'text',
        label: 'Address Type',
        repeatableGroupId: 'addresses',
        validation: [],
      },
      {
        id: 'addresses.country',
        type: 'text',
        label: 'Country',
        repeatableGroupId: 'addresses',
        validation: [],
      },
      {
        id: 'addresses.street',
        type: 'text',
        label: 'Street',
        repeatableGroupId: 'addresses',
        validation: [],
      },
      {
        id: 'addresses.companyName',
        type: 'text',
        label: 'Company Name',
        repeatableGroupId: 'addresses',
        validation: [],
        status: {
          hidden: '{{not (eq addressType "business")}}',
        },
      },
      {
        id: 'addresses.state',
        type: 'text',
        label: 'State',
        repeatableGroupId: 'addresses',
        validation: [],
        status: {
          hidden: '{{not (or (eq country "US") (eq country "CA"))}}',
        },
      },
    ],
  };

  const popinDescriptor: GlobalFormDescriptor = {
    version: '1.0.0',
    blocks: [
      {
        id: 'addresses-block-instance',
        title: 'Addresses',
        fields: [
          { id: 'addressType', type: 'text', label: 'Address Type', validation: [] },
          { id: 'country', type: 'text', label: 'Country', validation: [] },
          { id: 'street', type: 'text', label: 'Street', validation: [] },
          {
            id: 'companyName',
            type: 'text',
            label: 'Company Name',
            validation: [],
            status: { hidden: '{{not (eq addressType "business")}}' },
          },
          {
            id: 'state',
            type: 'text',
            label: 'State',
            validation: [],
            status: { hidden: '{{not (or (eq country "US") (eq country "CA"))}}' },
          },
        ],
      },
    ],
    submission: { url: '/api/submit', method: 'POST' },
  };

  const renderSession = ({
    addresses,
    index,
    mainCountry = 'FR',
  }: {
    addresses: Array<Record<string, unknown>>;
    index: number;
    mainCountry?: string;
  }) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    function Harness() {
      const mainForm = useForm({
        defaultValues: {
          country: mainCountry,
          city: 'Paris',
          addresses,
        },
      });

      return (
        <PopinFormSession
          resolvedBlock={{ block: repeatableBlock, isHidden: false, isDisabled: false }}
          popinDescriptor={popinDescriptor}
          mainForm={mainForm}
          initialFormContext={{ country: mainCountry, city: 'Paris' }}
          caseContext={{} as CaseContext}
          popinEditContext={{ groupId: 'addresses', index }}
          popinLoadData={null}
          isLoadingPopinData={false}
          onLoadDataSource={() => {}}
          dataSourceCache={{}}
          onClose={() => {}}
          onValidated={async () => {}}
        />
      );
    }

    return render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>
    );
  };

  test('given edit mode, should reset popin fields from the group array index', async () => {
    renderSession({
      index: 1,
      addresses: [
        { street: 'First', country: 'UK', addressType: 'residential' },
        { street: '1 Infinite Loop', country: 'US', addressType: 'business', companyName: 'Acme' },
      ],
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Street')).toHaveValue('1 Infinite Loop');
    });
    expect(screen.getByLabelText('Country')).toHaveValue('US');
    expect(screen.getByLabelText('Address Type')).toHaveValue('business');
  });

  test('given a business US instance, should display status-hidden fields that evaluate to visible', async () => {
    renderSession({
      index: 0,
      mainCountry: 'FR',
      addresses: [
        {
          street: '1 Infinite Loop',
          country: 'US',
          addressType: 'business',
          companyName: 'Acme',
          state: 'CA',
        },
      ],
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Company Name')).toBeInTheDocument();
      expect(screen.getByLabelText('State')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Company Name')).toHaveValue('Acme');
    expect(screen.getByLabelText('State')).toHaveValue('CA');
  });

  test('given a residential non-US instance, should keep business and US-only fields hidden', async () => {
    renderSession({
      index: 0,
      mainCountry: 'US',
      addresses: [
        { street: '10 Downing St', country: 'UK', addressType: 'residential' },
      ],
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Street')).toHaveValue('10 Downing St');
    });
    expect(screen.queryByLabelText('Company Name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('State')).not.toBeInTheDocument();
  });
});
