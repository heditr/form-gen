/**
 * Form Dux - Redux reducer, actions, and selectors for form state management
 * 
 * Transpiled from form-dux.sudo
 * 
 * Note: formData and validationErrors are managed by react-hook-form, not Redux.
 * formData in Redux state is synced from react-hook-form for context extraction purposes.
 */

import { createSelector } from '@reduxjs/toolkit';
import type {
  GlobalFormDescriptor,
  CaseContext,
  CasePrefill,
  RulesObject,
  BlockDescriptor,
  FieldDescriptor,
  FormData,
} from '@/types/form-descriptor';
import { mergeDescriptorWithRules } from '@/utils/descriptor-merger';
import { initializeCaseContext } from '@/utils/context-extractor';
import {
  fetchGlobalDescriptorThunk,
  rehydrateRulesThunk,
  fetchDataSourceThunk,
} from './form-thunks';

export const slice = 'form' as const;

export interface FormState {
  globalDescriptor: GlobalFormDescriptor | null;
  mergedDescriptor: GlobalFormDescriptor | null;
  formData: Partial<FormData>;
  caseContext: CaseContext;
  isRehydrating: boolean;
  dataSourceCache: Record<string, unknown>;
}

export interface RootState {
  [slice]: FormState;
}

export interface ActionObject<T = unknown> {
  type: string;
  payload: T;
  [key: string]: unknown;
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
}: { formData?: Partial<FormData> } = {}): ActionObject<{ formData: Partial<FormData> }> => ({
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
}: { fieldPath?: string; data?: unknown } = {}): ActionObject<{ fieldPath: string; data: unknown }> => ({
  type: `${slice}/loadDataSource`,
  payload: { fieldPath, data },
});

/**
 * Initialize or update CaseContext from CasePrefill
 * 
 * Use this when:
 * - Case is first created and you have CasePrefill data
 * - Case data is fetched from the server and you want to update the context
 * 
 * This will merge the prefill values into the existing context, preserving
 * any context values that were already set from form data.
 * 
 * @param casePrefill - Case prefill data with initial values
 */
export const initializeCaseContextFromPrefill = ({
  casePrefill = {},
}: { casePrefill?: CasePrefill } = {}): ActionObject<{ caseContext: CaseContext }> => {
  const caseContext = initializeCaseContext(casePrefill);
  return {
    type: `${slice}/initializeCaseContextFromPrefill`,
    payload: { caseContext },
  };
};

/**
 * Update CaseContext with arbitrary values
 * 
 * Use this when you need to set caseContext values that aren't part of CasePrefill,
 * such as custom fields for template evaluation (e.g., email, phone, etc.)
 * 
 * This will merge the provided values into the existing context.
 * 
 * @param caseContext - Partial CaseContext with values to set
 */
export const updateCaseContextValues = ({
  caseContext: newContextValues = {},
}: { caseContext?: Partial<CaseContext> } = {}): ActionObject<{ caseContext: Partial<CaseContext> }> => ({
  type: `${slice}/updateCaseContextValues`,
  payload: { caseContext: newContextValues },
});

// Reducer
// Action can be either our custom ActionObject or Redux Toolkit thunk actions
export const reducer = (state: FormState = initialState, action: ActionObject | { type: string; payload?: unknown; meta?: { arg?: unknown }; error?: unknown }): FormState => {
  // Handle thunk actions using Redux Toolkit's action matchers
  // These take precedence over regular action handlers for thunk operations
  
  // Handle fetchGlobalDescriptorThunk fulfilled
  if (fetchGlobalDescriptorThunk.fulfilled.match(action)) {
    const descriptor = action.payload as GlobalFormDescriptor;
    return {
      ...state,
      globalDescriptor: descriptor,
      mergedDescriptor: descriptor,
    };
  }

  // Handle rehydrateRulesThunk pending
  if (rehydrateRulesThunk.pending.match(action)) {
    return {
      ...state,
      isRehydrating: true,
    };
  }

  // Handle rehydrateRulesThunk fulfilled
  if (rehydrateRulesThunk.fulfilled.match(action)) {
    const rulesObject = action.payload as RulesObject;
    
    if (!rulesObject || !state.globalDescriptor) {
      return {
        ...state,
        isRehydrating: false,
      };
    }
    
    // Merge rules into the global descriptor to create updated merged descriptor
    const updatedMergedDescriptor = mergeDescriptorWithRules(state.globalDescriptor, rulesObject);
    
    return {
      ...state,
      mergedDescriptor: updatedMergedDescriptor,
      isRehydrating: false,
    };
  }

  // Handle rehydrateRulesThunk rejected
  if (rehydrateRulesThunk.rejected.match(action)) {
    return {
      ...state,
      isRehydrating: false,
    };
  }

  // Handle fetchDataSourceThunk fulfilled
  if (fetchDataSourceThunk.fulfilled.match(action)) {
    const { fieldPath } = action.meta.arg as { fieldPath: string; url: string; auth?: unknown };
    const data = action.payload;
    return {
      ...state,
      dataSourceCache: {
        ...state.dataSourceCache,
        [fieldPath]: data,
      },
    };
  }

  // Handle regular (non-thunk) actions
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
      const { formData } = action.payload as { formData: Partial<FormData> };
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
      // Deep merge rules into mergedDescriptor
      const { rulesObject } = action.payload as { rulesObject: RulesObject | null };
      
      if (!rulesObject || !state.globalDescriptor) {
        // If no rules or no global descriptor, just preserve existing state
        return {
          ...state,
          isRehydrating: false,
        };
      }
      
      // Merge rules into the global descriptor to create updated merged descriptor
      const updatedMergedDescriptor = mergeDescriptorWithRules(state.globalDescriptor, rulesObject);
      
      return {
        ...state,
        mergedDescriptor: updatedMergedDescriptor,
        isRehydrating: false,
      };
    }

    case loadDataSource().type: {
      const { fieldPath, data } = action.payload as { fieldPath: string; data: unknown };
      return {
        ...state,
        dataSourceCache: {
          ...state.dataSourceCache,
          [fieldPath]: data,
        },
      };
    }

    case initializeCaseContextFromPrefill().type: {
      const { caseContext } = action.payload as { caseContext: CaseContext };
      // Merge with existing context to preserve any values already set from form data
      // The prefill values take precedence for the specific fields they define
      return {
        ...state,
        caseContext: {
          ...state.caseContext,
          ...caseContext,
        },
      };
    }

    case updateCaseContextValues().type: {
      const { caseContext: newContextValues } = action.payload as { caseContext: Partial<CaseContext> };
      // Merge with existing context to preserve any values already set from form data
      // The new values take precedence for the specific fields they define
      return {
        ...state,
        caseContext: {
          ...state.caseContext,
          ...newContextValues,
        },
      };
    }

    default:
      return state;
  }
};

// Selectors
export const getFormState = (state: RootState): FormState => state[slice];

// Memoized selector for visible blocks
// Returns the same array reference if mergedDescriptor.blocks hasn't changed
export const getVisibleBlocks = createSelector(
  [getFormState],
  (formState): BlockDescriptor[] => {
    const mergedDescriptor = formState.mergedDescriptor;
    if (!mergedDescriptor || !mergedDescriptor.blocks) {
      return [];
    }
    // Note: Status template evaluation will be implemented in a later task
    // For now, return all blocks
    return mergedDescriptor.blocks;
  }
);

// Memoized selector for visible fields
// Returns the same array reference if blocks haven't changed
export const getVisibleFields = createSelector(
  [getVisibleBlocks],
  (blocks): FieldDescriptor[] => {
    return blocks.flatMap((block) => block.fields || []);
  }
);

