# KYC Form Engine v3.1 Epic

**Status**: 📋 PLANNED  
**Goal**: Build a metadata-driven dynamic form engine that adapts to jurisdiction changes in real-time, providing immediate UX feedback while ensuring backend compliance validation.

## Overview

Complex KYC forms overwhelm applicants and break when jurisdiction rules change, causing abandonment and compliance failures. This system solves both problems by using a hierarchical form descriptor (blocks → fields) with hybrid reactivity: Handlebars templates provide instant UI updates while a backend re-hydration loop ensures compliance rules stay current. The frontend and backend share identical validation logic, with the backend as the authoritative source, preventing bypass attacks while delivering sub-100ms validation feedback.

---

## Type Definitions

Create TypeScript interfaces for the form descriptor system.

**Requirements**:
- Given a form descriptor structure, should define GlobalFormDescriptor with blocks, fields, and submission config
- Given a block structure, should define BlockDescriptor with status templates for hidden/disabled states
- Given a field structure, should define FieldDescriptor supporting static items, dynamic dataSource, validation rules, and discriminant flag
- Given validation needs, should define ValidationRule with type, value, and message properties
- Given case creation, should define CasePrefill with incorporationCountry, onboardingCountries, processType, and needSignature properties
- Given API communication, should define CaseContext (from CasePrefill) and RulesObject types

---

## Project Dependencies

Install and configure required dependencies for the form engine.

**Requirements**:
- Given the project needs templating, should install handlebars library
- Given form management needs, should install react-hook-form
- Given validation integration needs, should install @hookform/resolvers for Zod integration
- Given state management needs, should install redux, react-redux, and redux-saga
- Given ID generation needs, should install @paralleldrive/cuid2 for Autodux
- Given UI component needs, should initialize Shadcn UI with npx shadcn@latest init
- Given validation needs, should install zod for runtime descriptor validation

---

## Redux Store Setup

Create Autodux dux definition for global state management (form state managed by react-hook-form).

**Requirements**:
- Given global state needs, should define form-dux.sudo with initialState containing globalDescriptor, mergedDescriptor, caseContext, isRehydrating, and dataSourceCache
- Given action needs, should define actions for loadGlobalDescriptor, syncFormDataToContext, triggerRehydration, applyRulesUpdate, and loadDataSource
- Given selector needs, should define selectors for accessing form state, visible blocks, and visible fields
- Given transpilation needs, should transpile form-dux.sudo to form-dux.js
- Given state architecture, should note that formData and validationErrors are managed by react-hook-form, not Redux

---

## Redux Store Configuration

Create root reducer and configure Redux store with saga middleware.

**Requirements**:
- Given Redux setup needs, should create store.js with root reducer combining form slice
- Given async operations need, should configure redux-saga middleware
- Given store needs, should export configured store for app integration

---

## Form Sagas

Create Redux sagas for async form operations.

**Requirements**:
- Given global descriptor loading, should create saga to fetch GET /api/form/global-descriptor
- Given re-hydration needs, should create saga to POST /api/rules/context with debouncing (triggered by discriminant field changes from react-hook-form)
- Given data source loading, should create saga to fetch dynamic field data with authentication
- Given form submission, should create saga to submit form data from react-hook-form to configured endpoint
- Given state sync needs, should create saga to sync react-hook-form state to Redux for context extraction

---

## Handlebars Helpers

Implement custom Handlebars helpers for form logic evaluation.

**Requirements**:
- Given comparison needs, should register helpers for eq, ne, gt, lt, gte, lte
- Given logic needs, should register helpers for and, or, not
- Given data needs, should register helpers for contains and isEmpty
- Given context access, should enable nested form data access via dot notation

---

## Template Evaluator

Create utility functions for evaluating Handlebars templates with form context.

**Requirements**:
- Given a template string and context, should evaluate Handlebars template returning boolean or string result
- Given a block or field descriptor, should evaluate status.hidden template returning visibility state
- Given a block or field descriptor, should evaluate status.disabled template returning enabled state
- Given a block or field descriptor, should evaluate status.readonly template if present

---

## Context Extractor

Create utility to extract and update CaseContext from CasePrefill and form data.

**Requirements**:
- Given CasePrefill provided at case creation, should initialize CaseContext with incorporationCountry, onboardingCountries, processType, and needSignature
- Given form data and field descriptors, should identify discriminant fields and update CaseContext
- Given context changes, should detect when CaseContext has changed requiring re-hydration

---

## Descriptor Merger

Implement deep merge logic for combining GlobalFormDescriptor with RulesObject.

**Requirements**:
- Given global descriptor and rules object, should deep merge validation rules into field descriptors
- Given rules update, should preserve block and field structure while updating rules
- Given status templates, should merge status conditions from rules into blocks and fields
- Given nested updates, should handle field-level rule updates within blocks

---

## Validation Rule Adapter

Create adapter to convert ValidationRule[] to react-hook-form validation rules and Zod schema.

**Requirements**:
- Given ValidationRule[], should convert to react-hook-form validation rules object
- Given ValidationRule[], should convert to Zod schema for use with @hookform/resolvers
- Given required rule, should map to react-hook-form required validation
- Given minLength/maxLength rules, should map to react-hook-form min/max validation
- Given pattern rule, should map to react-hook-form pattern validation
- Given custom rule, should map to react-hook-form validate function
- Given multiple rules, should combine into single validation function or Zod schema

---

## React Hook Form Integration

Integrate react-hook-form with form descriptor system for validation and state management.

**Requirements**:
- Given form initialization, should create useForm hook with default values from descriptor
- Given field descriptors, should register fields with converted validation rules
- Given dynamic field visibility, should register/unregister fields as they become visible/hidden
- Given validation rules update, should update react-hook-form validation rules via setValue/clearErrors
- Given backend validation errors, should map errors to react-hook-form via setError()
- Given discriminant field changes, should sync form state to Redux for context extraction
- Given validation timing, should leverage react-hook-form's built-in <100ms validation feedback

---

## Global Descriptor API Route

Create Next.js API route for serving global form descriptor.

**Requirements**:
- Given GET /api/form/global-descriptor request, should return GlobalFormDescriptor JSON
- Given request, should handle errors with appropriate HTTP status codes
- Given response, should include proper Content-Type headers

---

## Rules Context API Route

Create Next.js API route for rules re-hydration.

**Requirements**:
- Given POST /api/rules/context with CaseContext, should return RulesObject
- Given request body, should validate CaseContext structure
- Given rules evaluation, should return updated validation rules and status conditions
- Given errors, should return validation errors with field paths

---

## Form Container Component

Create Redux-connected container component that integrates react-hook-form with Redux.

**Requirements**:
- Given Redux store, should connect global state and actions to presentation component
- Given react-hook-form needs, should initialize useForm hook in container
- Given container pattern, should not contain UI markup only connect logic
- Given mapStateToProps, should select visible blocks, visible fields, and global state
- Given mapDispatchToProps, should provide action creators for re-hydration and data loading
- Given form hook, should pass form methods (register, control, handleSubmit, formState) to presentation component
- Given discriminant field changes, should watch form state and sync to Redux for context extraction

---

## Form Presentation Component

Create main form presentation component rendering blocks and fields.

**Requirements**:
- Given merged descriptor, should render blocks in order
- Given block visibility, should conditionally render blocks based on status evaluation
- Given field visibility, should conditionally render fields within visible blocks
- Given form data, should pass current values to field components

---

## Block Component

Create block component with smooth transitions.

**Requirements**:
- Given block descriptor, should render block with title and description
- Given hidden status, should animate block out of view smoothly
- Given visible status, should animate block into view smoothly
- Given disabled status, should disable all fields within block

---

## Field Wrapper Component

Create field wrapper component handling visibility and validation display.

**Requirements**:
- Given field descriptor, should conditionally render field based on status evaluation
- Given validation errors, should display error message below field
- Given field type, should render appropriate field component
- Given disabled status, should disable field input

---

## Text Field Component

Create text input field component using react-hook-form.

**Requirements**:
- Given field descriptor, should render text input with label and description
- Given react-hook-form integration, should use Controller or register() for field registration
- Given value change, should use react-hook-form onChange handler
- Given discriminant flag, should trigger re-hydration on blur via watch() sync to Redux
- Given validation error, should display error from formState.errors

---

## Dropdown Field Component

Create dropdown field component using react-hook-form with static and dynamic data support.

**Requirements**:
- Given static items, should render dropdown immediately with items
- Given dataSource, should fetch data when field becomes visible
- Given loading state, should show loading indicator in dropdown
- Given data loaded, should populate dropdown with transformed items
- Given react-hook-form integration, should use Controller for field registration
- Given value change, should use react-hook-form onChange handler
- Given validation error, should display error from formState.errors

---

## Autocomplete Field Component

Create autocomplete field component using react-hook-form with search functionality.

**Requirements**:
- Given dataSource, should fetch data when field becomes visible
- Given user input, should filter options based on search term
- Given react-hook-form integration, should use Controller for field registration
- Given selection, should use react-hook-form onChange handler
- Given loading state, should show loading indicator
- Given validation error, should display error from formState.errors

---

## Checkbox Field Component

Create checkbox field component using react-hook-form.

**Requirements**:
- Given field descriptor, should render checkbox with label
- Given react-hook-form integration, should use Controller or register() for field registration
- Given value change, should use react-hook-form onChange handler
- Given discriminant flag, should trigger re-hydration on change via watch() sync to Redux
- Given validation error, should display error from formState.errors

---

## Radio Field Component

Create radio button group component using react-hook-form.

**Requirements**:
- Given static items, should render radio buttons for each option
- Given dataSource, should fetch and render dynamic options
- Given react-hook-form integration, should use Controller for field registration
- Given value change, should use react-hook-form onChange handler
- Given discriminant flag, should trigger re-hydration on change via watch() sync to Redux
- Given validation error, should display error from formState.errors

---

## Date Field Component

Create date input field component using react-hook-form.

**Requirements**:
- Given field descriptor, should render date picker with label
- Given react-hook-form integration, should use Controller for field registration
- Given value change, should use react-hook-form onChange handler
- Given validation, should validate date format and range using react-hook-form validation
- Given validation error, should display error from formState.errors

---

## File Field Component

Create file upload field component using react-hook-form.

**Requirements**:
- Given field descriptor, should render file input with label
- Given react-hook-form integration, should use Controller for field registration
- Given file selection, should use react-hook-form onChange handler with file data
- Given validation, should validate file type and size using react-hook-form validation
- Given validation error, should display error from formState.errors

---

## Data Source Loader

Create utility for loading dynamic field data from APIs.

**Requirements**:
- Given dataSource config, should evaluate URL template with form context
- Given authentication config, should inject auth headers into request
- Given API response, should transform response using itemsTemplate
- Given iterator template, should loop through array responses
- Given caching needs, should cache responses to prevent duplicate requests

---

## Response Transformer

Create utility for transforming API responses into dropdown items.

**Requirements**:
- Given API response and itemsTemplate, should transform each item using Handlebars
- Given iterator template, should iterate over array in response
- Given label/value templates, should extract label and value for each item
- Given transformation, should return array of {label, value} objects

---

## Re-hydration Orchestrator

Create utility to orchestrate form re-hydration when discriminant fields change.

**Requirements**:
- Given discriminant field change, should debounce re-hydration call by 500ms
- Given context extraction, should build updated CaseContext from form data
- Given rules API call, should POST to /api/rules/context with CaseContext
- Given rules response, should merge RulesObject into descriptor
- Given merge complete, should re-evaluate all status templates
- Given re-hydration, should show loading indicator without blocking input

---

## Submission Orchestrator

Create utility for form submission using react-hook-form with validation and error handling.

**Requirements**:
- Given react-hook-form handleSubmit, should validate all visible fields first
- Given validation fails, should scroll to first error and prevent submission
- Given payload template, should evaluate template with react-hook-form form values
- Given submission config, should construct request with URL, method, headers, and auth
- Given backend errors, should map errors to react-hook-form field paths via setError()
- Given success, should display success message

---

## Submit Button Component

Create submit button component with loading and disabled states.

**Requirements**:
- Given form state, should disable button during re-hydration
- Given validation errors, should show error count
- Given submission in progress, should show loading state
- Given click, should trigger submission orchestration

---

## Integration and Wiring

Wire up all components in main page and add loading states.

**Requirements**:
- Given app page, should render FormContainer component
- Given re-hydration state, should display global loading indicator
- Given error boundaries, should catch and display form errors gracefully
- Given scroll needs, should implement scroll-to-first-error functionality

---

## Polish and UX Enhancements

Add smooth animations, toast notifications, and accessibility improvements.

**Requirements**:
- Given block transitions, should animate with smooth fade/slide effects
- Given toast needs, should integrate Shadcn toast for success/error messages
- Given accessibility, should add ARIA labels and keyboard navigation support
- Given responsive design, should ensure form works on mobile devices
