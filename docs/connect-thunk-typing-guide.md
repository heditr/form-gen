# Typing `connect()` with Redux Thunks - Complete Guide

## The Problem

When using `connect()` from `react-redux` with Redux Toolkit thunks, you'll encounter type mismatches because:

1. **Thunks return `AsyncThunkAction`** - Not plain action objects
2. **Dispatch needs proper typing** - Must be typed as `AppDispatch` to handle thunks
3. **mapDispatchToProps needs function form** - Object shorthand doesn't work well with thunks

## The Solution

### 1. Export AppDispatch from Store

**File**: `src/store/store.ts`

```typescript
import { configureStore } from '@reduxjs/toolkit';
import { reducer } from './form-dux';

export const store = configureStore({
  reducer: {
    form: reducer,
  },
});

// CRITICAL: Export these types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### 2. Use Function Form of mapDispatchToProps

**Key Point**: Use a **function** that receives `dispatch: AppDispatch`, not an object.

```typescript
import type { AppDispatch } from '@/store/store';
import { rehydrateRulesThunk, fetchDataSourceThunk } from '@/store/form-thunks';

// ✅ CORRECT: Function form with typed dispatch
const mapDispatchToProps = (dispatch: AppDispatch): DispatchProps => ({
  syncFormDataToContext: (formData: Partial<FormData>) => {
    dispatch(syncFormDataToContext({ formData }));
  },
  rehydrateRules: (caseContext: CaseContext) => {
    return dispatch(rehydrateRulesThunk(caseContext));
  },
  fetchDataSource: (fieldPath: string, url: string, auth?: AuthConfig) => {
    return dispatch(fetchDataSourceThunk({ fieldPath, url, auth }));
  },
});

// ❌ WRONG: Object shorthand (causes type errors)
const mapDispatchToProps = {
  syncFormDataToContext,
  rehydrateRules: rehydrateRulesThunk, // Type mismatch!
  fetchDataSource: fetchDataSourceThunk, // Type mismatch!
};
```

### 3. Type DispatchProps with ReturnType

**Key Point**: Use `ReturnType<typeof thunk>` to get the correct return type.

```typescript
interface DispatchProps {
  syncFormDataToContext: (formData: Partial<FormData>) => void;
  // ✅ CORRECT: Use ReturnType to get thunk return type
  rehydrateRules: (caseContext: CaseContext) => ReturnType<typeof rehydrateRulesThunk>;
  fetchDataSource: (fieldPath: string, url: string, auth?: AuthConfig) => ReturnType<typeof fetchDataSourceThunk>;
}
```

### 4. Use ConnectedProps Helper (Optional but Recommended)

```typescript
import { connect, ConnectedProps } from 'react-redux';

const connector = connect(mapStateToProps, mapDispatchToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;

// Component automatically gets all props from Redux
const FormContainer = connector(FormContainerComponent);
```

## Complete Example

See the following files for complete, working examples:

1. **`form-thunks-example.ts`** - How to create properly typed thunks
2. **`form-container-thunk-example.tsx`** - How to use connect() with thunks
3. **`store-thunk-example.ts`** - How to configure the store

## Common Type Errors and Fixes

### Error 1: "Type 'AsyncThunkAction<...>' is not assignable to type 'Action'"

**Cause**: Using object shorthand in `mapDispatchToProps`

**Fix**: Use function form:
```typescript
const mapDispatchToProps = (dispatch: AppDispatch) => ({
  rehydrateRules: (caseContext: CaseContext) => dispatch(rehydrateRulesThunk(caseContext)),
});
```

### Error 2: "Property 'dispatch' does not exist on type 'Dispatch<AnyAction>'"

**Cause**: Dispatch not typed as `AppDispatch`

**Fix**: Import and use `AppDispatch`:
```typescript
import type { AppDispatch } from '@/store/store';

const mapDispatchToProps = (dispatch: AppDispatch) => ({ ... });
```

### Error 3: "Argument of type 'CaseContext' is not assignable to parameter of type 'AsyncThunkPayloadCreator<...>'"

**Cause**: Thunk not properly created with `createAsyncThunk`

**Fix**: Ensure thunk is created correctly:
```typescript
export const rehydrateRulesThunk = createAsyncThunk<
  RulesObject, // Return type
  CaseContext, // Argument type
  { rejectValue: string }
>(
  'form/rehydrateRules',
  async (caseContext: CaseContext, { dispatch, rejectWithValue }) => {
    // ... implementation
  }
);
```

## Alternative: Use Hooks Instead

If you're starting a new project or refactoring, consider using React-Redux hooks instead of `connect()`:

```typescript
import { useSelector, useDispatch } from 'react-redux';
import type { AppDispatch, RootState } from '@/store/store';

function FormContainer() {
  const dispatch = useDispatch<AppDispatch>();
  const formState = useSelector((state: RootState) => getFormState(state));
  
  const handleRehydrate = useCallback((caseContext: CaseContext) => {
    dispatch(rehydrateRulesThunk(caseContext));
  }, [dispatch]);
  
  // ... rest of component
}
```

This approach is simpler and has better TypeScript support.

## Key Takeaways

1. ✅ **Always export `AppDispatch`** from your store
2. ✅ **Use function form** of `mapDispatchToProps` with typed dispatch
3. ✅ **Use `ReturnType<typeof thunk>`** for thunk return types in `DispatchProps`
4. ✅ **Create thunks with `createAsyncThunk`** from Redux Toolkit
5. ✅ **Consider using hooks** (`useSelector`, `useDispatch`) for new code

## Files Reference

- **Form Container**: `docs/form-container-thunk-example.tsx`
- **Thunks**: `docs/form-thunks-example.ts`
- **Store Config**: `docs/store-thunk-example.ts`
