# Architecture: Redux + react-hook-form Integration

## Overview

This document explains how Redux and react-hook-form work together in the KYC Form Engine, following a hybrid state management architecture where each library manages its appropriate concerns.

## Where `useForm()` is Initialized

`useForm()` is initialized in `src/hooks/use-form-descriptor.ts` at **line 49**:

```typescript
// Initialize react-hook-form
const form = useForm<FieldValues>({
  defaultValues,
  mode: 'onChange', // Validate on change for immediate feedback
});
```

This happens inside the `useFormDescriptor` hook, which is called from the Form Container Component.

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Redux Store (Global State)              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ • globalDescriptor                                    │  │
│  │ • mergedDescriptor                                    │  │
│  │ • caseContext                                         │  │
│  │ • isRehydrating                                       │  │
│  │ • dataSourceCache                                     │  │
│  │ • formData (synced from react-hook-form)             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                        ▲                    │
                        │                    │
        mapStateToProps │                    │ dispatch actions
                        │                    │
┌───────────────────────┴────────────────────┴───────────────┐
│           Form Container Component                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. useFormDescriptor(descriptor)                     │  │
│  │    └─> useForm() initialized here                    │  │
│  │                                                       │  │
│  │ 2. handleDiscriminantChange callback                 │  │
│  │    └─> Syncs form data to Redux                      │  │
│  │    └─> Triggers re-hydration                        │  │
│  │                                                       │  │
│  │ 3. Passes form + Redux state to presentation        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                        │
                        │ props: { form, visibleBlocks, ... }
                        ▼
┌─────────────────────────────────────────────────────────────┐
│         Form Presentation Component                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Uses react-hook-form methods:                        │  │
│  │ • form.register()                                    │  │
│  │ • form.control                                       │  │
│  │ • form.handleSubmit()                                │  │
│  │ • form.formState.errors                              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Separation of Concerns

### Redux (Global State)
Manages application-wide state that needs to be shared or persisted:

- **Form descriptor structure** (`globalDescriptor`, `mergedDescriptor`)
- **Case context** for rules evaluation
- **Re-hydration status** (`isRehydrating`)
- **Data source cache** for dynamic field data
- **Synced form data** (for context extraction only, not as source of truth)

### react-hook-form (Form State)
Manages local form state for optimal performance:

- **Field values** - All current form field values
- **Validation state** - Field-level validation status
- **Field-level errors** - Validation error messages
- **Form submission state** - Submission progress and status

## Data Flow

### Initialization Flow

```typescript
// In FormContainerComponent (line 108)
const { form } = useFormDescriptor(mergedDescriptor, {
  onDiscriminantChange: handleDiscriminantChange,
});

// Inside useFormDescriptor (line 49)
const form = useForm<FieldValues>({
  defaultValues,  // Extracted from descriptor
  mode: 'onChange',
});
```

### Discriminant Field Change Flow

```
User changes discriminant field
    ↓
react-hook-form detects change (form.watch())
    ↓
useFormDescriptor calls onDiscriminantChange callback
    ↓
FormContainer.handleDiscriminantChange()
    ↓
1. syncFormDataToContext() → Redux
2. updateCaseContext() → Extract context
3. hasContextChanged() → Check if changed
4. rehydrateRulesThunk() → Trigger re-hydration thunk
    ↓ (or useDebouncedRehydration() hook)
Redux Thunk / TanStack Query: POST /api/rules/context
    ↓
Backend returns RulesObject
    ↓
applyRulesUpdate() → Merge rules into descriptor
    ↓
useFormDescriptor.updateValidationRules() → Update react-hook-form
```

## Key Code Locations

1. **`useForm()` initialization**: `src/hooks/use-form-descriptor.ts:49`
2. **Redux connection**: `src/components/form-container.tsx:156` (connect HOC)
3. **State mapping**: `src/components/form-container.tsx:132` (mapStateToProps)
4. **Action mapping**: `src/components/form-container.tsx:147` (mapDispatchToProps)
5. **Discriminant sync**: `src/components/form-container.tsx:81-105` (handleDiscriminantChange)

## Design Decisions

### Why This Architecture?

1. **react-hook-form owns form state** - Provides <100ms validation feedback, optimal performance for form interactions
2. **Redux owns global state** - Manages descriptor, context, and re-hydration orchestration
3. **One-way sync** - react-hook-form → Redux (only for context extraction, not bidirectional)
4. **Container pattern** - Container connects Redux, presentation component uses react-hook-form directly

### Benefits

- **Performance**: Form state stays local, no unnecessary re-renders
- **Separation**: Clear boundaries between form logic and global state
- **Flexibility**: Can update validation rules without affecting form state
- **Re-hydration**: Backend can update rules without losing form data

## Component Structure

### Form Container Component
- **Location**: `src/components/form-container.tsx`
- **Responsibility**: Connects Redux to presentation, initializes react-hook-form
- **Pattern**: Container/Presentation pattern (no UI markup)

### Form Presentation Component
- **Location**: `src/components/form-presentation.tsx`
- **Responsibility**: Renders form UI using react-hook-form methods
- **Pattern**: Pure presentation component

### useFormDescriptor Hook
- **Location**: `src/hooks/use-form-descriptor.ts`
- **Responsibility**: Bridges react-hook-form with form descriptor system
- **Features**:
  - Initializes `useForm()` with descriptor defaults
  - Auto-registers fields from descriptor
  - Watches discriminant fields
  - Updates validation rules on re-hydration
  - Maps backend errors to react-hook-form

## State Synchronization

### When Form Data Syncs to Redux

Form data is synced to Redux **only when discriminant fields change**:

1. User changes a field marked with `isDiscriminant: true`
2. `form.watch()` detects the change
3. `onDiscriminantChange` callback is triggered
4. Form data is synced to Redux via `syncFormDataToContext()`
5. Case context is extracted and compared
6. If context changed, re-hydration is triggered

### Why Not Sync All Fields?

- **Performance**: Syncing all fields on every change would cause unnecessary Redux updates
- **Purpose**: Redux only needs form data for context extraction, not as source of truth
- **Separation**: Form state belongs in react-hook-form, global state belongs in Redux

## Re-hydration Flow

When discriminant fields change:

1. **Extract context** from form data
2. **Compare context** with previous context
3. **If changed**, trigger re-hydration saga
4. **Debounce** (500ms) to prevent excessive API calls
5. **POST** to `/api/rules/context` with `CaseContext`
6. **Receive** `RulesObject` with updated validation rules
7. **Merge** rules into `mergedDescriptor`
8. **Update** react-hook-form validation rules
9. **Re-evaluate** status templates for visibility

## Best Practices

1. **Never mutate Redux state directly** - Use actions only
2. **Never mutate react-hook-form state directly** - Use form methods
3. **Keep form state in react-hook-form** - Don't duplicate in Redux
4. **Sync only when needed** - Only discriminant fields trigger sync
5. **Use selectors** - Access Redux state via selectors, not directly

## Related Files

- `src/components/form-container.tsx` - Container component
- `src/components/form-presentation.tsx` - Presentation component
- `src/hooks/use-form-descriptor.ts` - Form descriptor hook
- `src/store/form-dux.ts` - Redux state management
- `src/store/form-thunks.ts` - Redux thunks for async operations
- `src/hooks/use-form-query.ts` - TanStack Query hooks for server state
- `src/hooks/use-debounced-rehydration.ts` - Debounced rehydration hook with TanStack Query
- `src/utils/context-extractor.ts` - Context extraction utilities
- `src/utils/form-descriptor-integration.ts` - Integration utilities
