# Case Context Usage Guide

## Overview

The `initializeCaseContext` function converts `CasePrefill` data into `CaseContext` for use in rules re-hydration. This guide explains when and how to use it.

## When to Use `initializeCaseContext`

Use `initializeCaseContext` when:

1. **Case Creation**: When a new case is created and you have `CasePrefill` data
2. **Case Data Fetching**: When you fetch existing case data from the server
3. **Case Data Refresh**: When you need to update the case context with new prefill data

## Available Methods

### 1. Direct Action Dispatch (Simple)

Use the Redux action `initializeCaseContextFromPrefill` to update the case context:

```typescript
import { useDispatch } from 'react-redux';
import { initializeCaseContextFromPrefill } from '@/store/form-dux';
import type { CasePrefill } from '@/types/form-descriptor';
import type { AppDispatch } from '@/store/store';

function MyComponent() {
  const dispatch = useDispatch<AppDispatch>();

  const handleCaseDataReceived = (casePrefill: CasePrefill) => {
    // Initialize case context from prefill data
    dispatch(initializeCaseContextFromPrefill({ casePrefill }));
    
    // Optionally trigger rehydration to get updated rules
    // (The context will be used automatically when discriminant fields change)
  };

  return <div>...</div>;
}
```

### 2. Using the Fetch Thunk (Recommended)

Use `fetchCaseDataThunk` which automatically initializes the case context:

```typescript
import { useDispatch } from 'react-redux';
import { fetchCaseDataThunk, rehydrateRulesThunk } from '@/store/form-thunks';
import { initializeCaseContext } from '@/utils/context-extractor';
import type { AppDispatch } from '@/store/store';
import { useEffect } from 'react';

function CaseDetailPage({ caseId }: { caseId: string }) {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    // Fetch case data - this automatically initializes case context
    dispatch(fetchCaseDataThunk(caseId))
      .then((result) => {
        if (fetchCaseDataThunk.fulfilled.match(result)) {
          const casePrefill = result.payload;
          
          // Case context is now initialized in Redux
          // Optionally trigger rehydration to get updated rules based on the context
          const caseContext = initializeCaseContext(casePrefill);
          dispatch(rehydrateRulesThunk(caseContext));
        }
      });
  }, [caseId, dispatch]);

  return <div>...</div>;
}
```

### 3. Manual Initialization (Advanced)

If you need more control, you can use the utility function directly:

```typescript
import { useDispatch } from 'react-redux';
import { initializeCaseContext } from '@/utils/context-extractor';
import { initializeCaseContextFromPrefill } from '@/store/form-dux';
import type { CasePrefill } from '@/types/form-descriptor';
import type { AppDispatch } from '@/store/store';

function MyComponent() {
  const dispatch = useDispatch<AppDispatch>();

  const handleCaseData = async () => {
    // Fetch case data from your API
    const response = await fetch('/api/cases/123');
    const casePrefill: CasePrefill = await response.json();

    // Convert to context
    const caseContext = initializeCaseContext(casePrefill);

    // Update Redux state
    dispatch(initializeCaseContextFromPrefill({ casePrefill }));

    // Optionally trigger rehydration
    dispatch(rehydrateRulesThunk(caseContext));
  };

  return <div>...</div>;
}
```

## How It Works

1. **`initializeCaseContext(casePrefill)`**: Converts `CasePrefill` to `CaseContext`
   - Extracts: `incorporationCountry`, `onboardingCountries`, `processType`, `needSignature`
   - Returns a `CaseContext` object

2. **`initializeCaseContextFromPrefill({ casePrefill })`**: Redux action that:
   - Calls `initializeCaseContext` internally
   - Merges the new context with existing context in Redux state
   - Preserves any context values already set from form data

3. **Context Merging**: The action merges prefill values with existing context:
   - Prefill values take precedence for fields they define
   - Existing context values (from form data) are preserved for other fields

## Example: Updating Context When Case Data Changes

```typescript
import { useDispatch, useSelector } from 'react-redux';
import { fetchCaseDataThunk } from '@/store/form-thunks';
import { getFormState } from '@/store/form-dux';
import type { AppDispatch, RootState } from '@/store/store';
import { useEffect } from 'react';

function CaseForm({ caseId }: { caseId: string }) {
  const dispatch = useDispatch<AppDispatch>();
  const { caseContext } = useSelector((state: RootState) => getFormState(state));

  useEffect(() => {
    // Fetch case data when component mounts or caseId changes
    const loadCase = async () => {
      const result = await dispatch(fetchCaseDataThunk(caseId));
      
      if (fetchCaseDataThunk.fulfilled.match(result)) {
        // Case context is now updated in Redux
        console.log('Case context updated:', caseContext);
        
        // The form will automatically use the updated context
        // for discriminant field changes and re-hydration
      }
    };

    loadCase();
  }, [caseId, dispatch]);

  return <FormContainer />;
}
```

## Important Notes

1. **Context Preservation**: When you initialize context from prefill, it merges with existing context. This means:
   - If a user has already filled in discriminant fields, those values are preserved
   - Prefill values only override if they are explicitly provided

2. **Re-hydration**: After updating the case context, you may want to trigger re-hydration to get updated rules:
   ```typescript
   dispatch(rehydrateRulesThunk(caseContext));
   ```

3. **Form Data Sync**: The case context is separate from form data. Form data changes will still update the context via `updateCaseContext` when discriminant fields change.

## Summary

- **Use `initializeCaseContextFromPrefill`** when you have `CasePrefill` data and want to update Redux state
- **Use `fetchCaseDataThunk`** when fetching case data from the server (it handles initialization automatically)
- **Context merges** with existing values, so prefill won't overwrite user-entered discriminant field values
- **Trigger re-hydration** after updating context if you need updated rules immediately
