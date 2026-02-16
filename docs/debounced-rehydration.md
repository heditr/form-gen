# Debounced Rehydration Implementation

## Overview

The `useDebouncedRehydration` hook provides debounced rehydration of form validation rules when discriminant field values change. It prevents excessive API calls by debouncing context changes and implementing deduplication to ensure only one API call is made per unique context.

## Problem Statement

When a user changes a discriminant field value:
1. The form needs to fetch new validation rules based on the updated context
2. Rapid changes or React Strict Mode can trigger multiple calls
3. Without debouncing, each change would trigger an immediate API call
4. Without deduplication, identical contexts could trigger duplicate calls

## Solution Architecture

### Key Components

1. **TanStack Query Mutation**: Handles the API call and state management
2. **Debouncing**: Delays API calls by 500ms to batch rapid changes
3. **Deduplication**: Prevents duplicate calls for the same context
4. **Ref-based State**: Ensures latest values are always used without causing re-renders

## Implementation Details

### Hook Structure

```typescript
export function useDebouncedRehydration() {
  // 1. Mutation for API calls
  const mutation = useMutation<RulesObject, Error, CaseContext>({...});
  
  // 2. Refs for latest values
  const latestContextRef = useRef<CaseContext | null>(null);
  const lastSentContextRef = useRef<string | null>(null);
  const pendingContextRef = useRef<string | null>(null);
  const mutateRef = useRef(mutation.mutate);
  
  // 3. Debounced function (created once)
  const debouncedMutateRef = useRef<ReturnType<typeof debounce> | null>(null);
  
  // 4. Public API
  return { mutate: debouncedMutate, ...mutationState };
}
```

### Debouncing Strategy

#### Single Debounced Function

The debounced function is created **once** in a `useEffect` with empty dependencies:

```typescript
useEffect(() => {
  debouncedMutateRef.current = debounce(
    () => {
      if (latestContextRef.current !== null) {
        const contextString = JSON.stringify(latestContextRef.current);
        
        // Deduplication check
        if (contextString !== lastSentContextRef.current) {
          lastSentContextRef.current = contextString;
          pendingContextRef.current = null;
          mutateRef.current(latestContextRef.current);
        }
      }
    },
    500 // 500ms delay
  );
}, []); // Empty deps - create once
```

**Why create once?**
- Prevents multiple debounced functions from being created
- Ensures consistent debounce behavior
- Avoids React ref access during render (which React disallows)

#### Ref-Based Latest Values

The debounced function uses refs to access the latest values:

```typescript
// Store latest context
latestContextRef.current = caseContext;

// Debounced function reads from ref
mutateRef.current(latestContextRef.current);
```

**Why use refs?**
- Refs don't cause re-renders when updated
- The debounced function closure always reads the latest value
- Avoids stale closure problems

### Deduplication Strategy

#### Two-Level Deduplication

1. **Pending Context Tracking**: Prevents scheduling duplicate debounced calls
2. **Sent Context Tracking**: Prevents sending duplicate API calls

#### Pending Context Check

```typescript
const debouncedMutate = useCallback((caseContext: CaseContext) => {
  const contextString = JSON.stringify(caseContext);
  
  // Skip if already sent or pending
  if (contextString === lastSentContextRef.current || 
      contextString === pendingContextRef.current) {
    return; // Early exit - prevent duplicate scheduling
  }
  
  // Mark as pending
  pendingContextRef.current = contextString;
  latestContextRef.current = caseContext;
  
  // Cancel previous and schedule new
  if (debouncedMutateRef.current) {
    debouncedMutateRef.current.cancel();
  }
  debouncedMutateRef.current();
}, []);
```

**Flow:**
1. Check if context was already sent → skip
2. Check if context is already pending → skip
3. Mark context as pending
4. Cancel any existing debounced call
5. Schedule new debounced call

#### Sent Context Check

Inside the debounced function:

```typescript
debounce(() => {
  const contextString = JSON.stringify(latestContextRef.current);
  
  // Only send if context changed
  if (contextString !== lastSentContextRef.current) {
    lastSentContextRef.current = contextString;
    pendingContextRef.current = null;
    mutateRef.current(latestContextRef.current);
  }
}, 500);
```

**Flow:**
1. Get latest context from ref
2. Compare with last sent context
3. If different → send API call and update tracking
4. If same → clear pending flag (no-op)

### Mutation Integration

The mutation handles the actual API call:

```typescript
const mutation = useMutation<RulesObject, Error, CaseContext>({
  mutationFn: async (caseContext: CaseContext) => {
    dispatch(triggerRehydration()); // Redux sync
    
    const response = await apiCall('/api/rules/context', {
      method: 'POST',
      body: JSON.stringify(caseContext),
    });
    
    return await response.json();
  },
  onSuccess: (rulesObject) => {
    dispatch(applyRulesUpdate({ rulesObject })); // Redux sync
  },
  onError: () => {
    dispatch(applyRulesUpdate({ rulesObject: null }));
  },
});
```

**Benefits:**
- Automatic Redux state synchronization
- Error handling built-in
- Loading states available via `isPending`

## Usage in Form Container

```typescript
export default function FormContainer() {
  // Get hook
  const { mutate: debouncedRehydrate, isPending } = useDebouncedRehydration();
  
  // Create rehydrate callback
  const rehydrate = useCallback(
    (caseContext: CaseContext) => {
      debouncedRehydrate(caseContext);
    },
    [debouncedRehydrate]
  );
  
  // Use in handleDiscriminantChange
  const handleDiscriminantChange = useCallback((newFormData) => {
    const updatedContext = updateCaseContext(caseContext, newFormData, ...);
    if (hasContextChanged(caseContext, updatedContext)) {
      rehydrate(updatedContext); // Triggers debounced API call
    }
  }, [caseContext, rehydrate]);
}
```

## Flow Diagram

```
User changes discriminant field
         ↓
handleDiscriminantChange called
         ↓
Context updated and checked
         ↓
rehydrate(updatedContext) called
         ↓
debouncedMutate(context) called
         ↓
[Pending Check] → Already pending? → Skip
         ↓ No
Mark context as pending
         ↓
Cancel previous debounced call (if any)
         ↓
Schedule debounced function (500ms delay)
         ↓
[Wait 500ms]
         ↓
Debounced function executes
         ↓
[Sent Check] → Already sent? → Skip
         ↓ No
Clear pending flag
         ↓
Update lastSentContext
         ↓
mutation.mutate(context) called
         ↓
API call: POST /api/rules/context
         ↓
Redux state updated with new rules
```

## Benefits

1. **Performance**: Reduces API calls by batching rapid changes
2. **Reliability**: Prevents duplicate calls for same context
3. **User Experience**: Smooth debouncing prevents UI flicker
4. **State Management**: Automatic Redux synchronization
5. **Error Handling**: Built-in error states via TanStack Query

## Edge Cases Handled

1. **Rapid successive changes**: Debouncing batches them into one call
2. **Same context multiple times**: Deduplication prevents duplicate calls
3. **Component remount**: Debounced function recreated, but state persists in refs
4. **React Strict Mode**: Deduplication prevents double calls
5. **Stale closures**: Refs ensure latest values are always used

## Configuration

- **Debounce Delay**: 500ms (configurable in hook)
- **API Endpoint**: `/api/rules/context` (configurable in hook)
- **Redux Actions**: `triggerRehydration`, `applyRulesUpdate` (from form-dux)

## Testing Considerations

When testing this hook:
1. Mock `useMutation` from TanStack Query
2. Mock `useDispatch` from Redux
3. Use `vi.useFakeTimers()` to control debounce timing
4. Verify deduplication by calling with same context multiple times
5. Verify debouncing by calling rapidly and checking only one API call

## Future Improvements

Potential enhancements:
1. Configurable debounce delay
2. Retry logic for failed API calls
3. Cache invalidation strategies
4. Request cancellation on component unmount
5. Metrics/logging for debugging
