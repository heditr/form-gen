'use client';

/**
 * React context for opening the document upload dialog **above** the keyed `FormInner` tree.
 *
 * Keeps in-dialog upload session and working file list stable across RHF remounts driven by
 * `formKey`; `DocumentMainFormBinder` wires each new `useForm` instance to the same ref container.
 */

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { RefObject } from 'react';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { GlobalFormDescriptor } from '@/types/form-descriptor';
import DocumentCardUploadPopin, { type DocumentUploadOpenPayload } from './document-card-upload-popin';

/** Context API: open the upload popin and (internally) attach the main form for `setValue`. */
export interface DocumentPopinContextValue {
  /** Opens `DocumentCardUploadPopin` for one field + slot (`document` or prospect id). */
  openDocumentPopin: (payload: DocumentUploadOpenPayload) => void;
  /** Called from {@link DocumentMainFormBinder} to point Validate at the current RHF root. */
  assignMainForm: (form: UseFormReturn<FieldValues> | null) => void;
}

const DocumentPopinContext = createContext<DocumentPopinContextValue | null>(null);

/**
 * Requires a parent {@link DocumentPopinProvider}.
 *
 * @throws If used outside the provider (mis-wiring `DocumentCard` vs. tree).
 */
export function useDocumentPopin(): DocumentPopinContextValue {
  const context = useContext(DocumentPopinContext);
  if (!context) {
    throw new Error('useDocumentPopin must be used within DocumentPopinProvider');
  }
  return context;
}

export interface DocumentPopinProviderProps {
  /** Current merged descriptor — used only to resolve `field.document` inside the modal. */
  mergedDescriptor: GlobalFormDescriptor | null;
  children: React.ReactNode;
}

/**
 * Renders {@link DocumentCardUploadPopin} alongside children; must wrap any subtree that calls
 * {@link useDocumentPopin}.
 */
export function DocumentPopinProvider({
  mergedDescriptor,
  children,
}: DocumentPopinProviderProps) {
  const mainFormRef = useRef<UseFormReturn<FieldValues> | null>(null);
  const [openTarget, setOpenTarget] = useState<DocumentUploadOpenPayload | null>(null);

  const assignMainForm = useCallback((form: UseFormReturn<FieldValues> | null) => {
    mainFormRef.current = form;
  }, []);

  const openDocumentPopin = useCallback((payload: DocumentUploadOpenPayload) => {
    setOpenTarget({
      fieldId: payload.fieldId,
      slotId: payload.slotId,
      ...(payload.requireFileForValidate !== undefined
        ? { requireFileForValidate: payload.requireFileForValidate }
        : {}),
    });
  }, []);

  const ctx = useMemo(
    (): DocumentPopinContextValue => ({
      assignMainForm,
      openDocumentPopin,
    }),
    [assignMainForm, openDocumentPopin]
  );

  const handlePopinOpenChange = useCallback((next: boolean) => {
    if (!next) {
      setOpenTarget(null);
    }
  }, []);

  return (
    <DocumentPopinContext.Provider value={ctx}>
      {children}
      <DocumentCardUploadPopin
        mergedDescriptor={mergedDescriptor}
        mainFormRef={mainFormRef as RefObject<UseFormReturn<FieldValues> | null>}
        open={openTarget}
        onOpenChange={handlePopinOpenChange}
      />
    </DocumentPopinContext.Provider>
  );
}

/**
 * Side-effect only: publishes `form` to the nearest {@link DocumentPopinProvider}.
 * Prefer `useLayoutEffect` so the dialog’s first paint sees a bound ref whenever possible.
 *
 * @param form Main case form instance (`FormInner`).
 */
export function DocumentMainFormBinder({ form }: { form: UseFormReturn<FieldValues> }) {
  const { assignMainForm } = useDocumentPopin();

  useLayoutEffect(() => {
    assignMainForm(form);
    return () => {
      assignMainForm(null);
    };
  }, [form, assignMainForm]);

  return null;
}
