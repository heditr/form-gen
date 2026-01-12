/**
 * Form Dux - Redux reducer, actions, and selectors for form state management
 * 
 * Transpiled from form-dux.sudo
 * 
 * Note: formData and validationErrors are managed by react-hook-form, not Redux.
 * formData in Redux state is synced from react-hook-form for context extraction purposes.
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

export const syncFormDataToContext = ({
  formData = {},
}: { formData?: Record<string, any> } = {}): ActionObject<{ formData: Record<string, any> }> => ({
  type: `${slice}/syncFormDataToContext`,
  payload: { formData },
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

    case syncFormDataToContext().type: {
      const { formData } = action.payload as { formData: Record<string, any> };
      return {
        ...state,
        formData,
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

