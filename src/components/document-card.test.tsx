/**
 * Tests for DocumentCard Component
 */

import { beforeEach, describe, test, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useMemo } from 'react';
import { useForm, useWatch, type FieldValues } from 'react-hook-form';
import DocumentCard from './document-card';
import { DocumentPopinProvider, DocumentMainFormBinder } from './document-popin-provider';
import type { DocumentCardData, FieldDescriptor, GlobalFormDescriptor } from '@/types/form-descriptor';

describe('DocumentCard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const defaultUploadedFile = {
    id: 'file-1',
    url: 'https://example.com/passport.pdf',
    filename: 'passport.pdf',
    uploadedAt: '2026-05-07T09:00:00.000Z',
    clientConfirmationRequested: true,
  };

  const createDocumentField = (overrides?: Partial<FieldDescriptor>): FieldDescriptor => ({
    id: 'identityDocuments',
    type: 'document',
    label: 'Identity documents',
    description: 'Upload identity evidence',
    validation: [],
    document: {
      docType: 'identity_document',
      category: 'nominativeUploadableByProspect',
      layout: 'single',
      requestedDefault: true,
      optionalDefault: true,
      allowOptional: true,
      allowComment: true,
      file: {
        acceptedFormats: ['pdf', '.png'],
        multiple: true,
      },
    },
    ...overrides,
  });

  const buildDescriptor = (field: FieldDescriptor): GlobalFormDescriptor => ({
    version: '1',
    blocks: [
      {
        id: 'doc-block',
        title: 'Documents',
        layout: 'stack',
        fields: [field],
      },
    ],
    submission: {},
  });

  const renderDocumentCard = ({
    field = createDocumentField(),
    defaultValue,
    isDisabled = false,
  }: {
    field?: FieldDescriptor;
    defaultValue?: DocumentCardData;
    isDisabled?: boolean;
  } = {}) => {
    const Harness = () => {
      const form = useForm<FieldValues>({
        defaultValues: {
          [field.id]: defaultValue,
        },
      });
      const value = useWatch({ control: form.control, name: field.id });
      const mergedDescriptor = useMemo(() => buildDescriptor(field), [field]);

      return (
        <DocumentPopinProvider mergedDescriptor={mergedDescriptor}>
          <DocumentMainFormBinder form={form} />
          <DocumentCard field={field} form={form} isDisabled={isDisabled} />
          <output data-testid="document-value">{JSON.stringify(value)}</output>
        </DocumentPopinProvider>
      );
    };

    return render(<Harness />);
  };

  test('given a document card field, should render descriptor metadata and configured slots', () => {
    renderDocumentCard({
      defaultValue: {
        requested: true,
        optional: true,
        files: [defaultUploadedFile],
      },
    });

    expect(screen.getByText('Identity documents')).toBeInTheDocument();
    expect(screen.getByText('Upload identity evidence')).toBeInTheDocument();
    expect(screen.getByText('identity_document - nominativeUploadableByProspect')).toBeInTheDocument();
    expect(screen.getByText('Document')).toBeInTheDocument();
    expect(screen.getByText('passport.pdf')).toBeInTheDocument();
    expect(screen.getByText('Confirmation requested')).toBeInTheDocument();
  });

  test('given a single document card, should store requested and optional choices at card level', async () => {
    const user = userEvent.setup();
    renderDocumentCard();

    const requestedCheck = screen.getByLabelText('Requested');
    const optionalCheck = screen.getByLabelText('Optional');

    expect(requestedCheck).toBeChecked();
    expect(optionalCheck).toBeChecked();

    await user.click(requestedCheck);
    await user.click(optionalCheck);

    const value = JSON.parse(screen.getByTestId('document-value').textContent ?? '{}') as DocumentCardData;
    expect(value.requested).toBe(false);
    expect(value.optional).toBe(false);
  });

  test('given comments are allowed, should store comment text in the document card value', async () => {
    const user = userEvent.setup();
    renderDocumentCard();

    await user.type(screen.getByLabelText('Comment'), 'Ask for a certified copy');

    const value = JSON.parse(screen.getByTestId('document-value').textContent ?? '{}') as DocumentCardData;
    expect(value.comment).toBe('Ask for a certified copy');
  });

  test('given uploadable document config, should expose file picker in manage popin', async () => {
    const user = userEvent.setup();
    renderDocumentCard();

    await user.click(screen.getByRole('button', { name: /manage uploads/i }));

    const dialog = await screen.findByRole('dialog');
    const fileInputs = dialog.querySelectorAll('input[type="file"]');

    expect(fileInputs).toHaveLength(1);
    expect(fileInputs[0]).toHaveAttribute('accept', '.pdf,.png');
    expect(fileInputs[0]).toHaveAttribute('multiple');
  });

  test('given a selected document file in popin, should upload and commit file metadata on validate', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: 'uploaded-1',
        url: 'https://example.com/uploaded.pdf',
        filename: 'uploaded.pdf',
        uploadedAt: '2026-05-07T10:00:00.000Z',
      }),
    })));

    renderDocumentCard();

    await user.click(screen.getByRole('button', { name: /manage uploads/i }));

    const dialog = await screen.findByRole('dialog');
    const dialogFileInput = dialog.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(dialogFileInput, new File(['document'], 'uploaded.pdf', { type: 'application/pdf' }));

    await user.click(within(dialog).getByRole('button', { name: /^validate$/i }));

    await waitFor(() => {
      const value = JSON.parse(screen.getByTestId('document-value').textContent ?? '{}') as DocumentCardData;
      expect(value.files.some((file) => file.id === 'uploaded-1')).toBe(true);
    });
    expect(fetch).toHaveBeenCalledWith('/api/upload', expect.objectContaining({ method: 'POST' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('given a per-prospect document card, should render and store choices by prospect id', async () => {
    const user = userEvent.setup();
    renderDocumentCard({
      field: createDocumentField({
        document: {
          docType: 'identity_document',
          category: 'nominativeUploadableByProspect',
          layout: 'perProspect',
          allowOptional: true,
          prospects: [
            {
              id: 'person-1',
              name: 'Jane Doe',
              requestedDefault: true,
            },
            {
              id: 'person-2',
              name: 'John Smith',
              optionalDefault: true,
            },
          ],
          file: {
            acceptedFormats: ['pdf'],
          },
        },
      }),
    });

    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('John Smith')).toBeInTheDocument();

    const requestedChecks = screen.getAllByLabelText('Requested');
    const optionalChecks = screen.getAllByLabelText('Optional');
    await user.click(requestedChecks[0]);
    await user.click(optionalChecks[1]);

    const value = JSON.parse(screen.getByTestId('document-value').textContent ?? '{}') as DocumentCardData;
    expect(value.prospects?.['person-1'].requested).toBe(false);
    expect(value.prospects?.['person-2'].optional).toBe(false);
  });
});
