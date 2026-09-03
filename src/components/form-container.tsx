/**
 * Form Container Component
 * 
 * Redux-connected container that integrates react-hook-form with Redux.
 * Follows container/presentation pattern - no UI markup, only connect logic.
 * 
 * Uses React-Redux hooks (useSelector, useDispatch) instead of connect() HOC.
 * Integrates TanStack Query for server state operations.
 */

import { useMemo, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { GlobalFormDescriptor, BlockDescriptor, FieldDescriptor, FormData, CaseContext } from '@/types/form-descriptor';
import { useFormDescriptor } from '@/hooks/use-form-descriptor';
import { useDebouncedRehydration } from '@/hooks/use-debounced-rehydration';
import { useDebouncedDocumentsRehydration } from '@/hooks/use-debounced-documents-rehydration';
import { useDraftSave } from '@/hooks/use-draft-save';
import {
  getVisibleBlocks,
  getVisibleFields,
  getMergedDescriptor,
  getCaseContext,
  getIsRehydrating,
  getDataSourceCache,
  getFormData,
  syncFormDataToContext,
  type RootState,
} from '@/store/form-dux';
import { fetchDataSourceThunk } from '@/store/form-thunks';
import type { AppDispatch } from '@/store/store';
import { updateCaseContext, identifyDiscriminantFields, haveDiscriminantFieldsChanged } from '@/utils/context-extractor';
import type { FormContext } from '@/utils/template-evaluator';
import { serializeFormValues } from '@/utils/submission-orchestrator';
import FormPresentation from './form-presentation';
import FormValuesWatcher from './form-values-watcher';
import { FormStatusProvider } from '@/context/form-status-context';
import { PopinManagerProvider } from './popin-manager';
import { DocumentPopinProvider, DocumentMainFormBinder } from './document-popin-provider';

/**
 * Props passed to presentation component
 */
export interface FormPresentationProps {
  form: UseFormReturn<FieldValues>;
  formContext?: FormContext;
  visibleBlocks: BlockDescriptor[];
  visibleFields: FieldDescriptor[];
  isRehydrating: boolean;
  mergedDescriptor: GlobalFormDescriptor | null;
  onLoadDataSource: (fieldPath: string, url: string, auth?: { type: 'bearer' | 'apikey'; token?: string; headerName?: string }) => void;
  dataSourceCache: Record<string, unknown>;
}

/**
 * Inner form component that creates the form instance.
 * Uses live Zod resolver — no remount on rules/context changes.
 */
function FormInner({
  mergedDescriptor,
  visibleBlocks,
  visibleFields,
  isRehydrating,
  caseContext,
  formData: savedFormData,
  syncFormData,
  rehydrate,
  loadDataSource,
  dataSourceCache,
}: {
  mergedDescriptor: GlobalFormDescriptor | null;
  visibleBlocks: BlockDescriptor[];
  visibleFields: FieldDescriptor[];
  isRehydrating: boolean;
  caseContext: CaseContext;
  formData: Partial<FormData>;
  syncFormData: (formData: Partial<FormData>) => void;
  rehydrate: (caseContext: CaseContext) => void;
  loadDataSource: (fieldPath: string, url: string, auth?: { type: 'bearer' | 'apikey'; token?: string; headerName?: string }) => void;
  dataSourceCache: Record<string, unknown>;
}) {
  const discriminantFields = useMemo(
    () => (mergedDescriptor ? identifyDiscriminantFields(visibleFields) : []),
    [mergedDescriptor, visibleFields]
  );

  const handleDiscriminantChange = useCallback(
    (newFormData: Partial<FormData>) => {
      if (discriminantFields.length === 0) {
        return;
      }

      if (!haveDiscriminantFieldsChanged(caseContext, newFormData, discriminantFields)) {
        return;
      }

      syncFormData(newFormData);
      const updatedContext = updateCaseContext(caseContext, newFormData, discriminantFields);
      rehydrate(updatedContext);
    },
    [discriminantFields, caseContext, syncFormData, rehydrate]
  );

  // Initialize useFormDescriptor with live resolver (no remount on rules/context change)
  const { form } = useFormDescriptor(mergedDescriptor, {
    savedFormData,
    caseContext,
  });

  const { saveDraft, flushDraftSave } = useDraftSave({
    form,
    draftConfig: mergedDescriptor?.draft,
    caseContext,
  });

  const presentationProps = useMemo(
    () => ({
      form,
      visibleBlocks,
      visibleFields,
      isRehydrating,
      mergedDescriptor,
      onLoadDataSource: loadDataSource,
      dataSourceCache,
    }),
    [form, visibleBlocks, visibleFields, isRehydrating, mergedDescriptor, loadDataSource, dataSourceCache]
  );

  // useWatch isolated in FormValuesWatcher - when form values change, only
  // FormValuesWatcher re-renders, not FormInner (avoids "Cannot update component
  // while rendering Controller")
  return (
    <>
      <FormValuesWatcher
        form={form}
        caseContext={caseContext}
        discriminantFields={discriminantFields}
        onDiscriminantChange={handleDiscriminantChange}
        onFormChange={saveDraft}
      />
      <FormStatusProvider form={form} caseContext={caseContext} descriptor={mergedDescriptor}>
        <PopinManagerProvider
          mergedDescriptor={mergedDescriptor}
          form={form}
          caseContext={caseContext}
          onLoadDataSource={loadDataSource}
          dataSourceCache={dataSourceCache}
          flushDraftSave={flushDraftSave}
        >
          <DocumentMainFormBinder form={form} />
          <FormPresentation {...presentationProps} />
        </PopinManagerProvider>
      </FormStatusProvider>
    </>
  );
}

/**
 * Form Container Component
 * 
 * Uses React-Redux hooks to connect to Redux state and dispatch actions.
 * Initializes react-hook-form and syncs discriminant fields to Redux.
 */
export default function FormContainer() {
  const dispatch = useDispatch<AppDispatch>();

  const mergedDescriptor = useSelector((state: RootState) => getMergedDescriptor(state));
  const caseContext = useSelector((state: RootState) => getCaseContext(state));
  const isRehydratingFromRedux = useSelector((state: RootState) => getIsRehydrating(state));
  const formData = useSelector((state: RootState) => getFormData(state));
  const dataSourceCache = useSelector((state: RootState) => getDataSourceCache(state));

  // Get visible blocks and fields using selectors
  const visibleBlocks = useSelector((state: RootState) => getVisibleBlocks(state));
  const visibleFields = useSelector((state: RootState) => getVisibleFields(state));

  // Use debounced rehydration hooks (rules + dynamic documents)
  const { mutate: debouncedRehydrate, isPending: isRehydratingFromHook } = useDebouncedRehydration();
  const {
    mutate: debouncedDocumentsRehydrate,
    isPending: isDocumentsRehydratingFromHook,
  } = useDebouncedDocumentsRehydration();

  // Combine rehydration states - use hook state if available, fallback to Redux
  const isRehydrating =
    isRehydratingFromHook || isDocumentsRehydratingFromHook || isRehydratingFromRedux;

  // Create callbacks for dispatching actions
  const syncFormData = useCallback(
    (formData: Partial<FormData>) => {
      dispatch(syncFormDataToContext({ formData: serializeFormValues(formData) }));
    },
    [dispatch]
  );

  const rehydrate = useCallback(
    (caseContext: CaseContext) => {
      debouncedRehydrate(caseContext);
      debouncedDocumentsRehydrate(caseContext);
    },
    [debouncedRehydrate, debouncedDocumentsRehydrate]
  );

  const loadDataSource = useCallback(
    (fieldPath: string, url: string, auth?: { type: 'bearer' | 'apikey'; token?: string; headerName?: string }) => {
      dispatch(fetchDataSourceThunk({ fieldPath, url, auth, templateContext: undefined }));
    },
    [dispatch]
  );

  return (
    <DocumentPopinProvider mergedDescriptor={mergedDescriptor}>
      <FormInner
        mergedDescriptor={mergedDescriptor}
        visibleBlocks={visibleBlocks}
        visibleFields={visibleFields}
        isRehydrating={isRehydrating}
        caseContext={caseContext}
        formData={formData}
        syncFormData={syncFormData}
        rehydrate={rehydrate}
        loadDataSource={loadDataSource}
        dataSourceCache={dataSourceCache}
      />
    </DocumentPopinProvider>
  );
}
