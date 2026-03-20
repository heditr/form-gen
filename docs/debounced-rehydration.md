# Debounced Rehydration Implementation

## Overview

The `useDebouncedRehydration` hook provides debounced rehydration of form validation rules when discriminant field values change. It prevents excessive API calls by debouncing context changes and implementing deduplication to ensure only one API call is made per unique context.

## Problem Statement

When a user changes a discriminant field value:
1. The form needs to fetch new validation rules based on the updated context
2. Rapid changes can trigger multiple calls
3. Without debouncing, each change would trigger an immediate API call
4. Without deduplication, identical contexts could trigger duplicate calls

## Solution Architecture

### Key Components

1. **TanStack Query Mutation**: Handles the API call and state management
2. **Native setTimeout debouncing**: Delays API calls by 500ms; each new call cancels the previous pending timeout
3. **Deduplication**: Prevents duplicate calls for the same context via `lastSentContextRef`
4. **Ref-based State**: Ensures latest values are always used without causing re-renders
5. **Mounted Guard**: Prevents state updates after component unmount

## Implementation Details

### Hook Structure

```typescript
export function useDebouncedRehydration() {
  // 1. Mutation for API calls
  const mutation = useMutation<RulesObject, Error, CaseContext>({...});
  
  // 2. Refs for debounce and deduplication
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestContextRef = useRef<CaseContext | null>(null);
  const lastSentContextRef = useRef<string | null>(null);
  const mutateRef = useRef(mutation.mutate);
  const isMountedRef = useRef(true);
  
  // 3. Public API
  return { mutate: debouncedMutate, isPending, isError, isSuccess, error, data, reset };
}
```

### Debouncing Strategy

#### useCallback with setTimeout

The `debouncedMutate` function is created once with `useCallback(fn, [])` (empty deps array). Debouncing is implemented directly with `setTimeout`/`clearTimeout` — no external debounce library is used:

```typescript
const debouncedMutate = useCallback(
  (caseContext: CaseContext) => {
    const contextString = JSON.stringify(caseContext);
    
    // Skip if this is the same context we already sent
    if (contextString === lastSentContextRef.current) {
      return;
    }

    // Store latest context in ref
    latestContextRef.current = caseContext;

    // Cancel the pending timeout - this is the core debounce mechanism
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Schedule a new timeout
    const timeoutId = setTimeout(() => {
      // Verify this timeout wasn't superseded
      if (timeoutRef.current !== timeoutId) return;
      // Verify component is still mounted
      if (!isMountedRef.current) return;

      timeoutRef.current = null;

      if (latestContextRef.current !== null) {
        const currentContextString = JSON.stringify(latestContextRef.current);
        if (currentContextString !== lastSentContextRef.current) {
          lastSentContextRef.current = currentContextString;
          mutateRef.current(latestContextRef.current);
        }
      }
    }, 500);

    timeoutRef.current = timeoutId;
  },
  [] // No dependencies — function is stable across renders
);
```

**Why empty deps?**
- The function never becomes stale because it only reads from refs
- Avoids recreating the callback on every render
- All mutable values are accessed via refs at execution time

#### Ref-Based Latest Values

The debounced callback uses refs to access the latest values without closing over them:

```typescript
// Store latest context before scheduling timeout
latestContextRef.current = caseContext;

// Read latest context when timeout fires (may differ from when it was scheduled)
mutateRef.current(latestContextRef.current);
```

**Why use refs?**
- Refs don't cause re-renders when updated
- The timeout callback always reads the most recent value
- Avoids stale closure problems common with `useCallback` dependencies

### Deduplication Strategy

#### Early Exit Check

Before scheduling a timeout, the function checks whether the context was already sent:

```typescript
const contextString = JSON.stringify(caseContext);

if (contextString === lastSentContextRef.current) {
  return; // Same context as last API call — skip entirely
}
```

#### Timeout Identity Check

Inside the timeout callback, a secondary check guards against superseded timeouts:

```typescript
const timeoutId = setTimeout(() => {
  // If timeoutRef.current !== timeoutId, a newer call cancelled this one
  if (timeoutRef.current !== timeoutId) return;
  // ...
}, 500);
timeoutRef.current = timeoutId;
```

**Flow:**
1. New context arrives → serialize to string
2. If matches `lastSentContextRef` → skip (already sent this context)
3. Update `latestContextRef` with newest context
4. Cancel any pending timeout via `clearTimeout`
5. Schedule new 500ms timeout, store its ID in `timeoutRef`
6. When timeout fires: verify ID matches `timeoutRef.current` (not superseded)
7. Verify component still mounted via `isMountedRef`
8. If context differs from `lastSentContextRef` → call mutation and update `lastSentContextRef`

### Mounted Guard

A `useEffect` tracks mount state and cleans up on unmount:

```typescript
useEffect(() => {
  isMountedRef.current = true;
  return () => {
    isMountedRef.current = false;
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };
}, []); // Empty deps — runs once on mount/unmount
```

**Why needed?**
- Prevents triggering a mutation after the component has unmounted
- Cleans up pending timeouts on unmount to avoid memory leaks

### Mutation Integration

The mutation handles the actual API call and Redux synchronization:

```typescript
const mutation = useMutation<RulesObject, Error, CaseContext>({
  mutationFn: async (caseContext: CaseContext) => {
    dispatch(triggerRehydration()); // Redux: isRehydrating → true

    const response = await apiCall('/api/rules/context', {
      method: 'POST',
      body: JSON.stringify(caseContext),
    });

    const rulesObject: RulesObject = await response.json();
    return rulesObject;
  },
  onSuccess: (rulesObject) => {
    dispatch(applyRulesUpdate({ rulesObject })); // Merges rules into mergedDescriptor
  },
  onError: () => {
    dispatch(applyRulesUpdate({ rulesObject: null })); // Clears isRehydrating
  },
});
```

**What `applyRulesUpdate` does in Redux:**
- Calls `mergeDescriptorWithRules(globalDescriptor, rulesObject)`
- Updates `mergedDescriptor` with merged validation rules and status templates
- Sets `isRehydrating: false`

### RulesObject Shape

The `RulesObject` returned from `/api/rules/context` has this structure:

```typescript
interface RulesObject {
  blocks?: Array<{
    id: string;
    status?: StatusTemplates; // { hidden?, disabled?, readonly? }
  }>;
  fields?: Array<{
    id: string;
    validation?: ValidationRule[];
    status?: StatusTemplates;
  }>;
}
```

Rules are merged additively into the `GlobalFormDescriptor`:
- **Field validation**: new rules are **appended** to existing rules
- **Status templates**: rules-object values **override** descriptor values per key (spread merge)
- **Handlebars validation templates**: if a field's `validation` is already a Handlebars string, it is **preserved as-is** and rules-object updates are ignored for that field

## Usage in Form Container

```typescript
export default function FormContainer() {
  const { mutate: debouncedRehydrate, isPending } = useDebouncedRehydration();

  const rehydrate = useCallback(
    (caseContext: CaseContext) => {
      debouncedRehydrate(caseContext);
    },
    [debouncedRehydrate]
  );

  const handleDiscriminantChange = useCallback((newFormData) => {
    const updatedContext = updateCaseContext(caseContext, newFormData, discriminantFields);
    if (hasContextChanged(caseContext, updatedContext)) {
      rehydrate(updatedContext);
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
[Dedup Check] → Same as lastSentContext? → Skip
         ↓ No
Update latestContextRef
         ↓
Cancel previous setTimeout (if any)
         ↓
Schedule new setTimeout (500ms)
         ↓
[Wait 500ms — reset if another call arrives]
         ↓
Timeout fires
         ↓
[Identity Check] → Timeout superseded? → Skip
         ↓ No
[Mounted Check] → Unmounted? → Skip
         ↓ No
[Dedup Check] → Same as lastSentContext? → Skip
         ↓ No
Update lastSentContextRef
         ↓
mutation.mutate(context) called
         ↓
dispatch(triggerRehydration()) → isRehydrating: true
         ↓
POST /api/rules/context
         ↓
RulesObject returned
         ↓
dispatch(applyRulesUpdate({ rulesObject }))
         ↓
mergeDescriptorWithRules(globalDescriptor, rulesObject)
         ↓
mergedDescriptor updated in Redux state → isRehydrating: false
```

## Return Value

```typescript
{
  mutate: (caseContext: CaseContext) => void,  // Debounced trigger function
  isPending: boolean,                           // True while mutation is in-flight
  isError: boolean,
  isSuccess: boolean,
  error: Error | null,
  data: RulesObject | undefined,               // Last successful RulesObject
  reset: () => void,                           // Reset mutation state
}
```

## Benefits

1. **Performance**: Reduces API calls by batching rapid changes
2. **Reliability**: Prevents duplicate calls for the same context
3. **User Experience**: Smooth debouncing prevents UI flicker
4. **State Management**: Automatic Redux synchronization
5. **Safety**: Mounted guard prevents post-unmount side effects
6. **Simplicity**: No external debounce library — uses native setTimeout

## Edge Cases Handled

1. **Rapid successive changes**: Only the last call fires after 500ms idle
2. **Same context multiple times**: `lastSentContextRef` deduplication prevents duplicate API calls
3. **Component unmount during pending timeout**: `isMountedRef` guard cancels execution; `clearTimeout` in cleanup prevents the callback from firing
4. **Context updated between scheduling and firing**: `latestContextRef` always holds the most recent context; timeout identity check discards superseded timeouts
5. **Stale closures**: All mutable values are accessed via refs, never captured in the closure

## Configuration

- **Debounce Delay**: 500ms (hardcoded in hook)
- **API Endpoint**: `/api/rules/context`
- **Redux Actions**: `triggerRehydration`, `applyRulesUpdate` (from `@/store/form-dux`)

## Testing Considerations

When testing this hook:
1. Mock `useMutation` from TanStack Query
2. Mock `useDispatch` from Redux
3. Use `vi.useFakeTimers()` to control `setTimeout` timing
4. Advance timers with `vi.advanceTimersByTime(500)` to trigger the debounced call
5. Verify deduplication by calling with the same context twice and checking only one API call is made
6. Verify debouncing by calling rapidly and confirming only one API call fires after 500ms
7. Test mounted guard by unmounting before the timeout fires and confirming no mutation is triggered
