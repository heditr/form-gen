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
2. `useEffect` dispatches `fetchGlobalDescriptor()` action
3. Redux Saga intercepts the action

### Step 2: Saga Fetches Global Descriptor

**Location**: `src/store/form-sagas.ts` → `loadGlobalDescriptorSaga`

**Flow**:
1. Saga makes GET request to `/api/form/global-descriptor`
2. API route (`src/app/api/form/global-descriptor/route.ts`) returns `GlobalFormDescriptor` JSON
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

### Step 1: useFormDescriptor Hook Initialization

**Location**: `src/hooks/use-form-descriptor.ts`

**Flow**:
1. Hook receives `mergedDescriptor` from container
2. Extracts default values from descriptor using `extractDefaultValues()`
3. Initializes `react-hook-form` with:
   ```typescript
   const form = useForm<FieldValues>({
     defaultValues,  // Extracted from descriptor
     mode: 'onChange',  // Validate on change for immediate feedback
   });
   ```
4. Auto-registers all fields from descriptor with validation rules
5. Sets up discriminant field watcher

### Step 2: Field Registration

**Location**: `src/hooks/use-form-descriptor.ts` → `registerField`

**Flow**:
1. For each field in descriptor blocks:
   - Extracts validation rules using `getFieldValidationRules()`
   - Registers field with react-hook-form: `form.register(fieldId, validationRules)`
   - Tracks registered fields in `registeredFields` Set

**Validation Rules Mapping**:
- `required` → `{ required: true, message: '...' }`
- `minLength` → `{ minLength: value, message: '...' }`
- `maxLength` → `{ maxLength: value, message: '...' }`
- `pattern` → `{ pattern: regex, message: '...' }`
- etc.

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

### Step 3: Re-hydration Saga

**Location**: `src/store/form-sagas.ts` → `rehydrateRulesSaga`

**Flow**:
1. Saga receives `rehydrateRules(caseContext)` action
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

### Step 5: Validation Rules Update

**Location**: `src/hooks/use-form-descriptor.ts` → `updateValidationRules`

**Flow**:
1. `useFormDescriptor` detects `mergedDescriptor` change
2. Calls `updateValidationRules(updatedDescriptor)`
3. For each registered field:
   - Clears existing errors: `form.clearErrors(fieldId)`
   - Re-registers field with new rules: `form.register(fieldId, newValidationRules)`
4. react-hook-form re-validates fields with updated rules

### Step 6: Template Re-evaluation

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

### Step 2: Data Source Saga

**Location**: `src/store/form-sagas.ts` → `loadDataSourceSaga`

**Flow**:
1. Saga receives `fetchDataSource(fieldPath, url, auth)` action
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

### Step 3: Submission Saga

**Location**: `src/store/form-sagas.ts` → `submitFormSaga`

**Flow**:
1. Saga receives submission action
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
- Only when discriminant fields change
- Purpose: Context extraction for rules re-hydration
- Not bidirectional: Redux doesn't update react-hook-form (except validation rules)

**Why one-way?**
- Performance: Avoid unnecessary Redux updates on every keystroke
- Separation of concerns: Form state belongs in react-hook-form
- Redux only needs form data for context extraction, not as source of truth

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
- Initializes `useForm()` with descriptor defaults
- Auto-registers fields with validation rules
- Watches discriminant fields for changes
- Updates validation rules on re-hydration
- Maps backend errors to react-hook-form

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
    ↓ dispatch(fetchGlobalDescriptor())
Redux Saga (loadGlobalDescriptorSaga)
    ↓ GET /api/form/global-descriptor
API Route
    ↓ returns GlobalFormDescriptor
Redux Reducer (loadGlobalDescriptor)
    ↓ updates globalDescriptor, mergedDescriptor
Form Container (mapStateToProps)
    ↓ receives mergedDescriptor
useFormDescriptor Hook
    ↓ extracts defaultValues, initializes useForm()
Form Presentation
    ↓ renders blocks and fields
User sees form
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
User changes discriminant field
    ↓
react-hook-form detects change
    ↓
useFormDescriptor.onDiscriminantChange()
    ↓
FormContainer.handleDiscriminantChange()
    ↓
1. syncFormDataToContext() → Redux
2. updateCaseContext() → Extract context
3. hasContextChanged() → Check if changed
4. rehydrateRules() → Trigger saga
    ↓
Redux Saga (rehydrateRulesSaga)
    ↓ debounce 500ms
POST /api/rules/context with CaseContext
    ↓
Backend returns RulesObject
    ↓
applyRulesUpdate() → Merge rules
    ↓
updateValidationRules() → Update react-hook-form
    ↓
Template re-evaluation → UI updates
```

### Data Source Loading Flow

```
Field component needs data
    ↓
onLoadDataSource(fieldPath, url, auth)
    ↓
Redux Saga (loadDataSourceSaga)
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
Redux Saga (submitFormSaga)
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
- `src/store/form-sagas.ts` - Redux sagas for async operations
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
