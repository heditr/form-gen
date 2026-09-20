/**
 * Tests for PopinFormSession — repeatable edit seeding and status evaluation.
 */

import { describe, test, expect, beforeAll, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm, type UseFormReturn, type FieldValues } from 'react-hook-form';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { registerHandlebarsHelpers } from '@/utils/handlebars-helpers';
import { extractDefaultValues } from '@/utils/form-descriptor-integration';
import type { GlobalFormDescriptor, BlockDescriptor, CaseContext } from '@/types/form-descriptor';
import PopinFormSession from './popin-form-session';

vi.mock('@/utils/form-descriptor-integration', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/form-descriptor-integration')>();
  return {
    ...actual,
    extractDefaultValues: vi.fn(actual.extractDefaultValues),
  };
});

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

  test('given residential edit Validate, should write the row back without hidden keys', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    let mainForm: UseFormReturn<FieldValues> | undefined;

    function Harness() {
      mainForm = useForm({
        defaultValues: {
          country: 'US',
          addresses: [
            {
              addressType: 'residential',
              country: 'UK',
              street: '10 Downing St',
              companyName: '',
              state: '',
            },
          ],
        },
      });

      return (
        <PopinFormSession
          resolvedBlock={{ block: repeatableBlock, isHidden: false, isDisabled: false }}
          popinDescriptor={popinDescriptor}
          mainForm={mainForm}
          initialFormContext={{ country: 'US' }}
          caseContext={{} as CaseContext}
          popinEditContext={{ groupId: 'addresses', index: 0 }}
          popinLoadData={null}
          isLoadingPopinData={false}
          onLoadDataSource={() => {}}
          dataSourceCache={{}}
          onClose={() => {}}
          onValidated={async () => {}}
        />
      );
    }

    render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Street')).toHaveValue('10 Downing St');
    });

    await userEvent.click(screen.getByRole('button', { name: 'Validate' }));

    await waitFor(() => {
      const row = (mainForm?.getValues('addresses') as Array<Record<string, unknown>>)[0];
      expect(row).not.toHaveProperty('companyName');
      expect(row).not.toHaveProperty('state');
      expect(row.street).toBe('10 Downing St');
    });
  });

  test('given a main-form edit while the popin is open, should not rebuild popin defaults', async () => {
    const callsBefore = vi.mocked(extractDefaultValues).mock.calls.length;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    let mainForm: UseFormReturn<FieldValues> | undefined;

    function Harness() {
      mainForm = useForm({
        defaultValues: {
          country: 'US',
          city: 'Paris',
          addresses: [
            {
              addressType: 'residential',
              country: 'UK',
              street: '10 Downing St',
            },
          ],
        },
      });

      return (
        <PopinFormSession
          resolvedBlock={{ block: repeatableBlock, isHidden: false, isDisabled: false }}
          popinDescriptor={popinDescriptor}
          mainForm={mainForm}
          initialFormContext={{ country: 'US', city: 'Paris' }}
          caseContext={{} as CaseContext}
          popinEditContext={{ groupId: 'addresses', index: 0 }}
          popinLoadData={null}
          isLoadingPopinData={false}
          onLoadDataSource={() => {}}
          dataSourceCache={{}}
          onClose={() => {}}
          onValidated={async () => {}}
        />
      );
    }

    render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Street')).toHaveValue('10 Downing St');
    });

    const callsAfterMount = vi.mocked(extractDefaultValues).mock.calls.length;
    expect(callsAfterMount).toBeGreaterThan(callsBefore);

    await act(async () => {
      mainForm?.setValue('city', 'Lyon');
    });

    expect(vi.mocked(extractDefaultValues).mock.calls.length).toBe(callsAfterMount);
    expect(screen.getByLabelText('Street')).toHaveValue('10 Downing St');
  });

  test('given popinSubmit Validate, should omit hidden keys from the request payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    global.fetch = fetchMock;

    const contactBlock: BlockDescriptor = {
      id: 'contact-info',
      title: 'Contact',
      popin: true,
      fields: [
        { id: 'contactEmail', type: 'text', label: 'Email', validation: [] },
        {
          id: 'ssn',
          type: 'text',
          label: 'SSN',
          validation: [],
          status: { hidden: '{{not (eq country "US")}}' },
        },
      ],
      popinSubmit: {
        url: '/api/popin-submit',
        method: 'POST',
      },
    };

    const contactPopinDescriptor: GlobalFormDescriptor = {
      version: '1.0.0',
      blocks: [
        {
          id: 'contact-info',
          title: 'Contact',
          fields: [
            { id: 'contactEmail', type: 'text', label: 'Email', validation: [] },
            {
              id: 'ssn',
              type: 'text',
              label: 'SSN',
              validation: [],
              status: { hidden: '{{not (eq country "US")}}' },
            },
          ],
        },
      ],
      submission: { url: '/api/submit', method: 'POST' },
    };

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    function Harness() {
      const mainForm = useForm({
        defaultValues: {
          country: 'UK',
          contactEmail: 'ada@example.com',
          ssn: '999-99-9999',
        },
      });

      return (
        <PopinFormSession
          resolvedBlock={{ block: contactBlock, isHidden: false, isDisabled: false }}
          popinDescriptor={contactPopinDescriptor}
          mainForm={mainForm}
          initialFormContext={{ country: 'UK' }}
          caseContext={{} as CaseContext}
          popinEditContext={null}
          popinLoadData={{ contactEmail: 'ada@example.com', ssn: '999-99-9999' }}
          isLoadingPopinData={false}
          onLoadDataSource={() => {}}
          dataSourceCache={{}}
          onClose={() => {}}
          onValidated={async () => {}}
        />
      );
    }

    render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Email')).toHaveValue('ada@example.com');
    });

    await userEvent.click(screen.getByRole('button', { name: 'Validate' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const requestInit = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(requestInit.body as string) as Record<string, unknown>;
    expect(body).not.toHaveProperty('ssn');
    expect(body.contactEmail).toBe('ada@example.com');
    expect(body.country).toBe('UK');
  });

  const signatoryBlock: BlockDescriptor = {
    id: 'signatories-block',
    title: 'Signatories',
    repeatable: true,
    repeatablePopin: true,
    fields: [
      {
        id: 'signatories.signatoryName',
        type: 'text',
        label: 'Signatory Name',
        repeatableGroupId: 'signatories',
        validation: [],
      },
      {
        id: 'signatories.signatoryRole',
        type: 'text',
        label: 'Signatory Role',
        repeatableGroupId: 'signatories',
        validation: [],
      },
      {
        id: 'signatories.ownershipPercent',
        type: 'text',
        label: 'Ownership Percent',
        repeatableGroupId: 'signatories',
        validation: [],
        status: { hidden: '{{not (eq entityType "corporation")}}' },
      },
      {
        id: 'signatories.ssn',
        type: 'text',
        label: 'SSN',
        repeatableGroupId: 'signatories',
        validation: [],
        status: { hidden: '{{not (eq country "US")}}' },
      },
      {
        id: 'signatories.nationalId',
        type: 'text',
        label: 'National ID',
        repeatableGroupId: 'signatories',
        validation: [],
        status: { hidden: '{{eq country "US"}}' },
      },
    ],
  };

  const signatoryPopinDescriptor: GlobalFormDescriptor = {
    version: '1.0.0',
    blocks: [
      {
        id: 'signatories-block-instance',
        title: 'Signatories',
        fields: [
          {
            id: 'signatoryName',
            type: 'text',
            label: 'Signatory Name',
            validation: [],
            defaultValue: '{{caseContext.signatories.@index.name}}',
          },
          {
            id: 'signatoryRole',
            type: 'text',
            label: 'Signatory Role',
            validation: [],
            defaultValue: '{{caseContext.signatories.@index.role}}',
          },
          {
            id: 'ownershipPercent',
            type: 'text',
            label: 'Ownership Percent',
            validation: [],
            status: { hidden: '{{not (eq entityType "corporation")}}' },
          },
          {
            id: 'ssn',
            type: 'text',
            label: 'SSN',
            validation: [],
            status: { hidden: '{{not (eq country "US")}}' },
          },
          {
            id: 'nationalId',
            type: 'text',
            label: 'National ID',
            validation: [],
            defaultValue: '{{caseContext.signatories.@index.nationalId}}',
            status: { hidden: '{{eq country "US"}}' },
          },
        ],
      },
    ],
    submission: { url: '/api/submit', method: 'POST' },
  };

  const renderSignatorySession = ({
    entityType,
    country,
    index,
    signatories = [],
    popinLoadData = null,
    caseContext = {},
  }: {
    entityType: string;
    country: string;
    index: number;
    signatories?: Array<Record<string, unknown>>;
    popinLoadData?: Record<string, unknown> | null;
    caseContext?: CaseContext;
  }) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    function Harness() {
      const mainForm = useForm({
        defaultValues: {
          entityType,
          country,
          signatories,
        },
      });

      return (
        <PopinFormSession
          resolvedBlock={{ block: signatoryBlock, isHidden: false, isDisabled: false }}
          popinDescriptor={signatoryPopinDescriptor}
          mainForm={mainForm}
          initialFormContext={{ entityType, country }}
          caseContext={caseContext}
          popinEditContext={{ groupId: 'signatories', index }}
          popinLoadData={popinLoadData}
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

  test('given create mode with popinLoadData, should fill matching popin fields', async () => {
    renderSignatorySession({
      entityType: 'corporation',
      country: 'US',
      index: -1,
      popinLoadData: {
        signatoryName: 'Ada Lovelace',
        signatoryRole: 'director',
      },
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Signatory Name')).toHaveValue('Ada Lovelace');
    });
    expect(screen.getByLabelText('Signatory Role')).toHaveValue('director');
  });

  test('given edit mode with popinLoadData, should keep the existing row values', async () => {
    renderSignatorySession({
      entityType: 'corporation',
      country: 'US',
      index: 0,
      signatories: [{ signatoryName: 'Existing Person', signatoryRole: 'officer' }],
      popinLoadData: {
        signatoryName: 'Ada Lovelace',
        signatoryRole: 'director',
      },
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Signatory Name')).toHaveValue('Existing Person');
    });
    expect(screen.getByLabelText('Signatory Role')).toHaveValue('officer');
  });

  test('given a corporation in the US, should show ownership and SSN from main-form values', async () => {
    renderSignatorySession({
      entityType: 'corporation',
      country: 'US',
      index: 0,
      signatories: [{ signatoryName: 'Ada Lovelace', ownershipPercent: '25', ssn: '123-45-6789' }],
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Signatory Name')).toHaveValue('Ada Lovelace');
    });
    expect(screen.getByLabelText('Ownership Percent')).toBeInTheDocument();
    expect(screen.getByLabelText('SSN')).toBeInTheDocument();
    expect(screen.queryByLabelText('National ID')).not.toBeInTheDocument();
  });

  test('given an individual outside the US, should hide corporation and US-only fields', async () => {
    renderSignatorySession({
      entityType: 'individual',
      country: 'FR',
      index: 0,
      signatories: [{ signatoryName: 'Ada Lovelace', nationalId: 'AB123' }],
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Signatory Name')).toHaveValue('Ada Lovelace');
    });
    expect(screen.queryByLabelText('Ownership Percent')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('SSN')).not.toBeInTheDocument();
    expect(screen.getByLabelText('National ID')).toBeInTheDocument();
  });

  test('given edit mode with @index defaultValues, should not log Handlebars parse errors', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderSignatorySession({
      entityType: 'individual',
      country: 'FR',
      index: 0,
      signatories: [
        {
          signatoryName: 'Existing Person',
          signatoryRole: 'self',
          nationalId: 'AB123',
        },
      ],
      caseContext: {
        signatories: [{ name: 'From Context', role: 'self', nationalId: 'CTX-0' }],
      } as CaseContext,
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Signatory Name')).toHaveValue('Existing Person');
    });
    expect(screen.getByLabelText('National ID')).toHaveValue('AB123');

    const parseErrors = consoleErrorSpy.mock.calls.filter((args) =>
      String(args[0] ?? '').includes('Error evaluating template') ||
      String(args[1] ?? '').includes("Expecting 'ID', got 'DATA'")
    );
    expect(parseErrors).toHaveLength(0);
    consoleErrorSpy.mockRestore();
  });
});
