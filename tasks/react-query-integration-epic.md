# React Query Integration Epic

**Status**: 📋 PLANNED  
**Goal**: Replace Redux-saga with React Query for all API calls, providing automatic caching, request deduplication, and background refetching while maintaining Redux state synchronization.

## Overview

Redux-saga adds complexity and boilerplate for API calls without providing caching or request deduplication. React Query solves these problems with automatic caching, request deduplication, background refetching, and simpler code. This integration replaces all saga-based API calls with React Query hooks while maintaining Redux state updates for compatibility with existing architecture.

---

## React Query Setup

Install and configure React Query with QueryClient and provider.

**Requirements**:
- Given project needs, should install @tanstack/react-query
- Given app setup, should create QueryClient with appropriate default options
- Given caching needs, should configure cache time and stale time for different query types
- Given app integration, should wrap app with QueryClientProvider

---

## Global Descriptor Query Hook

Create React Query hook to replace global descriptor saga.

**Requirements**:
- Given form initialization, should fetch GET /api/form/global-descriptor using useQuery
- Given successful response, should update Redux state via onSuccess callback
- Given caching needs, should cache descriptor with long stale time (rarely changes)
- Given error handling, should handle errors appropriately
- Given loading state, should provide isLoading and isError states

---

## Rules Re-hydration Mutation Hook

Create React Query mutation hook to replace re-hydration saga with debouncing.

**Requirements**:
- Given discriminant field changes, should use useMutation for POST /api/rules/context
- Given debouncing needs, should implement 500ms debounce before mutation execution
- Given successful response, should update Redux state via onSuccess callback
- Given caching needs, should cache rules responses keyed by CaseContext
- Given loading state, should update Redux isRehydrating state
- Given error handling, should handle errors and update Redux state

---

## Data Source Query Hook

Create React Query hook to replace data source loading saga.

**Requirements**:
- Given field visibility, should fetch data source using useQuery with dynamic URL
- Given authentication needs, should include auth headers in query function
- Given caching needs, should cache responses to prevent duplicate requests
- Given request deduplication, should leverage React Query's automatic deduplication
- Given successful response, should update Redux dataSourceCache via onSuccess
- Given error handling, should handle errors gracefully

---

## Form Submission Mutation Hook

Create React Query mutation hook to replace form submission saga.

**Requirements**:
- Given form submission, should use useMutation for form submission to configured endpoint
- Given payload transformation, should evaluate payloadTemplate before submission
- Given authentication needs, should include auth headers in mutation
- Given successful response, should handle success appropriately
- Given backend validation errors, should map errors to react-hook-form via setError()
- Given error handling, should handle network and validation errors

---

## Redux State Sync Utilities

Create utilities to sync React Query results to Redux state.

**Requirements**:
- Given query success, should provide onSuccess callback to update Redux state
- Given mutation success, should provide onSuccess callback to update Redux state
- Given state updates, should dispatch appropriate Redux actions
- Given error handling, should dispatch error actions to Redux

---

## Debounced Re-hydration Hook

Create custom hook that combines debouncing with React Query mutation.

**Requirements**:
- Given discriminant field changes, should debounce CaseContext changes by 500ms
- Given debounced context, should trigger React Query mutation
- Given multiple rapid changes, should cancel previous debounced calls
- Given mutation execution, should use rules re-hydration mutation hook

---

## Update Form Container Component

Update form container to use React Query hooks instead of saga actions.

**Requirements**:
- Given component initialization, should use global descriptor query hook
- Given discriminant field changes, should use debounced re-hydration hook
- Given data source needs, should use data source query hooks
- Given form submission, should use form submission mutation hook
- Given Redux integration, should maintain Redux state updates via onSuccess callbacks

---

## Remove Redux Saga Dependencies

Remove Redux-saga from form operations and update store configuration.

**Requirements**:
- Given React Query integration, should remove form sagas from store configuration
- Given saga removal, should remove redux-saga middleware if no longer needed
- Given code cleanup, should remove unused saga files and imports
- Given documentation, should update technical requirements to reflect React Query usage

---

## Update Technical Requirements

Update technical requirements document to reflect React Query architecture.

**Requirements**:
- Given architecture change, should update state management section to document React Query
- Given saga removal, should remove Redux-saga requirements
- Given caching strategy, should document React Query caching configuration
- Given integration pattern, should document Redux state sync pattern
