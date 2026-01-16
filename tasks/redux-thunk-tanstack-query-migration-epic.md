# Redux Saga to Redux Thunk + TanStack Query Migration Epic

**Status**: 📋 PLANNED  
**Goal**: Migrate from redux-saga to redux-thunk with TanStack Query for API calls, simplifying async operations while maintaining Redux state synchronization and adding automatic caching, request deduplication, and background refetching capabilities.

## Overview

Redux-saga adds complexity and boilerplate for API calls without providing caching or request deduplication. Migrating to redux-thunk with TanStack Query provides a hybrid approach: TanStack Query handles server state with automatic caching and deduplication, while Redux Thunk handles Redux state updates. This simplifies the codebase, reduces boilerplate, and improves performance through intelligent caching.

---

## Install Dependencies

Install Redux Toolkit and TanStack Query packages required for migration.

**Requirements**:
- Given migration needs, should install @reduxjs/toolkit for Redux Thunk support
- Given API call needs, should install @tanstack/react-query for server state management
- Given debouncing needs, should install lodash.debounce for debounced operations

---

## Create Redux Thunks

Create Redux thunks to replace saga-based async operations that update Redux state.

**Requirements**:
- Given rehydration needs, should create rehydrateRulesThunk with debouncing logic
- Given state updates, should dispatch Redux actions on success/error
- Given error handling, should handle network errors and update Redux state appropriately
- Given debouncing, should implement 500ms debounce before API call

---

## Create TanStack Query Hooks

Create React Query hooks for server state operations that benefit from caching and deduplication.

**Requirements**:
- Given global descriptor needs, should create useGlobalDescriptor hook with useQuery
- Given data source needs, should create useDataSource hook with dynamic query keys
- Given form submission needs, should create useSubmitForm hook with useMutation
- Given caching needs, should configure appropriate stale times and cache times
- Given Redux sync needs, should provide onSuccess callbacks to update Redux state

---

## Update Redux Store Configuration

Replace redux-saga middleware with Redux Toolkit configuration.

**Requirements**:
- Given thunk migration, should remove redux-saga middleware from store
- Given Redux Toolkit, should use configureStore from @reduxjs/toolkit
- Given middleware removal, should remove sagaMiddleware.run() call
- Given type safety, should export RootState and AppDispatch types

---

## Update Redux Reducer

Add thunk action handlers to reducer for async thunk operations.

**Requirements**:
- Given thunk actions, should handle fulfilled/pending/rejected action types
- Given rehydration thunk, should update mergedDescriptor and isRehydrating state
- Given error states, should handle rejected actions appropriately

---

## Update Form Container Component

Convert form container from connect() HOC to React-Redux hooks and integrate TanStack Query.

**Requirements**:
- Given component refactor, should replace connect() with useSelector and useDispatch hooks
- Given global descriptor, should use useGlobalDescriptor hook instead of saga action
- Given rehydration, should use debounced rehydration hook with TanStack Query mutation
- Given data sources, should use useDataSource hooks for dynamic field data
- Given form submission, should use useSubmitForm mutation hook
- Given Redux sync, should dispatch Redux actions in query/mutation onSuccess callbacks

---

## Create Debounced Rehydration Hook

Create custom hook that combines debouncing with TanStack Query mutation for rules rehydration.

**Requirements**:
- Given discriminant changes, should debounce CaseContext changes by 500ms
- Given debounced context, should trigger TanStack Query mutation
- Given rapid changes, should cancel previous debounced calls
- Given mutation success, should update Redux state via onSuccess callback

---

## Remove Redux Saga Dependencies

Remove redux-saga from codebase and update all imports.

**Requirements**:
- Given migration completion, should remove form-sagas.ts file
- Given store update, should remove redux-saga imports from store.ts
- Given component update, should remove saga action imports from form-container.tsx
- Given package cleanup, should remove redux-saga from package.json dependencies

---

## Update Tests

Update existing tests to work with Redux Thunk and TanStack Query instead of sagas.

**Requirements**:
- Given test updates, should update store tests to use Redux Toolkit store
- Given saga tests, should remove or convert saga tests to thunk tests
- Given component tests, should mock TanStack Query hooks appropriately
- Given integration tests, should verify Redux state updates from query callbacks

---

## Update Documentation

Update technical documentation to reflect new architecture.

**Requirements**:
- Given architecture change, should update integration plan document
- Given saga removal, should remove Redux-saga references from documentation
- Given hybrid approach, should document TanStack Query + Redux Thunk pattern
- Given caching strategy, should document React Query caching configuration
