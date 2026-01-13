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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  formData: _formData, // Used for context extraction, not directly in component
  dataSourceCache,
  syncFormDataToContext: syncFormData,
  rehydrateRules: rehydrate,
  fetchDataSource: loadDataSource,
}: FormContainerProps) {
  // Initialize react-hook-form with descriptor
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

  // Initialize useFormDescriptor hook
  const { form } = useFormDescriptor(mergedDescriptor, {
    onDiscriminantChange: handleDiscriminantChange,
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

  // Render presentation component (no UI markup in container)
  return <FormPresentation {...presentationProps} />;
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
