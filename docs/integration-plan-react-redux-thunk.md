# Form Descriptor Engine Integration Plan
## For React + react-hook-form + TanStack Query + Redux (Redux Thunk)

This document provides a comprehensive plan for integrating the form descriptor engine into an existing project that uses:
- **React** (instead of Next.js)
- **react-hook-form** (already compatible)
- **TanStack Query** (instead of Redux Saga for data fetching)
- **Redux with Redux Thunk** (instead of Redux Saga)

---

## Table of Contents

1. [Overview](#overview)
2. [Core Components to Take](#core-components-to-take)
3. [Utilities to Take](#utilities-to-take)
4. [Types to Take](#types-to-take)
5. [Redux Store Adaptation](#redux-store-adaptation)
6. [Async Operations Migration](#async-operations-migration)
7. [Component Integration](#component-integration)
8. [Dependencies](#dependencies)
9. [Step-by-Step Integration Guide](#step-by-step-integration-guide)

---

## Overview

The form descriptor engine uses a hybrid architecture:
- **Redux**: Manages global state (descriptor, context, re-hydration status, data source cache)
- **react-hook-form**: Manages form state (field values, validation, errors)
- **Handlebars**: Evaluates templates for conditional visibility, disabled states, and dynamic URLs
- **One-way sync**: react-hook-form → Redux (for context extraction and value preservation)

### Key Differences in Target Stack

| Current Stack | Target Stack | Adaptation Needed |
|--------------|--------------|-------------------|
| Next.js | React | Remove Next.js-specific code (API routes, `next/font`, etc.) |
| Redux Saga | Redux Thunk + TanStack Query | Convert sagas to thunks, use TanStack Query for data fetching |
| `connect()` HOC | React-Redux hooks | Use `useSelector` and `useDispatch` instead of `connect()` |

---

## Core Components to Take

### 1. Form Components (Take As-Is)

**Location**: `src/components/`

**Files to Copy**:
- ✅ `form-container.tsx` - **Needs adaptation** (see below)
- ✅ `form-presentation.tsx` - Take as-is
- ✅ `block.tsx` - Take as-is
- ✅ `field-wrapper.tsx` - Take as-is
- ✅ `text-field.tsx` - Take as-is
- ✅ `number-field.tsx` - Take as-is
- ✅ `checkbox-field.tsx` - Take as-is
- ✅ `date-field.tsx` - Take as-is
- ✅ `file-field.tsx` - Take as-is
- ✅ `dropdown-field.tsx` - Take as-is
- ✅ `autocomplete-field.tsx` - Take as-is
- ✅ `radio-field.tsx` - Take as-is
- ✅ `submit-button.tsx` - Take as-is

**Adaptation Notes**:
- `form-container.tsx`: Convert from `connect()` HOC to React-Redux hooks (`useSelector`, `useDispatch`)
- All field components use `react-hook-form` which is already compatible

### 2. Hooks (Take As-Is)

**Location**: `src/hooks/`

**Files to Copy**:
- ✅ `use-form-descriptor.ts` - Take as-is (already uses react-hook-form)

**No changes needed** - this hook is framework-agnostic.

---

## Utilities to Take

**Location**: `src/utils/`

**Files to Copy** (All take as-is):
- ✅ `context-extractor.ts` - Extract and manage case context
- ✅ `descriptor-merger.ts` - Merge rules into form descriptor
- ✅ `data-source-loader.ts` - Load dynamic field data from APIs
- ✅ `response-transformer.ts` - Transform API responses using Handlebars templates
- ✅ `form-descriptor-integration.ts` - Integration utilities (default values, Zod schema building)
- ✅ `template-evaluator.ts` - Evaluate Handlebars templates with form context
- ✅ `handlebars-helpers.ts` - Custom Handlebars helpers
- ✅ `validation-rule-adapter.ts` - Convert validation rules to Zod/React Hook Form format
- ✅ `rehydration-orchestrator.ts` - Orchestrate re-hydration flow (if exists)
- ✅ `submission-orchestrator.ts` - Orchestrate form submission (if exists)

**No changes needed** - these utilities are framework-agnostic.

---

## Types to Take

**Location**: `src/types/`

**Files to Copy**:
- ✅ `form-descriptor.ts` - **Take as-is** (all type definitions)

**No changes needed** - TypeScript types are framework-agnostic.

---

## Redux Store Adaptation

### Implementation (Redux Thunk + TanStack Query)

**Location**: `src/store/`

**Files**:
- `form-dux.ts` - Redux reducer, actions, selectors
- `form-thunks.ts` - Redux thunks for async operations that update Redux state
- `store.ts` - Redux store with Redux Toolkit (includes Redux Thunk by default)

#### 1. Redux Dux (Take with Minor Changes)

**File**: `src/store/form-dux.ts`

**Changes Needed**:
- ✅ **Take as-is** - Reducer, actions, and selectors work with Redux Thunk
- ✅ **Add thunk action handlers** - Handle `fulfilled`, `pending`, and `rejected` action types from thunks
- ✅ **Keep all action creators** - they work with thunks and are used for manual dispatches

**What to Copy**:
```typescript
// Copy entire file, but remove saga-specific exports
export const slice = 'form' as const;
export interface FormState { ... }
export const initialState: FormState = { ... };
export const loadGlobalDescriptor = ...;
export const syncFormDataToContext = ...;
export const applyRulesUpdate = ...;
export const loadDataSource = ...;
export const reducer = ...;
export const getFormState = ...;
export const getVisibleBlocks = ...;
export const getVisibleFields = ...;
```

#### 2. Redux Thunks (New File)

**File**: `src/store/form-thunks.ts`

**Purpose**: Redux thunks for async operations that update Redux state

**Key Thunks to Create**:

```typescript
// 1. Fetch Global Descriptor Thunk
export const fetchGlobalDescriptorThunk = createAsyncThunk(
  'form/fetchGlobalDescriptor',
  async (endpoint: string = '/api/form/global-descriptor') => {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error('Failed to fetch descriptor');
    return await response.json();
  }
);

// 2. Rehydrate Rules Thunk (with debouncing)
export const rehydrateRulesThunk = createAsyncThunk(
  'form/rehydrateRules',
  async (caseContext: CaseContext, { dispatch }) => {
    // Debounce logic (use lodash.debounce or custom implementation)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    dispatch(triggerRehydration());
    
    const response = await fetch('/api/rules/context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(caseContext),
    });
    
    if (!response.ok) throw new Error('Failed to rehydrate rules');
    return await response.json();
  }
);

// 3. Load Data Source Thunk
interface AuthConfig {
  type: 'bearer' | 'apikey';
  token?: string;
  headerName?: string;
}

export const fetchDataSourceThunk = createAsyncThunk(
  'form/fetchDataSource',
  async ({ fieldPath, url, auth }: { fieldPath: string; url: string; auth?: AuthConfig }, { getState }) => {
    const state = getState() as RootState;
    const formState = getFormState(state);
    const { mergedDescriptor, formData } = formState;
    
    // Find field descriptor and load data (same logic as saga)
    // ... (use loadDataSourceUtil from utils)
  }
);

// 4. Submit Form Thunk
interface SubmitFormParams {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH';
  formData: Partial<FormData>;
  headers?: Record<string, string>;
  auth?: {
    type: 'bearer' | 'apikey';
    token?: string;
    headerName?: string;
  };
}

export const submitFormThunk = createAsyncThunk(
  'form/submitForm',
  async ({ url, method, formData, headers, auth }: SubmitFormParams) => {
    // Build headers with auth
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };
    
    if (auth) {
      if (auth.type === 'bearer' && auth.token) {
        requestHeaders['Authorization'] = `Bearer ${auth.token}`;
      } else if (auth.type === 'apikey' && auth.token && auth.headerName) {
        requestHeaders[auth.headerName] = auth.token;
      }
    }
    
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: JSON.stringify(formData),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Form submission failed');
    }
    
    return await response.json();
  }
);
```

**Reducer Updates** (in `form-dux.ts`):

The reducer handles both regular actions and thunk actions using Redux Toolkit's `.match()` method:

```typescript
import { fetchGlobalDescriptorThunk, rehydrateRulesThunk, fetchDataSourceThunk } from './form-thunks';

export const reducer = (state: FormState = initialState, action: ActionObject | any): FormState => {
  // Handle thunk actions first (they take precedence)
  
  // fetchGlobalDescriptorThunk.fulfilled
  if (fetchGlobalDescriptorThunk.fulfilled.match(action)) {
    return {
      ...state,
      globalDescriptor: action.payload,
      mergedDescriptor: action.payload,
    };
  }
  
  // rehydrateRulesThunk.pending
  if (rehydrateRulesThunk.pending.match(action)) {
    return { ...state, isRehydrating: true };
  }
  
  // rehydrateRulesThunk.fulfilled
  if (rehydrateRulesThunk.fulfilled.match(action)) {
    const rulesObject = action.payload;
    if (rulesObject && state.globalDescriptor) {
      const updatedMergedDescriptor = mergeDescriptorWithRules(
        state.globalDescriptor,
        rulesObject
      );
      return {
        ...state,
        mergedDescriptor: updatedMergedDescriptor,
        isRehydrating: false,
      };
    }
    return { ...state, isRehydrating: false };
  }
  
  // rehydrateRulesThunk.rejected
  if (rehydrateRulesThunk.rejected.match(action)) {
    return { ...state, isRehydrating: false };
  }
  
  // fetchDataSourceThunk.fulfilled
  if (fetchDataSourceThunk.fulfilled.match(action)) {
    const { fieldPath } = action.meta.arg;
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
    // ... existing cases for loadGlobalDescriptor, syncFormDataToContext, etc.
  }
};
```

#### 3. Store Configuration (Adapt)

**File**: `src/store/store.ts`

**Implementation**:
```typescript
import { configureStore } from '@reduxjs/toolkit';
import { reducer } from './form-dux';

export const store = configureStore({
  reducer: {
    form: reducer,
  },
  // Redux Thunk is included by default in Redux Toolkit
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

---

## Async Operations Migration

### Option 1: Redux Thunk (Recommended for Redux State)

Use Redux thunks for operations that need to update Redux state:
- ✅ Fetching global descriptor → Updates `globalDescriptor` and `mergedDescriptor`
- ✅ Rehydrating rules → Updates `mergedDescriptor` and `isRehydrating`
- ✅ Loading data sources → Updates `dataSourceCache`

### Option 2: TanStack Query (Recommended for Server State)

Use TanStack Query for operations that are pure server state:
- ✅ Fetching global descriptor (if you want caching, refetching, etc.)
- ✅ Rehydrating rules (if you want automatic refetching on context change)
- ✅ Loading data sources (excellent for caching and invalidation)

### Hybrid Approach (Implemented)

**Use TanStack Query for**:
- ✅ Fetching global descriptor (`useGlobalDescriptor` hook)
  - Automatic caching with 5-minute stale time
  - Automatic Redux state synchronization on success
  - Request deduplication
- ✅ Loading data sources (`useDataSource` hook)
  - Dynamic query keys based on fieldPath and evaluated URL
  - 2-minute stale time for frequently changing data
  - Automatic Redux cache synchronization
- ✅ Form submission (`useSubmitForm` hook)
  - Mutation-based (no caching)

**Use Redux Thunk for**:
- ✅ Rehydrating rules (`rehydrateRulesThunk`)
  - Updates Redux state immediately
  - Includes 500ms debouncing
  - Can be replaced with `useDebouncedRehydration` hook for TanStack Query mutation
- ✅ Syncing form data to Redux (`syncFormDataToContext` action)

**TanStack Query Hooks** (`src/hooks/use-form-query.ts`):

```typescript
// Fetch global descriptor with automatic Redux sync
export function useGlobalDescriptor(
  endpoint: string = '/api/form/global-descriptor',
  options?: UseQueryOptions
) {
  // Automatically syncs to Redux via useEffect when data is available
  // Stale time: 5 minutes (descriptors rarely change)
  // Cache time: 30 minutes
}

// Load data source with automatic Redux cache sync
export function useDataSource(
  params: { fieldPath: string; config: DataSourceConfig; formContext: FormContext; enabled?: boolean },
  options?: UseQueryOptions
) {
  // Automatically syncs to Redux dataSourceCache via useEffect
  // Stale time: 2 minutes (data sources may change more frequently)
  // Cache time: 10 minutes
}

// Submit form (mutation, no caching)
export function useSubmitForm(options?: UseMutationOptions) {
  // Returns mutation object for form submission
}
```

**Debounced Rehydration Hook** (`src/hooks/use-debounced-rehydration.ts`):

```typescript
// Custom hook combining debouncing with TanStack Query mutation
export function useDebouncedRehydration() {
  // Debounces CaseContext changes by 500ms
  // Cancels previous calls on rapid changes
  // Automatically syncs to Redux on success/error
  return {
    mutate: (caseContext: CaseContext) => void,
    isPending: boolean,
    isError: boolean,
    isSuccess: boolean,
    error: Error | null,
    data: RulesObject | undefined,
  };
}
```

**Caching Configuration**:

- **Global Descriptor**: 
  - Stale time: 5 minutes (rarely changes)
  - Cache time: 30 minutes
  - Query key: `['form', 'global-descriptor', endpoint]`

- **Data Sources**:
  - Stale time: 2 minutes (may change more frequently)
  - Cache time: 10 minutes
  - Query key: `['form', 'data-source', fieldPath, evaluatedUrl]`
  - Dynamic keys ensure proper cache invalidation when form context changes

- **Redux State Sync**:
  - All TanStack Query hooks automatically sync to Redux state via `useEffect`
  - Ensures compatibility with existing Redux-based components
  - Provides single source of truth in Redux while benefiting from Query caching

**Integration in Form Container**:

```typescript
// In form-container.tsx
import { useSelector, useDispatch } from 'react-redux';
import { rehydrateRulesThunk, fetchDataSourceThunk } from '@/store/form-thunks';
import type { AppDispatch } from '@/store/store';

export default function FormContainer() {
  // Use hooks to access Redux state
  const formState = useSelector((state: RootState) => getFormState(state));
  const dispatch = useDispatch<AppDispatch>();

  // Create callbacks for dispatching thunks
  const rehydrate = useCallback(
    (caseContext: CaseContext) => {
      dispatch(rehydrateRulesThunk(caseContext));
      // Or use: useDebouncedRehydration() hook for TanStack Query mutation
    },
    [dispatch]
  );

  const loadDataSource = useCallback(
    (fieldPath: string, url: string, auth?: AuthConfig) => {
      dispatch(fetchDataSourceThunk({ fieldPath, url, auth }));
    },
    [dispatch]
  );

  // ... rest of component
}
```

**Note**: Global descriptor loading is typically handled by parent pages using `useGlobalDescriptor()` hook, which automatically syncs to Redux.

---

## Component Integration

### Form Container Adaptation

**Implementation** (using React-Redux hooks):
```typescript
import { useSelector, useDispatch } from 'react-redux';
import type { AppDispatch } from '@/store/store';
import { getFormState, getVisibleBlocks, getVisibleFields, syncFormDataToContext } from '@/store/form-dux';
import { rehydrateRulesThunk, fetchDataSourceThunk } from '@/store/form-thunks';

function FormContainer() {
  const dispatch = useDispatch();
  const formState = useSelector(getFormState);
  const visibleBlocks = useSelector(getVisibleBlocks);
  const visibleFields = useSelector(getVisibleFields);
  
  const handleDiscriminantChange = useCallback((newFormData: Partial<FormData>) => {
    dispatch(syncFormDataToContext({ formData: newFormData }));
    // ... context extraction and rehydration logic
    dispatch(rehydrateRulesThunk(updatedContext));
  }, [dispatch]);
  
  // ... rest of component
}
```

**Complete Adapted Form Container**:

```typescript
import { useMemo, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { GlobalFormDescriptor, FormData, CaseContext } from '@/types/form-descriptor';
import { useFormDescriptor } from '@/hooks/use-form-descriptor';
import {
  getFormState,
  getVisibleBlocks,
  getVisibleFields,
  syncFormDataToContext,
  type RootState,
} from '@/store/form-dux';
import { rehydrateRulesThunk, fetchDataSourceThunk } from '@/store/form-thunks';
import { updateCaseContext, identifyDiscriminantFields, hasContextChanged } from '@/utils/context-extractor';
import FormPresentation from './form-presentation';

function FormContainer() {
  const dispatch = useDispatch();
  const formState = useSelector(getFormState);
  const visibleBlocks = useSelector(getVisibleBlocks);
  const visibleFields = useSelector(getVisibleFields);
  
  const {
    mergedDescriptor,
    caseContext,
    isRehydrating,
    formData: savedFormData,
    dataSourceCache,
  } = formState;

  const handleDiscriminantChange = useCallback(
    (newFormData: Partial<FormData>) => {
      dispatch(syncFormDataToContext({ formData: newFormData }));

      const discriminantFields = mergedDescriptor
        ? identifyDiscriminantFields(visibleFields)
        : [];

      if (discriminantFields.length === 0) {
        return;
      }

      const updatedContext = updateCaseContext(caseContext, newFormData, discriminantFields);

      if (hasContextChanged(caseContext, updatedContext)) {
        dispatch(rehydrateRulesThunk(updatedContext));
      }
    },
    [dispatch, mergedDescriptor, visibleFields, caseContext]
  );

  const formKey = useMemo(() => {
    if (!mergedDescriptor) {
      return 'no-descriptor';
    }
    const validationHash = mergedDescriptor.blocks
      .flatMap((block) => block.fields)
      .map((field) => {
        const ruleTypes = field.validation?.map((r) => {
          if (r.type === 'pattern') {
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

  const { form } = useFormDescriptor(mergedDescriptor, {
    onDiscriminantChange: handleDiscriminantChange,
    savedFormData,
  });

  const handleLoadDataSource = useCallback(
    (fieldPath: string, url: string, auth?: { type: 'bearer' | 'apikey'; token?: string; headerName?: string }) => {
      dispatch(fetchDataSourceThunk({ fieldPath, url, auth }));
    },
    [dispatch]
  );

  return (
    <FormPresentation
      key={formKey}
      form={form}
      visibleBlocks={visibleBlocks}
      visibleFields={visibleFields}
      isRehydrating={isRehydrating}
      mergedDescriptor={mergedDescriptor}
      onLoadDataSource={handleLoadDataSource}
      dataSourceCache={dataSourceCache}
    />
  );
}

export default FormContainer;
```

---

## Dependencies

### Required Dependencies

**Copy from `package.json`**:
```json
{
  "dependencies": {
    "@hookform/resolvers": "^5.2.2",
    "handlebars": "^4.7.8",
    "react": "^19.2.3",
    "react-dom": "^19.2.3",
    "react-hook-form": "^7.71.0",
    "react-redux": "^9.2.0",
    "redux": "^5.0.1",
    "@reduxjs/toolkit": "^2.0.0",  // Add this for Redux Thunk support
    "zod": "^4.3.5"
  }
}
```

**If using TanStack Query**:
```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.0.0"
  }
}
```

### Remove Dependencies

**Don't install**:
- ❌ `redux-saga` - Not needed with Redux Thunk
- ❌ `next` - Not using Next.js
- ❌ `@tailwindcss/postcss`, `tailwindcss` - Only if not using Tailwind in target project

### Optional Dependencies

**For debouncing** (if not using TanStack Query's built-in debouncing):
```json
{
  "dependencies": {
    "lodash.debounce": "^4.0.8"
  }
}
```

---

## Step-by-Step Integration Guide

### Phase 1: Setup Dependencies

1. **Install required packages**:
   ```bash
   npm install @hookform/resolvers handlebars react-hook-form react-redux redux @reduxjs/toolkit zod
   npm install @tanstack/react-query  # Optional, if using TanStack Query
   ```

2. **Install TypeScript types** (if using TypeScript):
   ```bash
   npm install --save-dev @types/handlebars @types/lodash.debounce
   ```

### Phase 2: Copy Core Files

1. **Copy types**:
   - Copy `src/types/form-descriptor.ts` → `src/types/form-descriptor.ts`

2. **Copy utilities**:
   - Copy entire `src/utils/` directory → `src/utils/`

3. **Copy hooks**:
   - Copy `src/hooks/use-form-descriptor.ts` → `src/hooks/use-form-descriptor.ts`

4. **Copy components**:
   - Copy `src/components/block.tsx` → `src/components/block.tsx`
   - Copy `src/components/field-wrapper.tsx` → `src/components/field-wrapper.tsx`
   - Copy `src/components/form-presentation.tsx` → `src/components/form-presentation.tsx`
   - Copy all `*-field.tsx` components → `src/components/`
   - Copy `src/components/submit-button.tsx` → `src/components/submit-button.tsx`

### Phase 3: Setup Redux Store

1. **Copy and adapt Redux dux**:
   - Copy `src/store/form-dux.ts` → `src/store/form-dux.ts`
   - Remove any saga-specific code

2. **Create Redux thunks**:
   - Create `src/store/form-thunks.ts` with thunk implementations (see [Redux Thunks](#2-redux-thunks-new-file) section)

3. **Update reducer**:
   - Add thunk action handlers to `form-dux.ts` reducer

4. **Configure store**:
   - Create/update `src/store/store.ts` with Redux Toolkit configuration
   - Add form reducer to store

### Phase 4: Adapt Form Container

1. **Convert to hooks**:
   - Replace `connect()` HOC with `useSelector` and `useDispatch`
   - Update action dispatches to use thunks

2. **Integrate TanStack Query** (if using):
   - Create `src/hooks/use-form-descriptor-query.ts`
   - Update form container to use queries/mutations

### Phase 5: Setup API Endpoints

1. **Create API endpoints** (if not using Next.js API routes):
   - `/api/form/global-descriptor` - GET endpoint
   - `/api/rules/context` - POST endpoint
   - `/api/data-sources/*` - GET endpoints for dynamic data

2. **Update endpoint URLs** in thunks/queries to match your API structure

### Phase 6: Integration Testing

1. **Test form initialization**:
   - Verify global descriptor loads
   - Verify form renders with correct fields

2. **Test discriminant field changes**:
   - Change discriminant field (e.g., country)
   - Verify re-hydration triggers
   - Verify validation rules update
   - Verify form values are preserved

3. **Test data source loading**:
   - Verify dropdown/autocomplete fields load data
   - Verify caching works

4. **Test form submission**:
   - Verify form submits correctly
   - Verify backend errors are mapped to form errors

---

## Key Adaptation Points Summary

| Component | Current | Target | Changes |
|----------|---------|--------|---------|
| **Store** | Redux Saga | Redux Toolkit (includes Redux Thunk) | Redux Toolkit includes thunk middleware by default |
| **Async Ops** | Redux Saga | Redux Thunk + TanStack Query | Use thunks for Redux state updates, TanStack Query for server state with caching |
| **Container** | `connect()` HOC | React-Redux hooks | Use `useSelector` and `useDispatch` |
| **API Routes** | Next.js API routes | Your API | Update endpoint URLs |
| **Debouncing** | Saga `delay()` | `setTimeout` or `lodash.debounce` | Use standard JS debouncing |

---

## Migration Checklist

- [ ] Install dependencies
- [ ] Copy types (`form-descriptor.ts`)
- [ ] Copy utilities (`src/utils/`)
- [ ] Copy hooks (`use-form-descriptor.ts`)
- [ ] Copy components (`src/components/`)
- [ ] Copy and adapt Redux dux (`form-dux.ts`)
- [ ] Create Redux thunks (`form-thunks.ts`)
- [ ] Update reducer with thunk handlers
- [ ] Configure Redux store with Thunk middleware
- [ ] Adapt form container to use hooks
- [ ] Setup TanStack Query (optional)
- [ ] Create API endpoints
- [ ] Update endpoint URLs
- [ ] Test form initialization
- [ ] Test discriminant field changes
- [ ] Test data source loading
- [ ] Test form submission

---

## Additional Notes

### Handlebars Helpers

The form engine uses custom Handlebars helpers for template evaluation. Make sure to register these helpers:

```typescript
import { registerHandlebarsHelpers } from '@/utils/handlebars-helpers';

// Register helpers before using templates
registerHandlebarsHelpers();
```

### Form Value Preservation

The form engine preserves form values during re-hydration by:
1. Syncing all form values to Redux on every change
2. Restoring values from Redux when form remounts (due to validation rule changes)

This is handled automatically by `useFormDescriptor` hook - no changes needed.

### TanStack Query Caching Strategy

The form engine uses TanStack Query for server state with the following caching configuration:

**Global Descriptor**:
- **Stale Time**: 5 minutes (descriptors rarely change)
- **Cache Time**: 30 minutes
- **Query Key**: `['form', 'global-descriptor', endpoint]`
- **Automatic Redux Sync**: Yes (via `useEffect` in `useGlobalDescriptor` hook)

**Data Sources**:
- **Stale Time**: 2 minutes (data may change more frequently)
- **Cache Time**: 10 minutes
- **Query Key**: `['form', 'data-source', fieldPath, evaluatedUrl]`
- **Dynamic Keys**: Query key includes evaluated URL to handle template-based URLs
- **Automatic Redux Sync**: Yes (via `useEffect` in `useDataSource` hook)

**Benefits**:
- Automatic request deduplication (multiple components requesting same data)
- Background refetching when data becomes stale
- Intelligent cache invalidation based on query keys
- Reduced API calls through intelligent caching
- Redux state remains synchronized for compatibility

**Rehydration**:
- Uses `useDebouncedRehydration` hook with TanStack Query mutation
- 500ms debounce to prevent excessive API calls
- Automatic Redux state sync on success/error
- Mutation-based (no caching, as it's triggered by user actions)

### Validation Rule Updates

When validation rules change (via re-hydration), the form remounts with a new Zod resolver. This is handled by the `formKey` in `FormContainer` - no changes needed.

---

## Questions or Issues?

If you encounter issues during integration:

1. **Redux state not updating**: Check that thunk actions are properly handled in reducer
2. **Form not remounting**: Verify `formKey` calculation includes validation rule changes
3. **Data sources not loading**: Check that `fetchDataSourceThunk` has access to `mergedDescriptor` and `formData` from Redux state
4. **Re-hydration not triggering**: Verify discriminant field detection and context change detection logic

---

## Example Usage

```typescript
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { store } from './store/store';
import FormContainer from './components/form-container';

const queryClient = new QueryClient();

function App() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <FormContainer />
      </QueryClientProvider>
    </Provider>
  );
}
```

---

**Last Updated**: 2024
**Version**: 1.0
