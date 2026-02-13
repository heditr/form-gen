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
import {
  getVisibleBlocks,
  getVisibleFields,
  getFormState,
  syncFormDataToContext,
  type RootState,
} from '@/store/form-dux';
import { fetchDataSourceThunk } from '@/store/form-thunks';
import type { AppDispatch } from '@/store/store';
import { updateCaseContext, identifyDiscriminantFields, hasContextChanged } from '@/utils/context-extractor';
import FormPresentation from './form-presentation';
import { PopinManagerProvider } from './popin-manager';

/**
 * Props passed to presentation component
 */
export interface FormPresentationProps {
  form: UseFormReturn<FieldValues>;
  visibleBlocks: BlockDescriptor[];
  visibleFields: FieldDescriptor[];
  isRehydrating: boolean;
  mergedDescriptor: GlobalFormDescriptor | null;
  onLoadDataSource: (fieldPath: string, url: string, auth?: { type: 'bearer' | 'apikey'; token?: string; headerName?: string }) => void;
  dataSourceCache: Record<string, unknown>;
}

/**
 * Inner form component that creates the form instance
 * This component is keyed to force remount when validation rules change
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
  const handleDiscriminantChange = useCallback(
    (newFormData: Partial<FormData>) => {
      // Sync form data to Redux
      syncFormData(newFormData);

      // Extract discriminant fields from descriptor
      const discriminantFields = mergedDescriptor
        ? identifyDiscriminantFields(visibleFields)
        : [];

      if (discriminantFields.length === 0) {
        return;
      }

      // Update case context from form data
      const updatedContext = updateCaseContext(caseContext, newFormData, discriminantFields);

      // Check if context changed
      if (hasContextChanged(caseContext, updatedContext)) {
        // Trigger re-hydration with updated context
        // Note: Task 7 will replace this with a debounced TanStack Query mutation hook
        rehydrate(updatedContext);
      }
    },
    [mergedDescriptor, visibleFields, caseContext, syncFormData, rehydrate]
  );

  // Initialize useFormDescriptor hook - this will create a new form instance
  // when this component remounts (due to key change)
  // Pass savedFormData to restore form values from Redux
  // Pass caseContext and formData for template evaluation in default values
  const { form } = useFormDescriptor(mergedDescriptor, {
    onDiscriminantChange: handleDiscriminantChange,
    savedFormData, // Restore form values from Redux when form remounts
    caseContext, // Case context for template evaluation
    formData: savedFormData, // Current form data for template evaluation
  });

  // Build form context for template evaluation (used by PopinManager)
  const formContext = useMemo(() => {
    const formValues = form.watch();
    return {
      ...formValues,
      caseContext,
      formData: formValues,
    };
  }, [form, caseContext]);

  // Prepare props for presentation component
  const presentationProps: FormPresentationProps = useMemo(
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

  return (
    <PopinManagerProvider
      mergedDescriptor={mergedDescriptor}
      form={form}
      formContext={formContext}
      caseContext={caseContext}
      onLoadDataSource={loadDataSource}
      dataSourceCache={dataSourceCache}
    >
      <FormPresentation {...presentationProps} />
    </PopinManagerProvider>
  );
}

/**
 * Form Container Component
 * 
 * Uses React-Redux hooks to connect to Redux state and dispatch actions.
 * Initializes react-hook-form and syncs discriminant fields to Redux.
 */
export default function FormContainer() {
  // Use hooks to access Redux state
  const formState = useSelector((state: RootState) => getFormState(state));
  const dispatch = useDispatch<AppDispatch>();

  const {
    mergedDescriptor,
    caseContext,
    isRehydrating: isRehydratingFromRedux,
    formData,
    dataSourceCache,
  } = formState;

  // Get visible blocks and fields using selectors
  const visibleBlocks = useSelector((state: RootState) => getVisibleBlocks(state));
  const visibleFields = useSelector((state: RootState) => getVisibleFields(state));

  // Use debounced rehydration hook
  const { mutate: debouncedRehydrate, isPending: isRehydratingFromHook } = useDebouncedRehydration();

  // Combine rehydration states - use hook state if available, fallback to Redux
  const isRehydrating = isRehydratingFromHook || isRehydratingFromRedux;

  // Create callbacks for dispatching actions
  const syncFormData = useCallback(
    (formData: Partial<FormData>) => {
      dispatch(syncFormDataToContext({ formData }));
    },
    [dispatch]
  );

  const rehydrate = useCallback(
    (caseContext: CaseContext) => {
      // Use debounced rehydration hook instead of thunk
      debouncedRehydrate(caseContext);
    },
    [debouncedRehydrate]
  );

  const loadDataSource = useCallback(
    (fieldPath: string, url: string, auth?: { type: 'bearer' | 'apikey'; token?: string; headerName?: string }) => {
      // Dispatch thunk for data source loading
      // Note: This could be replaced with useDataSource hook in the future,
      // but the current pattern of callback-based loading works well for dynamic fields
      dispatch(fetchDataSourceThunk({ fieldPath, url, auth }));
    },
    [dispatch]
  );

  // Create a key based on validation rules and caseContext to force form remount
  // This ensures the Zod resolver is re-initialized with updated validation rules
  // and default values are re-evaluated when caseContext changes
  const formKey = useMemo(() => {
    if (!mergedDescriptor) {
      return 'no-descriptor';
    }
    // Create a hash of field IDs and their validation rule types
    // This will change when validation rules are updated (e.g., during re-hydration)
    const validationHash = mergedDescriptor.blocks
      .flatMap((block) => block.fields)
      .map((field) => {
        const ruleTypes = field.validation?.map((r) => {
          if (r.type === 'pattern') {
            // Include pattern value in hash to detect pattern changes
            const patternValue = typeof r.value === 'string' ? r.value : r.value.toString();
            return `${r.type}:${patternValue}`;
          }
          return `${r.type}:${'value' in r ? r.value : ''}`;
        }).join(',') || 'none';
        return `${field.id}:${ruleTypes}`;
      })
      .join('|');
    
    // Include caseContext in the key so form remounts when context changes
    // This allows default values to be re-evaluated with new context
    const contextHash = JSON.stringify(caseContext);
    
    return `form-${validationHash}-ctx-${contextHash}`;
  }, [mergedDescriptor, caseContext]);

  // Render inner form component with key to force remount when validation rules change
  // This ensures the form is re-created with the new Zod schema when rules are updated
  // Pass formData to restore values when form remounts
  return (
    <FormInner
      key={formKey}
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
  );
}
