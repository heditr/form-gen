# Form Dataflow Documentation

This document describes the complete dataflow of the form engine, from initial global form descriptor loading through user interactions, Handlebars template evaluation, react-hook-form state management, Redux synchronization, re-hydration, and form submission.

## Table of Contents

1. [Overview](#overview)
2. [Initial Form Loading](#initial-form-loading)
3. [Form Initialization](#form-initialization)
4. [User Interaction Flow](#user-interaction-flow)
5. [Handlebars Template Evaluation](#handlebars-template-evaluation)
6. [Discriminant Field Changes and Re-hydration](#discriminant-field-changes-and-re-hydration)
7. [Dynamic Data Source Loading](#dynamic-data-source-loading)
8. [Form Submission](#form-submission)
9. [State Management Architecture](#state-management-architecture)
10. [Key Components and Their Roles](#key-components-and-their-roles)

## Overview

The form engine uses a hybrid state management architecture:
- **Redux** manages global state (descriptor, context, re-hydration status, data source cache)
- **react-hook-form** manages form state (field values, validation, errors)
- **Handlebars** evaluates templates for conditional visibility, disabled states, and dynamic URLs
- **One-way sync** from react-hook-form → Redux (only for context extraction)

## Initial Form Loading

### Step 1: Page Load Triggers Descriptor Fetch

**Location**: `src/app/page.tsx`

```typescript
useEffect(() => {
  dispatch(fetchGlobalDescriptor());
}, [dispatch]);
```

**Flow**:
1. Page component mounts
2. `useGlobalDescriptor()` hook is called
3. TanStack Query fetches the descriptor with automatic caching

### Step 2: TanStack Query Fetches Global Descriptor

**Location**: `src/hooks/use-form-query.ts` → `useGlobalDescriptor`

**Flow**:
1. TanStack Query makes GET request to `/api/form/global-descriptor`
2. API route (`src/app/api/form/global-descriptor/route.ts`) returns `GlobalFormDescriptor` JSON
3. Query automatically syncs to Redux state via `useEffect`
3. Saga dispatches `loadGlobalDescriptor({ descriptor })` action
4. Redux reducer updates state:
   - `globalDescriptor` = fetched descriptor
   - `mergedDescriptor` = fetched descriptor (initially same)

**State Update**:
```typescript
{
  globalDescriptor: GlobalFormDescriptor,
  mergedDescriptor: GlobalFormDescriptor,
  formData: {},
  caseContext: {},
  isRehydrating: false,
  dataSourceCache: {}
}
```

### Step 3: Form Container Receives Descriptor

**Location**: `src/components/form-container.tsx`

**Flow**:
1. `FormContainer` is connected to Redux via `connect()`
2. `mapStateToProps` selects `mergedDescriptor` from Redux state
3. Component receives `mergedDescriptor` as prop
4. Component passes descriptor to `useFormDescriptor` hook

## Form Initialization

### Step 1: Form Container Initialization

**Location**: `src/components/form-container.tsx`

**Flow**:
1. `FormContainer` is connected to Redux via `connect()`
2. `mapStateToProps` selects state from Redux:
   - `mergedDescriptor`: Form descriptor with merged rules
   - `formData`: Saved form data from Redux (for value restoration)
   - `caseContext`: Current case context
   - `isRehydrating`: Re-hydration loading state
3. Component calculates `formKey` based on validation rules:
   ```typescript
   const formKey = useMemo(() => {
     // Creates hash of field IDs and validation rule types
     // Changes when validation rules update (triggers remount)
     const validationHash = mergedDescriptor.blocks
       .flatMap(block => block.fields)
       .map(field => {
         const ruleTypes = field.validation?.map(r => {
           if (r.type === 'pattern') {
             // Include pattern value to detect pattern changes
             return `${r.type}:${r.value}`;
           }
           return `${r.type}:${'value' in r ? r.value : ''}`;
         }).join(',') || 'none';
         return `${field.id}:${ruleTypes}`;
       }).join('|');
     return `form-${validationHash}`;
   }, [mergedDescriptor]);
   ```
4. Renders `FormInner` component with `key={formKey}` to force remount when rules change

### Step 2: FormInner Component and useFormDescriptor Hook

**Location**: `src/components/form-container.tsx` → `FormInner` → `src/hooks/use-form-descriptor.ts`

**Flow**:
1. `FormInner` receives `mergedDescriptor` and `savedFormData` (from Redux)
2. Passes to `useFormDescriptor` hook:
   ```typescript
   const { form } = useFormDescriptor(mergedDescriptor, {
     onDiscriminantChange: handleDiscriminantChange,
     savedFormData, // Restore form values from Redux
   });
   ```
3. Hook extracts default values: `extractDefaultValues(descriptor)`
4. Merges with saved form data to preserve values on remount:
   ```typescript
   const initialValues = {
     ...defaultValues,  // From descriptor
     ...savedFormData,  // From Redux (preserves user input)
   };
   ```
5. Builds Zod schema from descriptor: `buildZodSchemaFromDescriptor(descriptor)`
6. Initializes `react-hook-form` with Zod resolver:
   ```typescript
   const form = useForm<FieldValues>({
     defaultValues: initialValues,
     resolver: zodResolver(zodSchema),  // Zod schema for validation
     mode: 'onChange',  // Validate on change for immediate feedback
   });
   ```

### Step 3: Zod Schema Building

**Location**: `src/utils/form-descriptor-integration.ts` → `buildZodSchemaFromDescriptor`

**Flow**:
1. Iterates through all blocks and fields in descriptor
2. For each field, calls `convertToZodSchema(field.validation, field.type)`
3. Creates base schema based on field type:
   - `text`, `dropdown`, `autocomplete`, `date` → `z.string()`
   - `checkbox` → `z.boolean()`
   - `number` → `z.number()`
   - `file` → `z.union([z.instanceof(File), z.array(z.instanceof(File)), z.null()])`
   - `radio` → `z.union([z.string(), z.number()])`
4. Applies validation rules:
   - `required`: Uses `refine()` to check non-empty/non-null values
   - `minLength`/`maxLength`: Uses `.min()`/`.max()` for strings/numbers
   - `pattern`: Converts string regex to `RegExp` and uses `.regex()`
   - `custom`: Uses `.refine()` with custom validator function
5. Returns complete Zod object schema: `z.object({ fieldId: schema, ... })`

### Step 4: Form Value Preservation

**Location**: `src/hooks/use-form-descriptor.ts`

**Flow**:
1. All form values are synced to Redux whenever any field changes:
   ```typescript
   form.watch((value) => {
     // Sync all form data to Redux for restoration on remount
     onDiscriminantChange(value as Partial<FormData>);
   });
   ```
2. Redux stores form data in `formState.formData`
3. When form remounts (due to `formKey` change):
   - `savedFormData` is passed to `useFormDescriptor`
   - Merged with defaults: `{ ...defaultValues, ...savedFormData }`
   - Form initializes with preserved values ✅

### Step 5: Field Registration (Automatic with Zod)

**Location**: `src/hooks/use-form-descriptor.ts`

**Flow**:
1. With Zod resolver, fields are automatically validated
2. No manual `form.register()` calls needed
3. Field components use `Controller` from react-hook-form:
   ```typescript
   <Controller
     name={field.id}
     control={form.control}
     render={({ field }) => <Input {...field} />}
   />
   ```
4. Validation happens automatically via Zod schema

### Step 3: Form Presentation Renders

**Location**: `src/components/form-presentation.tsx`

**Flow**:
1. Receives `form` object from `useFormDescriptor`
2. Gets current form values: `form.watch()` (for template evaluation)
3. Builds `formContext` from form values
4. Renders blocks from `mergedDescriptor.blocks`
5. For each block:
   - Evaluates visibility: `evaluateHiddenStatus(block, formContext)`
   - Evaluates disabled state: `evaluateDisabledStatus(block, formContext)`
   - Renders `Block` component if visible

### Step 4: Block and Field Rendering

**Location**: `src/components/block.tsx` → `src/components/field-wrapper.tsx`

**Flow**:
1. `Block` component receives block descriptor
2. For each field in block:
   - Evaluates field visibility: `evaluateHiddenStatus(field, formContext)`
   - Evaluates field disabled state: `evaluateDisabledStatus(field, formContext)`
   - Renders appropriate field component (Text, Dropdown, Autocomplete, etc.)
3. Field components use react-hook-form:
   - `form.register()` or `form.control` for field registration
   - `form.formState.errors` for error display
   - `form.watch()` for reactive updates

## User Interaction Flow

### Step 1: User Types/Selects in Field

**Location**: Field components (e.g., `src/components/text-field.tsx`)

**Flow**:
1. User interacts with field (types, selects, etc.)
2. Field component updates via react-hook-form
3. react-hook-form:
   - Updates field value in internal state
   - Triggers validation (mode: 'onChange')
   - Updates `formState.errors` if validation fails
   - Triggers re-render of components watching this field

### Step 2: react-hook-form Validation

**Location**: react-hook-form internal + `src/hooks/use-form-descriptor.ts`

**Flow**:
1. react-hook-form runs validation rules registered for the field
2. If validation fails:
   - Sets error in `form.formState.errors[fieldId]`
   - Field component displays error message
3. If validation passes:
   - Clears error for that field

### Step 3: Template Re-evaluation

**Location**: `src/components/form-presentation.tsx` → `src/utils/template-evaluator.ts`

**Flow**:
1. `form.watch()` triggers re-render when values change
2. `formContext` is rebuilt with new form values
3. For each block/field:
   - `evaluateHiddenStatus()` re-evaluates Handlebars template
   - `evaluateDisabledStatus()` re-evaluates Handlebars template
   - Components re-render with updated visibility/disabled states

**Example Template Evaluation**:
```handlebars
// Block hidden template
hidden: '{{isEmpty country}}'

// Field disabled template
disabled: '{{not newsletter}}'
```

### Step 4: Discriminant Field Detection

**Location**: `src/hooks/use-form-descriptor.ts` → `useEffect` watching discriminant fields

**Flow**:
1. `form.watch()` subscription monitors all field changes
2. If changed field is in `discriminantFields` list:
   - Calls `onDiscriminantChange(newFormData)` callback
   - Passes current form data as parameter

## Discriminant Field Changes and Re-hydration

### Step 1: Discriminant Change Callback

**Location**: `src/components/form-container.tsx` → `handleDiscriminantChange`

**Flow**:
1. Receives `newFormData` from `useFormDescriptor`
2. Syncs form data to Redux: `syncFormData(newFormData)`
3. Identifies discriminant fields from descriptor
4. Updates case context: `updateCaseContext(caseContext, newFormData, discriminantFields)`
5. Checks if context changed: `hasContextChanged(caseContext, updatedContext)`
6. If changed, triggers re-hydration: `rehydrate(updatedContext)`

### Step 2: Context Extraction

**Location**: `src/utils/context-extractor.ts`

**Flow**:
1. `updateCaseContext()` extracts values from form data for discriminant fields
2. Creates updated `CaseContext` object:
   ```typescript
   {
     country: 'US',
     jurisdiction: 'DE',
     // ... other discriminant field values
   }
   ```
3. `hasContextChanged()` compares old vs new context
4. Returns `true` if any discriminant field value changed

### Step 3: Re-hydration

**Location**: `src/store/form-thunks.ts` → `rehydrateRulesThunk` or `src/hooks/use-debounced-rehydration.ts`

**Flow**:
1. Thunk receives `rehydrateRulesThunk(caseContext)` or hook receives `mutate(caseContext)`
2. **Debounces** for 500ms to prevent excessive API calls
3. Sets `isRehydrating: true` in Redux state
4. Makes POST request to `/api/rules/context` with `CaseContext`
5. Backend (`src/app/api/rules/context/route.ts`) evaluates rules
6. Returns `RulesObject` with updated validation rules and status templates
7. Saga dispatches `applyRulesUpdate({ rulesObject })`

### Step 4: Rules Merging

**Location**: `src/store/form-dux.ts` → `applyRulesUpdate` reducer

**Flow**:
1. Reducer receives `RulesObject` from saga
2. Calls `mergeDescriptorWithRules(globalDescriptor, rulesObject)`
3. **Merges**:
   - Validation rules: Appends new rules to existing field rules
   - Status templates: Merges hidden/disabled/readonly templates
4. Updates `mergedDescriptor` in Redux state
5. Sets `isRehydrating: false`

**Important**: The reducer now actually merges rules (previously was a TODO):
```typescript
case applyRulesUpdate().type: {
  const { rulesObject } = action.payload;
  if (!rulesObject || !state.globalDescriptor) {
    return { ...state, isRehydrating: false };
  }
  // Actually merge rules into descriptor
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
```

### Step 5: Form Remounting with New Validation Rules

**Location**: `src/components/form-container.tsx`

**Flow**:
1. `mergedDescriptor` change triggers `formKey` recalculation
2. `formKey` changes because validation rules changed (e.g., phone pattern updated)
3. React sees different `key` prop on `FormInner` component
4. **FormInner remounts** (old instance unmounts, new instance mounts)
5. New `useFormDescriptor` hook instance is created:
   - Receives updated `mergedDescriptor` with new validation rules
   - Receives `savedFormData` from Redux (preserves user input)
   - Builds new Zod schema with updated validation rules
   - Initializes new `useForm()` with new Zod resolver
6. Form now has updated validation rules ✅

**Why Remount?**
- react-hook-form's `zodResolver` is set at initialization
- Resolver cannot be changed after form is created
- Remounting ensures form uses new resolver with updated schema

### Step 6: Form Value Restoration

**Location**: `src/hooks/use-form-descriptor.ts`

**Flow**:
1. Before remount, all form values were synced to Redux via `form.watch()`
2. During remount, `savedFormData` is passed to `useFormDescriptor`
3. Hook merges saved data with defaults:
   ```typescript
   const initialValues = {
     ...defaultValues,  // From descriptor (type-appropriate defaults)
     ...savedFormData,  // From Redux (user's input) - takes precedence
   };
   ```
4. Form initializes with preserved values:
   ```typescript
   const form = useForm({
     defaultValues: initialValues,  // Includes saved form data
     resolver: zodResolver(zodSchema),  // New schema with updated rules
   });
   ```
5. User sees their input preserved with new validation rules applied ✅

### Step 7: Template Re-evaluation

**Location**: `src/components/form-presentation.tsx`

**Flow**:
1. `mergedDescriptor` change triggers re-render
2. New status templates are evaluated with current `formContext`
3. Blocks/fields visibility and disabled states update
4. UI reflects new rules (fields may appear/disappear, enable/disable)

## Dynamic Data Source Loading

### Step 1: Field Requires Data Source

**Location**: Field components (e.g., `src/components/dropdown-field.tsx`, `src/components/autocomplete-field.tsx`)

**Flow**:
1. Field descriptor has `dataSource` configuration:
   ```typescript
   {
     url: '/api/data-sources/states',
     itemsTemplate: '{"label":"{{item.name}}","value":"{{item.code}}"}',
     auth: { type: 'bearer', token: '...' }  // optional
   }
   ```
2. Field component checks `dataSourceCache` for cached data
3. If not cached, calls `onLoadDataSource(fieldPath, url, auth)`

### Step 2: Data Source Loading

**Location**: `src/store/form-thunks.ts` → `fetchDataSourceThunk` or `src/hooks/use-form-query.ts` → `useDataSource`

**Flow**:
1. Thunk receives `fetchDataSourceThunk({ fieldPath, url, auth })` or hook is called with params
2. Gets `mergedDescriptor` and `formData` from Redux state
3. Finds field descriptor to get full `DataSourceConfig`
4. Builds `formContext` from form data
5. Calls `loadDataSourceUtil(dataSourceConfig, formContext)`

### Step 3: URL Template Evaluation

**Location**: `src/utils/data-source-loader.ts`

**Flow**:
1. Evaluates URL template with form context:
   ```typescript
   const url = evaluateTemplate(config.url, formContext);
   // Example: '/api/data-sources/cities?country={{country}}'
   // Becomes: '/api/data-sources/cities?country=US'
   ```
2. Checks cache (key: `url + auth config`)
3. If cached, returns cached items

### Step 4: API Call and Response Transformation

**Location**: `src/utils/data-source-loader.ts` → `src/utils/response-transformer.ts`

**Flow**:
1. Makes GET request to evaluated URL with auth headers
2. Receives JSON response
3. Transforms response using `itemsTemplate`:
   ```typescript
   // itemsTemplate: '{"label":"{{item.name}}","value":"{{item.code}}"}'
   // Response: [{ name: 'California', code: 'CA' }, ...]
   // Transformed: [{ label: 'California', value: 'CA' }, ...]
   ```
4. Caches transformed items
5. Returns array of `FieldItem[]`

### Step 5: Cache Update and Field Rendering

**Location**: `src/store/form-dux.ts` → `loadDataSource` reducer

**Flow**:
1. Reducer receives `loadDataSource({ fieldPath, data })` action
2. Updates `dataSourceCache[fieldPath] = data`
3. Field component re-renders with new data
4. Dropdown/Autocomplete displays items from cache

## Form Submission

### Step 1: User Clicks Submit

**Location**: `src/components/submit-button.tsx`

**Flow**:
1. User clicks submit button
2. Calls `form.handleSubmit(onSubmit)` from react-hook-form
3. react-hook-form:
   - Validates all fields
   - If validation fails, displays errors and stops
   - If validation passes, calls `onSubmit` callback

### Step 2: Submission Handler

**Location**: `src/components/form-container.tsx` or custom submission handler

**Flow**:
1. `onSubmit` receives validated form data
2. Dispatches `submitForm(url, method, formData, headers, auth)` action
3. Submission saga handles the request

### Step 3: Form Submission

**Location**: `src/store/form-thunks.ts` → `submitFormThunk` or `src/hooks/use-form-query.ts` → `useSubmitForm`

**Flow**:
1. Thunk receives submission params or mutation is called
2. Builds request headers (including auth if provided)
3. Makes HTTP request (GET/POST/PUT/PATCH) to submission URL
4. If successful:
   - Returns response data
   - Can dispatch success action
5. If validation errors:
   - Receives error response
   - Maps backend errors to react-hook-form: `setBackendErrors(errors)`
   - Field components display backend validation errors

### Step 4: Backend Error Mapping

**Location**: `src/hooks/use-form-descriptor.ts` → `setBackendErrors`

**Flow**:
1. Receives array of `{ field: string, message: string }`
2. Maps to react-hook-form error format
3. Sets errors: `form.setError(field, { type: 'server', message })`
4. Field components display server validation errors

## State Management Architecture

### Redux State (Global)

**Location**: `src/store/form-dux.ts`

**Manages**:
- `globalDescriptor`: Original form descriptor from API
- `mergedDescriptor`: Descriptor with merged rules (source of truth for form structure)
- `caseContext`: Discriminant field values for rules evaluation
- `isRehydrating`: Loading state during rules re-hydration
- `dataSourceCache`: Cached data for dynamic fields
- `formData`: Synced from react-hook-form (for context extraction only)

**Why Redux?**
- Global state needs to be shared across components
- Descriptor and context need to persist across re-renders
- Re-hydration status needs to be tracked globally
- Data source cache needs to be shared

### react-hook-form State (Local)

**Location**: `src/hooks/use-form-descriptor.ts`

**Manages**:
- Field values (all current form data)
- Validation state (which fields are valid/invalid)
- Field-level errors (validation error messages)
- Form submission state (isSubmitting, isSubmitted, etc.)

**Why react-hook-form?**
- Optimized for form performance (<100ms validation feedback)
- Minimal re-renders (only affected fields re-render)
- Built-in validation with excellent DX
- Handles complex form scenarios (arrays, nested fields, etc.)

### Synchronization Strategy

**One-way sync**: react-hook-form → Redux

**When synced**:
- **All form values** are synced to Redux whenever ANY field changes
- Purpose: 
  1. Context extraction for rules re-hydration (discriminant fields)
  2. **Form value preservation** during remount (all fields)
- Not bidirectional: Redux doesn't update react-hook-form (except validation rules via remount)

**Why sync all fields?**
- Form remounting: When validation rules change, form remounts
- Value preservation: All form values must be in Redux to restore on remount
- User experience: Users don't lose their input when rules update

**Why one-way?**
- Performance: Redux updates are debounced/optimized
- Separation of concerns: Form state belongs in react-hook-form
- Redux is used for:
  - Context extraction (discriminant fields)
  - Value preservation (all fields during remount)
  - Not as source of truth for form state

## Key Components and Their Roles

### Form Container (`src/components/form-container.tsx`)

**Role**: Redux-connected container component

**Responsibilities**:
- Connects Redux state/actions to presentation
- Initializes `useFormDescriptor` hook
- Handles discriminant field changes
- Syncs form data to Redux for context extraction
- Triggers re-hydration when context changes

**Pattern**: Container/Presentation (no UI markup)

### Form Presentation (`src/components/form-presentation.tsx`)

**Role**: Pure presentation component

**Responsibilities**:
- Renders form blocks and fields
- Evaluates Handlebars templates for visibility/disabled states
- Passes react-hook-form methods to field components
- Handles form submission

**Pattern**: Pure presentation (no Redux connection)

### useFormDescriptor Hook (`src/hooks/use-form-descriptor.ts`)

**Role**: Bridge between react-hook-form and form descriptor system

**Responsibilities**:
- Extracts default values from descriptor
- Merges saved form data (from Redux) with defaults for value preservation
- Builds Zod schema from descriptor validation rules
- Initializes `useForm()` with Zod resolver
- Watches all form values and syncs to Redux (for preservation)
- Handles discriminant field changes for re-hydration
- Maps backend errors to react-hook-form

**Key Features**:
- **Zod Integration**: Uses `zodResolver` for type-safe validation
- **Value Preservation**: Merges `savedFormData` with defaults on remount
- **Automatic Validation**: Fields validated via Zod schema, no manual registration needed

### Block Component (`src/components/block.tsx`)

**Role**: Renders a form block with fields

**Responsibilities**:
- Evaluates block visibility/disabled status templates
- Renders block title and description
- Maps over fields and renders `FieldWrapper`
- Handles smooth enter/exit animations

### Field Components (e.g., `text-field.tsx`, `dropdown-field.tsx`)

**Role**: Render individual form fields

**Responsibilities**:
- Register with react-hook-form
- Display field label, description, errors
- Handle user input
- Load data sources for dropdown/autocomplete
- Evaluate field-level status templates

### Template Evaluator (`src/utils/template-evaluator.ts`)

**Role**: Evaluate Handlebars templates with form context

**Responsibilities**:
- Compile and evaluate Handlebars templates
- Evaluate hidden/disabled/readonly status templates
- Parse boolean results from template strings
- Handle template errors gracefully

### Context Extractor (`src/utils/context-extractor.ts`)

**Role**: Extract and manage case context

**Responsibilities**:
- Identify discriminant fields
- Extract discriminant values from form data
- Update case context
- Detect context changes
- Initialize context from case prefill

### Descriptor Merger (`src/utils/descriptor-merger.ts`)

**Role**: Merge rules into form descriptor

**Responsibilities**:
- Deep merge `RulesObject` into `GlobalFormDescriptor`
- Merge validation rules (append new to existing)
- Merge status templates (preserve existing, add new)
- Preserve original descriptor structure

**Important**: This is called in the `applyRulesUpdate` reducer to actually merge rules from the API into the descriptor. Previously this was a TODO and rules weren't being merged.

### Data Source Loader (`src/utils/data-source-loader.ts`)

**Role**: Load dynamic field data from APIs

**Responsibilities**:
- Evaluate URL templates with form context
- Make authenticated API calls
- Transform responses using itemsTemplate
- Cache responses to prevent duplicate requests
- Handle errors gracefully

## Dataflow Diagrams

### Initial Load Flow

```
Page Component
    ↓ useGlobalDescriptor() hook
TanStack Query (useQuery)
    ↓ GET /api/form/global-descriptor
API Route
    ↓ returns GlobalFormDescriptor
TanStack Query cache + useEffect
    ↓ dispatch(loadGlobalDescriptor())
Redux Reducer (loadGlobalDescriptor)
    ↓ updates:
      - globalDescriptor = fetched descriptor
      - mergedDescriptor = fetched descriptor (initially same)
      - formData = {} (empty initially)
Form Container (mapStateToProps)
    ↓ receives:
      - mergedDescriptor
      - formData = {} (no saved data yet)
    ↓ calculates formKey (based on validation rules)
FormInner Component (key={formKey})
    ↓ passes to useFormDescriptor:
      - mergedDescriptor
      - savedFormData = {} (empty)
useFormDescriptor Hook
    ↓
    1. extractDefaultValues(descriptor) → defaultValues
    2. Merge: { ...defaultValues, ...savedFormData } → initialValues
    3. buildZodSchemaFromDescriptor(descriptor) → zodSchema
    4. useForm({ defaultValues: initialValues, resolver: zodResolver(zodSchema) })
    ↓
Form Presentation
    ↓ renders blocks and fields with react-hook-form
User sees form (with default values, Zod validation active)
```

### User Interaction Flow

```
User types in field
    ↓
react-hook-form updates value
    ↓
Validation runs (onChange mode)
    ↓
form.watch() triggers re-render
    ↓
Template re-evaluation (visibility/disabled)
    ↓
UI updates (fields appear/disappear, enable/disable)
```

### Discriminant Field Change Flow

```
User changes discriminant field (e.g., selects "United States")
    ↓
react-hook-form detects change
    ↓
form.watch() triggers (all field changes)
    ↓
useFormDescriptor.onDiscriminantChange(formData)
    ↓
FormContainer.handleDiscriminantChange(newFormData)
    ↓
1. syncFormDataToContext(newFormData) → Redux
   - Stores ALL form data in Redux for restoration
    ↓
2. updateCaseContext() → Extract context
   - Extracts discriminant field values (country: 'US')
    ↓
3. hasContextChanged() → Check if changed
   - Compares old vs new context
    ↓
4. rehydrateRulesThunk(updatedContext) → Dispatch thunk
    ↓ (or useDebouncedRehydration() hook)
Redux Thunk (rehydrateRulesThunk)
    ↓ debounce 500ms
POST /api/rules/context with CaseContext
    ↓
Backend returns RulesObject
   - Example: { fields: [{ id: 'phone', validation: [
       { type: 'required', message: '...' },
       { type: 'pattern', value: '^\\(\\d{3}\\) \\d{3}-\\d{4}$', message: '...' }
     ]}]}
    ↓
applyRulesUpdate({ rulesObject }) → Redux reducer
    ↓
mergeDescriptorWithRules(globalDescriptor, rulesObject)
    ↓
mergedDescriptor updated in Redux state
    ↓
FormContainer.formKey recalculates
   - Validation hash changes (phone field now has pattern rule)
    ↓
formKey changes → FormInner remounts
    ↓
useFormDescriptor re-initializes:
   1. Receives updated mergedDescriptor (with new phone pattern)
   2. Receives savedFormData from Redux (preserves user input)
   3. Builds new Zod schema with phone pattern validation
   4. Merges savedFormData with defaults
   5. Creates new useForm() with new Zod resolver
    ↓
Form now has:
   - Updated validation rules (phone pattern) ✅
   - Preserved form values (user's input) ✅
   - New Zod schema applied ✅
    ↓
Template re-evaluation → UI updates
```

### Data Source Loading Flow

```
Field component needs data
    ↓
onLoadDataSource(fieldPath, url, auth)
    ↓
Redux Thunk (fetchDataSourceThunk) or TanStack Query (useDataSource hook)
    ↓
loadDataSourceUtil(dataSourceConfig, formContext)
    ↓
1. Evaluate URL template
2. Check cache
3. Make API call (if not cached)
4. Transform response with itemsTemplate
5. Cache result
    ↓
loadDataSource() → Redux reducer
    ↓
dataSourceCache[fieldPath] = items
    ↓
Field component re-renders with data
```

### Form Submission Flow

```
User clicks submit
    ↓
form.handleSubmit(onSubmit)
    ↓
react-hook-form validates all fields
    ↓
If valid: onSubmit(formData)
    ↓
submitForm(url, method, formData, headers, auth)
    ↓
Redux Thunk (submitFormThunk) or TanStack Query (useSubmitForm hook)
    ↓
HTTP request to submission URL
    ↓
If success: Dispatch success action
If validation errors: setBackendErrors() → react-hook-form
    ↓
Field components display errors
```

## Handlebars Template Examples

### Status Templates

```handlebars
// Block hidden if country is empty
hidden: '{{isEmpty country}}'

// Field disabled if newsletter is not checked
disabled: '{{not newsletter}}'

// Block visible only for US or CA
hidden: '{{not (or (eq country "US") (eq country "CA"))}}'

// Field readonly if age < 18
readonly: '{{lt age 18}}'
```

### URL Templates (Data Sources)

```handlebars
// Static URL
url: '/api/data-sources/states'

// Dynamic URL with form context
url: '/api/data-sources/cities?country={{country}}&state={{state}}'

// Nested property access
url: '/api/data-sources/address?zip={{address.zipcode}}'
```

### Items Template (Response Transformation)

```handlebars
// Simple transformation
itemsTemplate: '{"label":"{{item.name}}","value":"{{item.code}}"}'

// Complex transformation with nested properties
itemsTemplate: '{"label":"{{item.firstName}} {{item.lastName}}","value":"{{item.id}}","category":"{{item.category.name}}"}'
```

## Key Design Decisions

### Why Hybrid State Management?

1. **Performance**: react-hook-form provides <100ms validation feedback
2. **Separation**: Clear boundaries between form logic and global state
3. **Flexibility**: Can update validation rules without affecting form state
4. **Re-hydration**: Backend can update rules without losing form data

### Why One-way Sync?

1. **Performance**: Avoid Redux updates on every keystroke
2. **Purpose**: Redux only needs form data for context extraction
3. **Separation**: Form state belongs in react-hook-form, not Redux

### Why Handlebars Templates?

1. **Flexibility**: Dynamic visibility/disabled states based on form values
2. **Expressiveness**: Complex logic with helpers (eq, or, not, isEmpty, etc.)
3. **Familiar**: Handlebars is widely used and well-documented
4. **Server-side compatible**: Same templates can be used on backend

### Why Debounced Re-hydration?

1. **Performance**: Prevents excessive API calls during rapid typing
2. **User experience**: Reduces flickering and unnecessary updates
3. **Cost**: Reduces backend load for rules evaluation

## Related Files

### Core Components
- `src/components/form-container.tsx` - Redux-connected container
- `src/components/form-presentation.tsx` - Presentation component
- `src/components/block.tsx` - Block renderer
- `src/components/field-wrapper.tsx` - Field wrapper
- `src/components/*-field.tsx` - Individual field components

### Hooks
- `src/hooks/use-form-descriptor.ts` - Form descriptor integration hook

### State Management
- `src/store/form-dux.ts` - Redux reducer, actions, selectors
- `src/store/form-thunks.ts` - Redux thunks for async operations
- `src/store/store.ts` - Redux store configuration (Redux Toolkit)
- `src/store/store.ts` - Redux store configuration

### Utilities
- `src/utils/template-evaluator.ts` - Handlebars template evaluation
- `src/utils/handlebars-helpers.ts` - Custom Handlebars helpers
- `src/utils/context-extractor.ts` - Case context extraction
- `src/utils/descriptor-merger.ts` - Rules merging
- `src/utils/data-source-loader.ts` - Dynamic data loading
- `src/utils/response-transformer.ts` - Response transformation
- `src/utils/form-descriptor-integration.ts` - Integration utilities

### API Routes
- `src/app/api/form/global-descriptor/route.ts` - Global descriptor endpoint
- `src/app/api/rules/context/route.ts` - Rules re-hydration endpoint
- `src/app/api/data-sources/*/route.ts` - Data source endpoints

### Types
- `src/types/form-descriptor.ts` - TypeScript type definitions

## Complete Re-hydration Flow Summary

This section provides a complete walkthrough of the re-hydration process from start to finish.

### Scenario: User Selects Country "United States"

**Initial State**:
- Form has `phone` field with no pattern validation
- User has typed "1234567890" in phone field
- Country field is empty

**Step-by-Step Flow**:

1. **User Action**: User selects "United States" from country dropdown
   - react-hook-form updates `country` field value to `"US"`

2. **Form Watch Trigger**: `form.watch()` detects change
   - Calls `onDiscriminantChange` with ALL form data (including phone: "1234567890")

3. **Sync to Redux**: `handleDiscriminantChange` syncs form data
   - `syncFormDataToContext(newFormData)` → Redux
   - Redux state: `formData = { country: "US", phone: "1234567890", ... }`

4. **Context Extraction**: Extract discriminant values
   - `updateCaseContext()` extracts `country: "US"`
   - `hasContextChanged()` detects change (was empty, now "US")

5. **Trigger Re-hydration**: Dispatch re-hydration action
   - `rehydrateRulesThunk({ country: "US" })` → Redux Thunk (or `useDebouncedRehydration()` hook)

6. **Saga Debounce**: Wait 500ms to prevent excessive calls
   - `isRehydrating: true` in Redux state

7. **API Call**: POST to `/api/rules/context`
   - Request body: `{ country: "US" }`
   - Backend evaluates rules based on country

8. **Backend Response**: Returns `RulesObject`
   ```json
   {
     "fields": [{
       "id": "phone",
       "validation": [
         { "type": "required", "message": "Phone number is required" },
         { 
           "type": "pattern", 
           "value": "^\\(\\d{3}\\) \\d{3}-\\d{4}$",
           "message": "Phone number must be in format (XXX) XXX-XXXX"
         }
       ]
     }]
   }
   ```

9. **Rules Merging**: Redux reducer merges rules
   - `applyRulesUpdate({ rulesObject })` → Redux reducer
   - `mergeDescriptorWithRules(globalDescriptor, rulesObject)`
   - Phone field now has pattern validation rule
   - `mergedDescriptor` updated in Redux state

10. **Form Key Recalculation**: Container calculates new key
    - `formKey` changes because phone field validation rules changed
    - Old key: `form-phone:none|...`
    - New key: `form-phone:required,pattern:^\\(\\d{3}\\) \\d{3}-\\d{4}$|...`

11. **Form Remount**: React sees different key
    - Old `FormInner` unmounts
    - New `FormInner` mounts with `key={newFormKey}`

12. **Form Re-initialization**: `useFormDescriptor` re-runs
    - Receives updated `mergedDescriptor` (with phone pattern rule)
    - Receives `savedFormData` from Redux: `{ country: "US", phone: "1234567890", ... }`
    - Extracts defaults: `{ phone: "", country: "", ... }`
    - Merges: `{ ...defaults, ...savedFormData }` → `{ phone: "1234567890", country: "US", ... }`
    - Builds Zod schema: Phone field now has `.regex(/^\(\d{3}\) \d{3}-\d{4}$/, message)`
    - Initializes form: `useForm({ defaultValues: mergedValues, resolver: zodResolver(newSchema) })`

13. **Validation Active**: Form now validates with new rules
    - Phone field value: "1234567890" (preserved from before)
    - Pattern validation: Fails (doesn't match `(XXX) XXX-XXXX` format)
    - Error displayed: "Phone number must be in format (XXX) XXX-XXXX"

14. **User Sees Result**:
    - ✅ Form values preserved (phone: "1234567890")
    - ✅ New validation rules active (pattern validation)
    - ✅ Error message displayed
    - ✅ User can correct input to match pattern

### Key Takeaways

1. **Form Remounting**: Validation rules can't be updated dynamically, so form remounts with new resolver
2. **Value Preservation**: All form values synced to Redux before remount, restored after remount
3. **Zod Integration**: Validation rules converted to Zod schema, applied via resolver
4. **Pattern Handling**: String regex patterns from JSON converted to RegExp objects
5. **Complete Flow**: From user action → API call → rules merge → form remount → validation active

## Complete Re-hydration Flow Summary

This section provides a complete walkthrough of the re-hydration process from start to finish.

### Scenario: User Selects Country "United States"

**Initial State**:
- Form has `phone` field with no pattern validation
- User has typed "1234567890" in phone field
- Country field is empty

**Step-by-Step Flow**:

1. **User Action**: User selects "United States" from country dropdown
   - react-hook-form updates `country` field value to `"US"`

2. **Form Watch Trigger**: `form.watch()` detects change
   - Calls `onDiscriminantChange` with ALL form data (including phone: "1234567890")

3. **Sync to Redux**: `handleDiscriminantChange` syncs form data
   - `syncFormDataToContext(newFormData)` → Redux
   - Redux state: `formData = { country: "US", phone: "1234567890", ... }`

4. **Context Extraction**: Extract discriminant values
   - `updateCaseContext()` extracts `country: "US"`
   - `hasContextChanged()` detects change (was empty, now "US")

5. **Trigger Re-hydration**: Dispatch re-hydration action
   - `rehydrateRulesThunk({ country: "US" })` → Redux Thunk (or `useDebouncedRehydration()` hook)

6. **Saga Debounce**: Wait 500ms to prevent excessive calls
   - `isRehydrating: true` in Redux state

7. **API Call**: POST to `/api/rules/context`
   - Request body: `{ country: "US" }`
   - Backend evaluates rules based on country

8. **Backend Response**: Returns `RulesObject`
   ```json
   {
     "fields": [{
       "id": "phone",
       "validation": [
         { "type": "required", "message": "Phone number is required" },
         { 
           "type": "pattern", 
           "value": "^\\(\\d{3}\\) \\d{3}-\\d{4}$",
           "message": "Phone number must be in format (XXX) XXX-XXXX"
         }
       ]
     }]
   }
   ```

9. **Rules Merging**: Redux reducer merges rules
   - `applyRulesUpdate({ rulesObject })` → Redux reducer
   - `mergeDescriptorWithRules(globalDescriptor, rulesObject)`
   - Phone field now has pattern validation rule
   - `mergedDescriptor` updated in Redux state

10. **Form Key Recalculation**: Container calculates new key
    - `formKey` changes because phone field validation rules changed
    - Old key: `form-phone:none|...`
    - New key: `form-phone:required,pattern:^\\(\\d{3}\\) \\d{3}-\\d{4}$|...`

11. **Form Remount**: React sees different key
    - Old `FormInner` unmounts
    - New `FormInner` mounts with `key={newFormKey}`

12. **Form Re-initialization**: `useFormDescriptor` re-runs
    - Receives updated `mergedDescriptor` (with phone pattern rule)
    - Receives `savedFormData` from Redux: `{ country: "US", phone: "1234567890", ... }`
    - Extracts defaults: `{ phone: "", country: "", ... }`
    - Merges: `{ ...defaults, ...savedFormData }` → `{ phone: "1234567890", country: "US", ... }`
    - Builds Zod schema: Phone field now has `.regex(/^\(\d{3}\) \d{3}-\d{4}$/, message)`
    - Initializes form: `useForm({ defaultValues: mergedValues, resolver: zodResolver(newSchema) })`

13. **Validation Active**: Form now validates with new rules
    - Phone field value: "1234567890" (preserved from before)
    - Pattern validation: Fails (doesn't match `(XXX) XXX-XXXX` format)
    - Error displayed: "Phone number must be in format (XXX) XXX-XXXX"

14. **User Sees Result**:
    - ✅ Form values preserved (phone: "1234567890")
    - ✅ New validation rules active (pattern validation)
    - ✅ Error message displayed
    - ✅ User can correct input to match pattern

### Key Takeaways

1. **Form Remounting**: Validation rules can't be updated dynamically, so form remounts with new resolver
2. **Value Preservation**: All form values synced to Redux before remount, restored after remount
3. **Zod Integration**: Validation rules converted to Zod schema, applied via resolver
4. **Pattern Handling**: String regex patterns from JSON converted to RegExp objects
5. **Complete Flow**: From user action → API call → rules merge → form remount → validation active
