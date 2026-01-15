/**
 * Form Container Component
 * 
 * Redux-connected container that integrates react-hook-form with Redux.
 * Follows container/presentation pattern - no UI markup, only connect logic.
 */

import { connect } from 'react-redux';
import { useMemo, useCallback } from 'react';
import type { ComponentType } from 'react';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { GlobalFormDescriptor, BlockDescriptor, FieldDescriptor, FormData, CaseContext } from '@/types/form-descriptor';
import { useFormDescriptor } from '@/hooks/use-form-descriptor';
import {
  getVisibleBlocks,
  getVisibleFields,
  getFormState,
  syncFormDataToContext,
  type RootState,
} from '@/store/form-dux';
import { rehydrateRules, fetchDataSource } from '@/store/form-sagas';
import { updateCaseContext, identifyDiscriminantFields, hasContextChanged } from '@/utils/context-extractor';
import FormPresentation from './form-presentation';

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
 * Redux state props
 */
interface StateProps {
  mergedDescriptor: GlobalFormDescriptor | null;
  visibleBlocks: BlockDescriptor[];
  visibleFields: FieldDescriptor[];
  caseContext: CaseContext;
  isRehydrating: boolean;
  formData: Partial<FormData>;
  dataSourceCache: Record<string, unknown>;
}

/**
 * Redux dispatch props
 */
interface DispatchProps {
  syncFormDataToContext: (formData: Partial<FormData>) => void;
  rehydrateRules: (caseContext: CaseContext) => void;
  fetchDataSource: (fieldPath: string, url: string, auth?: { type: 'bearer' | 'apikey'; token?: string; headerName?: string }) => void;
}

/**
 * Container component props
 */
type FormContainerProps = StateProps & DispatchProps;

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
        rehydrate(updatedContext);
      }
    },
    [mergedDescriptor, visibleFields, caseContext, syncFormData, rehydrate]
  );

  // Initialize useFormDescriptor hook - this will create a new form instance
  // when this component remounts (due to key change)
  // Pass savedFormData to restore form values from Redux
  const { form } = useFormDescriptor(mergedDescriptor, {
    onDiscriminantChange: handleDiscriminantChange,
    savedFormData, // Restore form values from Redux when form remounts
  });

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

  return <FormPresentation {...presentationProps} />;
}

/**
 * Form Container Component
 * 
 * Connects Redux state and actions to presentation component.
 * Initializes react-hook-form and syncs discriminant fields to Redux.
 */
function FormContainerComponent({
  mergedDescriptor,
  visibleBlocks,
  visibleFields,
  caseContext,
  isRehydrating,
  formData, // Used for context extraction and form value restoration
  dataSourceCache,
  syncFormDataToContext: syncFormData,
  rehydrateRules: rehydrate,
  fetchDataSource: loadDataSource,
}: FormContainerProps) {
  // Create a key based on validation rules to force form remount when rules change
  // This ensures the Zod resolver is re-initialized with updated validation rules
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
    return `form-${validationHash}`;
  }, [mergedDescriptor]);

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

/**
 * Map Redux state to component props
 */
const mapStateToProps = (state: RootState): StateProps => {
  const formState = getFormState(state);
  return {
    mergedDescriptor: formState.mergedDescriptor,
    visibleBlocks: getVisibleBlocks(state),
    visibleFields: getVisibleFields(state),
    caseContext: formState.caseContext,
    isRehydrating: formState.isRehydrating,
    formData: formState.formData,
    dataSourceCache: formState.dataSourceCache,
  };
};

/**
 * Map Redux actions to component props
 */
const mapDispatchToProps: DispatchProps = {
  syncFormDataToContext,
  rehydrateRules,
  fetchDataSource,
};

/**
 * Connected Form Container Component
 */
const FormContainer = connect(mapStateToProps, mapDispatchToProps)(FormContainerComponent) as ComponentType;

export default FormContainer;
