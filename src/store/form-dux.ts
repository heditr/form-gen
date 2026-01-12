/**
 * Form Dux - Redux reducer, actions, and selectors for form state management
 * 
 * Transpiled from form-dux.sudo
 */

import type {
  GlobalFormDescriptor,
  CaseContext,
  RulesObject,
  BlockDescriptor,
  FieldDescriptor,
} from '@/types/form-descriptor';

export const slice = 'form' as const;

export interface FormState {
  globalDescriptor: GlobalFormDescriptor | null;
  mergedDescriptor: GlobalFormDescriptor | null;
  formData: Record<string, any>;
  caseContext: CaseContext;
  validationErrors: Record<string, string>;
  isRehydrating: boolean;
  dataSourceCache: Record<string, any>;
}

export interface RootState {
  [slice]: FormState;
}

export interface ActionObject<T = any> {
  type: string;
  payload: T;
}

export const initialState: FormState = {
  globalDescriptor: null,
  mergedDescriptor: null,
  formData: {},
  caseContext: {},
  validationErrors: {},
  isRehydrating: false,
  dataSourceCache: {},
};

// Action Creators
export const loadGlobalDescriptor = ({
  descriptor = null,
}: { descriptor?: GlobalFormDescriptor | null } = {}): ActionObject<{ descriptor: GlobalFormDescriptor | null }> => ({
  type: `${slice}/loadGlobalDescriptor`,
  payload: { descriptor },
});

export const updateFieldValue = ({
  fieldPath = '',
  value = null,
}: { fieldPath?: string; value?: any } = {}): ActionObject<{ fieldPath: string; value: any }> => ({
  type: `${slice}/updateFieldValue`,
  payload: { fieldPath, value },
});

export const triggerRehydration = (): ActionObject => ({
  type: `${slice}/triggerRehydration`,
  payload: {},
});

export const applyRulesUpdate = ({
  rulesObject = null,
}: { rulesObject?: RulesObject | null } = {}): ActionObject<{ rulesObject: RulesObject | null }> => ({
  type: `${slice}/applyRulesUpdate`,
  payload: { rulesObject },
});

export const setValidationErrors = ({
  errors = {},
}: { errors?: Record<string, string> } = {}): ActionObject<{ errors: Record<string, string> }> => ({
  type: `${slice}/setValidationErrors`,
  payload: { errors },
});

export const loadDataSource = ({
  fieldPath = '',
  data = null,
}: { fieldPath?: string; data?: any } = {}): ActionObject<{ fieldPath: string; data: any }> => ({
  type: `${slice}/loadDataSource`,
  payload: { fieldPath, data },
});

// Reducer
export const reducer = (state: FormState = initialState, action: ActionObject): FormState => {
  switch (action.type) {
    case loadGlobalDescriptor().type: {
      const { descriptor } = action.payload as { descriptor: GlobalFormDescriptor | null };
      return {
        ...state,
        globalDescriptor: descriptor,
        mergedDescriptor: descriptor,
      };
    }

    case updateFieldValue().type: {
      const { fieldPath, value } = action.payload as { fieldPath: string; value: any };
      const newFormData = {
        ...state.formData,
        [fieldPath]: value,
      };
      
      // Update caseContext if this is a discriminant field
      // Note: Discriminant detection will be implemented in a later task
      const newCaseContext = { ...state.caseContext };
      
      return {
        ...state,
        formData: newFormData,
        caseContext: newCaseContext,
      };
    }

    case triggerRehydration().type: {
      return {
        ...state,
        isRehydrating: true,
      };
    }

    case applyRulesUpdate().type: {
      const { rulesObject } = action.payload as { rulesObject: RulesObject | null };
      // Deep merge rules into mergedDescriptor
      // Note: Deep merge logic will be implemented in a later task
      // For now, just preserve the existing mergedDescriptor since RulesObject
      // has a different structure and merging will be handled in a later task
      const updatedMergedDescriptor = state.mergedDescriptor;
      
      return {
        ...state,
        mergedDescriptor: updatedMergedDescriptor,
        isRehydrating: false,
      };
    }

    case setValidationErrors().type: {
      const { errors } = action.payload as { errors: Record<string, string> };
      return {
        ...state,
        validationErrors: errors,
      };
    }

    case loadDataSource().type: {
      const { fieldPath, data } = action.payload as { fieldPath: string; data: any };
      return {
        ...state,
        dataSourceCache: {
          ...state.dataSourceCache,
          [fieldPath]: data,
        },
      };
    }

    default:
      return state;
  }
};

// Selectors
export const getFormState = (state: RootState): FormState => state[slice];

export const getVisibleBlocks = (state: RootState): BlockDescriptor[] => {
  const mergedDescriptor = state[slice].mergedDescriptor;
  if (!mergedDescriptor || !mergedDescriptor.blocks) {
    return [];
  }
  // Note: Status template evaluation will be implemented in a later task
  // For now, return all blocks
  return mergedDescriptor.blocks;
};

export const getVisibleFields = (state: RootState): FieldDescriptor[] => {
  const blocks = getVisibleBlocks(state);
  return blocks.flatMap((block) => block.fields || []);
};

export const getValidationErrorsByField = (state: RootState): Record<string, string> => 
  state[slice].validationErrors;
