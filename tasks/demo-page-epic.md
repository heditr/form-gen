# Demo Page Epic

**Status**: 📋 PLANNED  
**Goal**: Create a comprehensive demo page that showcases and tests all implemented form engine features before proceeding to next tasks.

## Overview

Developers and stakeholders need a visual testing environment to validate all form engine components, field types, and features work correctly together. This demo page provides a complete form with sample data that exercises every implemented feature including all field types, template evaluation, validation, re-hydration, and data source loading, ensuring the system is ready for production use.

---

## Demo Page Component

Create a demo page that renders the form engine with comprehensive test data.

**Requirements**:
- Given the demo page loads, should render FormContainer wrapped in Redux Provider
- Given the demo page, should display a header with title and description
- Given the demo page, should show form state information (re-hydration status, field count, etc.)
- Given the demo page, should include a reset button to clear form data
- Given the demo page, should display form submission results

---

## Sample Form Descriptor

Create a comprehensive sample GlobalFormDescriptor that exercises all field types and features.

**Requirements**:
- Given the sample descriptor, should include blocks with all field types (text, dropdown, autocomplete, checkbox, radio, date, file)
- Given the sample descriptor, should include fields with static items for dropdown and radio
- Given the sample descriptor, should include fields with dataSource for dynamic loading
- Given the sample descriptor, should include discriminant fields that trigger re-hydration
- Given the sample descriptor, should include validation rules (required, minLength, maxLength, pattern)
- Given the sample descriptor, should include status templates (hidden, disabled) using Handlebars
- Given the sample descriptor, should include nested field visibility conditions

---

## Enhanced Global Descriptor API

Update the global descriptor API route to return the comprehensive sample descriptor.

**Requirements**:
- Given GET /api/form/global-descriptor request, should return the comprehensive sample descriptor
- Given the response, should include all field types with realistic configurations
- Given the response, should include template conditions that can be tested interactively

---

## Enhanced Rules Context API

Update the rules context API route to return realistic rules based on context.

**Requirements**:
- Given POST /api/rules/context with CaseContext, should return RulesObject with updated validation rules
- Given specific context values, should return different rules to demonstrate re-hydration
- Given the response, should include status condition updates for blocks and fields
- Given the response, should demonstrate how rules change based on jurisdiction or entity type

---

## Redux Provider Setup

Wrap the demo page with Redux Provider to enable state management.

**Requirements**:
- Given the app layout, should provide Redux store to all components
- Given the store setup, should initialize with proper middleware configuration
- Given the store, should dispatch loadGlobalDescriptor action on page load

---

## Form State Display

Add a debug panel showing current form state and Redux state.

**Requirements**:
- Given the demo page, should display current form values from react-hook-form
- Given the demo page, should display Redux state (caseContext, isRehydrating, dataSourceCache)
- Given the demo page, should display validation errors in real-time
- Given the demo page, should show which blocks and fields are visible/hidden
- Given the demo page, should allow toggling debug panel visibility

---

## Form Submission Handler

Implement form submission handler that displays results.

**Requirements**:
- Given form submission, should validate all fields using react-hook-form
- Given validation passes, should display submission payload in results panel
- Given validation fails, should highlight errors and prevent submission
- Given submission, should show loading state during submission
- Given submission success, should display success message with submitted data
