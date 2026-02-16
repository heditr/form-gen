# Repeatable Fields Epic

**Status**: 📋 PLANNED  
**Goal**: Enable repeatable field groups that allow users to dynamically add and remove instances of related fields (e.g., multiple addresses with street, city, zip fields).

## Overview

Forms often need to collect variable-length collections of related data (addresses, contacts, beneficiaries, etc.). Currently, the form engine only supports fixed field structures. Repeatable field groups solve this by allowing form authors to define a group of related fields that can be repeated multiple times, with users able to add or remove instances dynamically. This maintains validation, state preservation during re-hydration, template evaluation, and integrates seamlessly with the existing form engine architecture.

Additionally, to avoid duplicating block definitions, form authors can reference an existing non-repeatable block and declare it as repeatable. This allows defining a block once (e.g., "Address Block") and reusing it in a repeatable context (e.g., "Addresses Block") without duplicating field definitions.

---

## Implementation Tasks Summary

1. **Type System Foundation** (2 tasks)
   - Add repeatable properties to type definitions
   - Update FormData type for repeatable groups

2. **Schema Building** (3 tasks)
   - Detect repeatable blocks in schema builder
   - Build array schemas for repeatable groups
   - Add array-level validation (minInstances/maxInstances)

3. **Default Values and Initialization** (2 tasks)
   - Extract default values for repeatable groups
   - Evaluate templates in repeatable group defaults

4. **UI Component** (5 tasks)
   - Create RepeatableFieldGroup component structure
   - Render field instances with indexed names
   - Add/remove instance functionality
   - Visual styling and empty state
   - Accessibility for add/remove actions

5. **Block Reference Resolution** (2 tasks)
   - Resolve repeatable block references
   - Merge referenced block fields into repeatable block

6. **Block Rendering Integration** (3 tasks)
   - Detect repeatable blocks in Block component
   - Render RepeatableFieldGroup for repeatable blocks
   - Handle mixed blocks (repeatable + non-repeatable)

7. **Template Evaluation** (3 tasks)
   - Include repeatable groups in form context
   - Evaluate status templates for repeatable blocks
   - Evaluate field status templates within instances

8. **Validation Error Display** (2 tasks)
   - Display field-level errors in instances
   - Display array-level validation errors

9. **State Management and Redux Sync** (2 tasks)
   - Sync repeatable groups to Redux
   - Preserve repeatable group data on remount

10. **Testing** (5 tasks)
   - Unit tests for type definitions
   - Unit tests for schema building
   - Component tests for RepeatableFieldGroup
   - Integration tests
   - Block reference resolution tests

**Total: 29 tasks across 10 phases**

---

## Task Breakdown

### Phase 1: Type System Foundation

**Task 1.1: Add Repeatable Properties to Type Definitions**
- Add `repeatable?: boolean` to `BlockDescriptor` interface
- Add `minInstances?: number` and `maxInstances?: number` to `BlockDescriptor` interface
- Add `repeatableGroupId?: string` to `FieldDescriptor` interface
- Add `repeatableBlockRef?: string` to `BlockDescriptor` interface (for referencing another block)
- Update JSDoc comments for new properties
- File: `src/types/form-descriptor.ts`

**Task 1.2: Update FormData Type for Repeatable Groups**
- Extend `FormData` type to support arrays of objects for repeatable groups
- Ensure type inference works correctly with repeatable field IDs
- File: `src/types/form-descriptor.ts`

### Phase 2: Schema Building

**Task 2.1: Detect Repeatable Blocks in Schema Builder**
- Add utility function to detect if a block is repeatable
- Add utility function to group fields by `repeatableGroupId`
- File: `src/utils/form-descriptor-integration.ts`

**Task 2.2: Build Array Schemas for Repeatable Groups**
- Update `buildZodSchemaFromDescriptor` to detect repeatable blocks
- Build `z.array(z.object({...}))` schemas for repeatable groups
- Apply field-level validation rules within array objects
- File: `src/utils/form-descriptor-integration.ts`

**Task 2.3: Add Array-Level Validation (minInstances/maxInstances)**
- Apply `minInstances` as `z.array(...).min(minInstances)`
- Apply `maxInstances` as `z.array(...).max(maxInstances)`
- Handle required repeatable groups (minInstances >= 1)
- File: `src/utils/form-descriptor-integration.ts`

### Phase 3: Default Values and Initialization

**Task 3.1: Extract Default Values for Repeatable Groups**
- Update `extractDefaultValues` to handle repeatable groups
- Support default values as arrays of objects
- Initialize as empty array `[]` if no defaults provided
- File: `src/utils/form-descriptor-integration.ts`

**Task 3.2: Evaluate Templates in Repeatable Group Defaults**
- Ensure `evaluateDefaultValue` handles array default values
- Evaluate Handlebars templates for each instance in default array
- File: `src/utils/default-value-evaluator.ts`

### Phase 4: UI Component

**Task 4.1: Create RepeatableFieldGroup Component Structure**
- Create component file `src/components/repeatable-field-group.tsx`
- Set up component props interface
- Integrate `useFieldArray` from react-hook-form
- File: `src/components/repeatable-field-group.tsx`

**Task 4.2: Render Field Instances with Indexed Names**
- Map over field array instances using `useFieldArray`
- Render each instance with all fields in the group
- Use indexed field names (e.g., `addresses.0.street`, `addresses.1.street`)
- Use `Controller` from react-hook-form for each field
- File: `src/components/repeatable-field-group.tsx`

**Task 4.3: Add/Remove Instance Functionality**
- Add "Add" button to create new instances
- Add "Remove" button for each instance (respect `minInstances`)
- Initialize new instances with default values from field descriptors
- File: `src/components/repeatable-field-group.tsx`

**Task 4.4: Visual Styling and Empty State**
- Style each instance as a card/grouped section
- Add empty state message when no instances exist
- Ensure clear visual separation between instances
- File: `src/components/repeatable-field-group.tsx`

**Task 4.5: Accessibility for Add/Remove Actions**
- Add proper ARIA labels for add/remove buttons
- Ensure keyboard navigation works correctly
- Associate error messages with fields via ARIA attributes
- File: `src/components/repeatable-field-group.tsx`

### Phase 5: Block Reference Resolution

**Task 5.1: Resolve Repeatable Block References**
- Create utility function `resolveRepeatableBlockRef` to resolve `repeatableBlockRef` references
- Find referenced block in descriptor by ID
- Validate that referenced block exists
- Validate that referenced block is not itself repeatable (to prevent confusion)
- Handle circular references (block references itself or creates cycles)
- Return resolved block with fields ready for repeatable group
- File: `src/utils/repeatable-block-resolver.ts`

**Task 5.2: Merge Referenced Block Fields into Repeatable Block**
- When `repeatableBlockRef` is present, use referenced block's fields as the repeatable group
- Derive `repeatableGroupId` from repeatable block's ID (e.g., `addresses-block` → `addresses`)
- Assign `repeatableGroupId` to all fields from referenced block
- Preserve all field properties (validation, dataSource, defaultValue, etc.) from referenced block
- Ensure field IDs remain unique (no prefixing needed since they're in a different context)
- File: `src/utils/repeatable-block-resolver.ts`

### Phase 6: Block Rendering Integration

**Task 6.1: Detect Repeatable Blocks in Block Component**
- Update `Block` component to detect `block.repeatable === true`
- If `repeatableBlockRef` is present, call resolver to get referenced block's fields
- If `repeatableBlockRef` is not present, use block's own fields
- Group fields by `repeatableGroupId` when block is repeatable
- File: `src/components/block.tsx`

**Task 6.2: Render RepeatableFieldGroup for Repeatable Blocks**
- Conditionally render `RepeatableFieldGroup` for repeatable blocks
- Continue rendering regular fields for non-repeatable blocks
- Handle multiple repeatable groups in one block
- File: `src/components/block.tsx`

**Task 6.3: Handle Mixed Blocks (Repeatable + Non-Repeatable)**
- Detect blocks with both repeatable and non-repeatable fields
- Render repeatable groups separately from regular fields
- Maintain proper field ordering
- File: `src/components/block.tsx`

### Phase 7: Template Evaluation

**Task 6.1: Include Repeatable Groups in Form Context**
- Ensure repeatable group arrays are included in `formContext`
- Support `{{#each}}` helpers for iterating repeatable groups
- File: `src/utils/template-evaluator.ts` and `src/components/form-container.tsx`

**Task 6.2: Evaluate Status Templates for Repeatable Blocks**
- Evaluate `hidden` and `disabled` templates for repeatable blocks
- Use array data in context for template evaluation
- File: `src/components/block.tsx` and `src/components/repeatable-field-group.tsx`

**Task 6.3: Evaluate Field Status Templates Within Instances**
- Support instance-specific context (e.g., `@index`, current instance values)
- Evaluate field-level status templates within repeatable groups
- File: `src/components/repeatable-field-group.tsx`

### Phase 8: Validation Error Display

**Task 7.1: Display Field-Level Errors in Instances**
- Extract nested errors from react-hook-form (e.g., `errors.addresses?.[0]?.street`)
- Display validation errors for individual fields within instances
- Position errors near relevant fields
- File: `src/components/repeatable-field-group.tsx`

**Task 7.2: Display Array-Level Validation Errors**
- Display errors for entire repeatable group (e.g., "At least one address is required")
- Show errors when `minInstances` not met
- Show errors when `maxInstances` exceeded
- File: `src/components/repeatable-field-group.tsx`

### Phase 9: State Management and Redux Sync

**Task 8.1: Sync Repeatable Groups to Redux**
- Ensure repeatable group arrays sync to Redux when modified
- Handle add/remove operations in Redux sync
- File: `src/hooks/use-form-descriptor.ts`

**Task 8.2: Preserve Repeatable Group Data on Remount**
- Ensure repeatable group arrays are preserved during form remount
- Restore repeatable group data from `savedFormData` in Redux
- File: `src/hooks/use-form-descriptor.ts`

### Phase 10: Testing

**Task 9.1: Unit Tests for Type Definitions**
- Test type definitions compile correctly
- Test FormData type inference with repeatable groups
- File: `src/types/form-descriptor.test.ts` (if exists) or create new test file

**Task 9.2: Unit Tests for Schema Building**
- Test Zod schema building for repeatable blocks
- Test array-level validation (minInstances/maxInstances)
- Test field-level validation within arrays
- File: `src/utils/form-descriptor-integration.test.ts`

**Task 9.3: Component Tests for RepeatableFieldGroup**
- Test rendering of repeatable field groups
- Test add/remove instance functionality
- Test validation error display
- Test empty state
- File: `src/components/repeatable-field-group.test.tsx`

**Task 9.4: Integration Tests**
- Test repeatable groups in full form flow
- Test state preservation during re-hydration
- Test template evaluation with repeatable groups
- Test form submission with repeatable groups
- Test block reference resolution and rendering
- Test circular reference detection
- File: `src/components/form-container.test.tsx` or new integration test file

**Task 9.5: Block Reference Resolution Tests**
- Test resolving `repeatableBlockRef` to referenced block
- Test error handling for missing referenced blocks
- Test circular reference detection
- Test field merging from referenced blocks
- File: `src/utils/repeatable-block-resolver.test.ts`

---

## Usage Examples

### Example 1: Basic Repeatable Address Block

A simple repeatable block for collecting multiple addresses:

```typescript
{
  id: "addresses-block",
  title: "Addresses",
  description: "Add one or more addresses",
  repeatable: true,
  fields: [
    {
      id: "street",
      type: "text",
      label: "Street Address",
      repeatableGroupId: "addresses",
      validation: [
        { type: "required", message: "Street address is required" }
      ]
    },
    {
      id: "city",
      type: "text",
      label: "City",
      repeatableGroupId: "addresses",
      validation: [
        { type: "required", message: "City is required" }
      ]
    },
    {
      id: "zipCode",
      type: "text",
      label: "ZIP Code",
      repeatableGroupId: "addresses",
      validation: [
        { type: "required", message: "ZIP code is required" },
        { type: "pattern", value: /^\d{5}(-\d{4})?$/, message: "Invalid ZIP code format" }
      ]
    }
  ]
}
```

**Form Data Structure:**
```typescript
{
  addresses: [
    { street: "123 Main St", city: "New York", zipCode: "10001" },
    { street: "456 Oak Ave", city: "Boston", zipCode: "02101" }
  ]
}
```

### Example 2: Repeatable Block with Instance Limits

A repeatable block with minimum and maximum instance constraints:

```typescript
{
  id: "beneficiaries-block",
  title: "Beneficiaries",
  description: "Add at least one beneficiary (maximum 5)",
  repeatable: true,
  minInstances: 1,
  maxInstances: 5,
  fields: [
    {
      id: "name",
      type: "text",
      label: "Full Name",
      repeatableGroupId: "beneficiaries",
      validation: [
        { type: "required", message: "Name is required" },
        { type: "minLength", value: 2, message: "Name must be at least 2 characters" }
      ]
    },
    {
      id: "relationship",
      type: "dropdown",
      label: "Relationship",
      repeatableGroupId: "beneficiaries",
      items: [
        { label: "Spouse", value: "spouse" },
        { label: "Child", value: "child" },
        { label: "Other", value: "other" }
      ],
      validation: [
        { type: "required", message: "Relationship is required" }
      ]
    },
    {
      id: "percentage",
      type: "number",
      label: "Percentage",
      repeatableGroupId: "beneficiaries",
      validation: [
        { type: "required", message: "Percentage is required" },
        { type: "custom", value: (val) => val >= 0 && val <= 100, message: "Percentage must be between 0 and 100" }
      ]
    }
  ]
}
```

### Example 3: Multiple Repeatable Groups in One Block

A block containing multiple distinct repeatable groups:

```typescript
{
  id: "contacts-block",
  title: "Contact Information",
  repeatable: true,
  fields: [
    // First repeatable group: Email addresses
    {
      id: "email",
      type: "text",
      label: "Email Address",
      repeatableGroupId: "emails",
      validation: [
        { type: "required", message: "Email is required" },
        { type: "pattern", value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Invalid email format" }
      ]
    },
    // Second repeatable group: Phone numbers
    {
      id: "phoneNumber",
      type: "text",
      label: "Phone Number",
      repeatableGroupId: "phones",
      validation: [
        { type: "required", message: "Phone number is required" },
        { type: "pattern", value: /^\d{10}$/, message: "Phone must be 10 digits" }
      ]
    },
    {
      id: "phoneType",
      type: "dropdown",
      label: "Phone Type",
      repeatableGroupId: "phones",
      items: [
        { label: "Mobile", value: "mobile" },
        { label: "Home", value: "home" },
        { label: "Work", value: "work" }
      ],
      validation: [
        { type: "required", message: "Phone type is required" }
      ]
    }
  ]
}
```

**Form Data Structure:**
```typescript
{
  emails: [
    { email: "primary@example.com" },
    { email: "secondary@example.com" }
  ],
  phones: [
    { phoneNumber: "5551234567", phoneType: "mobile" },
    { phoneNumber: "5559876543", phoneType: "work" }
  ]
}
```

### Example 4: Mixed Repeatable and Non-Repeatable Fields

A block with both repeatable groups and regular fields:

```typescript
{
  id: "company-info-block",
  title: "Company Information",
  fields: [
    // Regular (non-repeatable) fields
    {
      id: "companyName",
      type: "text",
      label: "Company Name",
      validation: [
        { type: "required", message: "Company name is required" }
      ]
    },
    {
      id: "taxId",
      type: "text",
      label: "Tax ID",
      validation: [
        { type: "required", message: "Tax ID is required" }
      ]
    },
    // Repeatable group: Office locations
    {
      id: "officeName",
      type: "text",
      label: "Office Name",
      repeatableGroupId: "offices",
      validation: [
        { type: "required", message: "Office name is required" }
      ]
    },
    {
      id: "officeAddress",
      type: "text",
      label: "Office Address",
      repeatableGroupId: "offices",
      validation: [
        { type: "required", message: "Office address is required" }
      ]
    }
  ]
}
```

### Example 5: Repeatable Groups with Default Values

A repeatable block with default values (including template evaluation):

```typescript
{
  id: "addresses-block",
  title: "Addresses",
  repeatable: true,
  fields: [
    {
      id: "street",
      type: "text",
      label: "Street Address",
      repeatableGroupId: "addresses",
      defaultValue: "",
      validation: [
        { type: "required", message: "Street address is required" }
      ]
    },
    {
      id: "country",
      type: "dropdown",
      label: "Country",
      repeatableGroupId: "addresses",
      defaultValue: "{{caseContext.incorporationCountry}}",
      dataSource: {
        url: "/api/countries",
        itemsTemplate: "{{#each countries}}{{label: name, value: code}}{{/each}}"
      },
      validation: [
        { type: "required", message: "Country is required" }
      ]
    }
  ]
}
```

**Default Values in Form Initialization:**
```typescript
// If defaultValue is provided as an array, use it; otherwise start with empty array
defaultValues: {
  addresses: [
    { street: "", country: "US" } // First instance with defaults
  ]
}
```

### Example 6: Repeatable Groups with Conditional Visibility

A repeatable block with fields that conditionally show/hide based on other fields:

```typescript
{
  id: "dependents-block",
  title: "Dependents",
  repeatable: true,
  minInstances: 0,
  fields: [
    {
      id: "dependentName",
      type: "text",
      label: "Dependent Name",
      repeatableGroupId: "dependents",
      validation: [
        { type: "required", message: "Dependent name is required" }
      ]
    },
    {
      id: "dependentAge",
      type: "number",
      label: "Age",
      repeatableGroupId: "dependents",
      validation: [
        { type: "required", message: "Age is required" },
        { type: "custom", value: (val) => val >= 0 && val <= 120, message: "Age must be between 0 and 120" }
      ]
    },
    {
      id: "isStudent",
      type: "checkbox",
      label: "Is Student",
      repeatableGroupId: "dependents",
      defaultValue: false
    },
    {
      id: "schoolName",
      type: "text",
      label: "School Name",
      repeatableGroupId: "dependents",
      status: {
        hidden: "{{#unless isStudent}}true{{/unless}}"
      },
      validation: [
        { 
          type: "custom", 
          value: (val, formValues) => {
            const index = formValues.dependents.findIndex((d: any) => d.schoolName === val);
            const dependent = formValues.dependents[index];
            return !dependent?.isStudent || (val && val.length > 0);
          },
          message: "School name is required for students"
        }
      ]
    }
  ]
}
```

### Example 7: Repeatable Block Reference (Avoid Duplication)

Reference an existing non-repeatable block and make it repeatable without duplicating field definitions:

```typescript
{
  blocks: [
    // Define the block once (non-repeatable)
    {
      id: "address-block",
      title: "Address",
      fields: [
        {
          id: "street",
          type: "text",
          label: "Street Address",
          validation: [{ type: "required", message: "Street address is required" }]
        },
        {
          id: "city",
          type: "text",
          label: "City",
          validation: [{ type: "required", message: "City is required" }]
        },
        {
          id: "zipCode",
          type: "text",
          label: "ZIP Code",
          validation: [
            { type: "required", message: "ZIP code is required" },
            { type: "pattern", value: /^\d{5}(-\d{4})?$/, message: "Invalid ZIP code format" }
          ]
        }
      ]
    },
    // Reference the block and make it repeatable
    {
      id: "addresses-block",
      title: "Addresses",
      description: "Add one or more addresses",
      repeatable: true,
      repeatableBlockRef: "address-block", // Reference the block defined above
      minInstances: 1,
      maxInstances: 10
      // No fields needed - they come from the referenced block
    }
  ]
}
```

**Benefits:**
- Single source of truth: Define address fields once
- No duplication: Reuse the same block definition
- Easy maintenance: Update address fields in one place
- Flexible: The referenced block can still be used as a regular (non-repeatable) block elsewhere

**Form Data Structure:**
```typescript
{
  addresses: [
    { street: "123 Main St", city: "New York", zipCode: "10001" },
    { street: "456 Oak Ave", city: "Boston", zipCode: "02101" }
  ]
}
```

**Note:** When using `repeatableBlockRef`, the referenced block's fields are automatically assigned to a repeatable group. The `repeatableGroupId` is derived from the repeatable block's `id` (e.g., `addresses-block` → `addresses`).

### Example 8: Complete Form Descriptor with Repeatable Fields

A complete form descriptor showing integration with other form features:

```typescript
const formDescriptor: GlobalFormDescriptor = {
  id: "kyc-form-v1",
  title: "KYC Onboarding Form",
  version: "1.0.0",
  blocks: [
    {
      id: "basic-info",
      title: "Basic Information",
      fields: [
        {
          id: "entityName",
          type: "text",
          label: "Entity Name",
          validation: [{ type: "required", message: "Entity name is required" }]
        }
      ]
    },
    {
      id: "addresses-block",
      title: "Business Addresses",
      description: "Add all business addresses",
      repeatable: true,
      minInstances: 1,
      maxInstances: 10,
      fields: [
        {
          id: "addressType",
          type: "dropdown",
          label: "Address Type",
          repeatableGroupId: "addresses",
          items: [
            { label: "Registered Office", value: "registered" },
            { label: "Business Address", value: "business" },
            { label: "Mailing Address", value: "mailing" }
          ],
          validation: [{ type: "required", message: "Address type is required" }]
        },
        {
          id: "street",
          type: "text",
          label: "Street Address",
          repeatableGroupId: "addresses",
          validation: [{ type: "required", message: "Street address is required" }]
        },
        {
          id: "city",
          type: "text",
          label: "City",
          repeatableGroupId: "addresses",
          validation: [{ type: "required", message: "City is required" }]
        },
        {
          id: "country",
          type: "dropdown",
          label: "Country",
          repeatableGroupId: "addresses",
          isDiscriminant: true,
          dataSource: {
            url: "/api/countries",
            itemsTemplate: "{{#each countries}}{{label: name, value: code}}{{/each}}"
          },
          validation: [{ type: "required", message: "Country is required" }]
        }
      ]
    },
    {
      id: "submission-block",
      title: "Submit",
      fields: [
        {
          id: "submit",
          type: "button",
          label: "Submit Form",
          button: {
            variant: "single"
          }
        }
      ]
    }
  ],
  submission: {
    url: "/api/submit-kyc",
    method: "POST"
  }
};
```

---

## Repeatable Field Group Type Definitions

Add type definitions for repeatable field groups in the form descriptor system.

**Requirements**:
- Given repeatable field needs, should add `repeatable` boolean property to `BlockDescriptor` to mark blocks containing repeatable fields
- Given field group needs, should add `repeatableGroupId` optional property to `FieldDescriptor` to associate fields with a repeatable group
- Given block reference needs, should add `repeatableBlockRef` optional property to `BlockDescriptor` to reference another block for reuse
- Given data structure needs, should update `FormData` type to support arrays of objects for repeatable groups (e.g., `addresses: [{ street: "...", city: "..." }, ...]`)
- Given validation needs, should ensure repeatable groups support all existing validation rules (required, minLength, maxLength, pattern, custom)
- Given instance limits needs, should add optional `minInstances` and `maxInstances` properties to `BlockDescriptor` for repeatable blocks

---

## Repeatable Field Group Component

Create a React component that renders repeatable field groups with add/remove functionality using react-hook-form's `useFieldArray`.

**Requirements**:
- Given a repeatable block, should render all fields in the block as a repeatable group using `useFieldArray` from react-hook-form
- Given field instances, should render each instance with all fields in the group, using indexed field names (e.g., `addresses.0.street`, `addresses.1.street`)
- Given add button, should allow users to add new instances with default values from field descriptors
- Given remove button, should allow users to remove instances (respecting `minInstances` if specified)
- Given empty state, should show appropriate message when no instances exist and allow adding first instance
- Given visual grouping, should visually group each instance (e.g., card/border) with clear separation between instances
- Given accessibility, should ensure proper ARIA labels and keyboard navigation for add/remove actions
- Given form integration, should use `Controller` from react-hook-form for each field within instances to maintain validation

---

## Zod Schema Updates for Repeatable Groups

Extend Zod schema building to support validation for repeatable field groups as arrays of objects.

**Requirements**:
- Given repeatable blocks, should build Zod schema with array of objects structure (e.g., `z.array(z.object({ street: z.string(), city: z.string() }))`)
- Given field validation, should apply validation rules from field descriptors to each field within the array objects
- Given array-level validation, should support `minInstances` as `z.array(...).min(minInstances)` and `maxInstances` as `z.array(...).max(maxInstances)`
- Given required groups, should support marking entire repeatable groups as required (at least one instance must exist)
- Given nested validation, should ensure validation errors are properly nested (e.g., `errors.addresses?.[0]?.street`)
- Given schema building, should update `buildZodSchemaFromDescriptor` in `form-descriptor-integration.ts` to detect repeatable blocks and build array schemas

---

## Form Data Structure and State Management

Update form data handling to support repeatable groups as arrays, ensuring proper sync with Redux and state preservation.

**Requirements**:
- Given form initialization, should initialize repeatable groups as empty arrays `[]` or with default instances from `defaultValue` if provided
- Given Redux sync, should sync repeatable group arrays to Redux state when instances are added/removed/modified
- Given state preservation, should preserve repeatable group data when form remounts (e.g., during re-hydration)
- Given default values, should support default values for repeatable groups as arrays of objects (e.g., `defaultValue: [{ street: "...", city: "..." }]`)
- Given template evaluation, should evaluate Handlebars templates in default values for repeatable groups using form context
- Given form data extraction, should extract repeatable group data correctly for form submission and context extraction

---

## Block Reference Resolution

Resolve repeatable block references to avoid duplicating block definitions.

**Requirements**:
- Given `repeatableBlockRef` property, should find referenced block in descriptor by ID
- Given referenced block, should validate that referenced block exists and is not itself repeatable
- Given circular references, should detect and prevent blocks that reference themselves or create cycles
- Given field merging, should merge referenced block's fields into repeatable block with proper ID prefixing
- Given field IDs, should prefix field IDs from referenced block with repeatable group ID to avoid conflicts

## Block Rendering Updates

Update block rendering logic to detect repeatable blocks and delegate to RepeatableFieldGroup component instead of standard field rendering.

**Requirements**:
- Given repeatable blocks, should detect `block.repeatable === true` and render `RepeatableFieldGroup` component instead of standard field mapping
- Given `repeatableBlockRef`, should resolve referenced block before rendering repeatable group
- Given non-repeatable blocks, should continue rendering fields normally using existing `FieldWrapper` components
- Given field grouping, should group fields by `repeatableGroupId` when rendering repeatable blocks (all fields with same `repeatableGroupId` belong to same group)
- Given block references, should automatically assign `repeatableGroupId` to referenced block fields based on repeatable block's ID
- Given multiple groups, should support multiple repeatable groups within a single block (different `repeatableGroupId` values)
- Given mixed blocks, should support blocks with both repeatable and non-repeatable fields (render repeatable groups separately from regular fields)

---

## Template Evaluation for Repeatable Groups

Ensure Handlebars template evaluation works correctly with repeatable group data structures.

**Requirements**:
- Given template context, should include repeatable group arrays in form context for template evaluation (e.g., `{{#each addresses}}{{street}}{{/each}}`)
- Given status templates, should evaluate `hidden` and `disabled` templates for repeatable blocks using array data in context
- Given field status templates, should evaluate field-level status templates within repeatable groups using instance-specific context (e.g., `{{#if @index === 0}}...{{/if}}`)
- Given default values, should evaluate Handlebars templates in default values for repeatable groups before initializing form
- Given context updates, should re-evaluate templates when repeatable group data changes

---

## Validation Error Display

Ensure validation errors display correctly for fields within repeatable groups.

**Requirements**:
- Given field errors, should display validation errors for individual fields within repeatable instances
- Given array-level errors, should display errors for the entire repeatable group (e.g., "At least one address is required")
- Given error positioning, should position error messages near the relevant field or instance
- Given error styling, should use consistent error styling with existing field error display
- Given accessibility, should ensure error messages are properly associated with fields via ARIA attributes

---

## Integration Testing

Add comprehensive tests for repeatable field groups covering rendering, validation, state management, and user interactions.

**Requirements**:
- Given repeatable blocks, should test rendering of repeatable field groups with add/remove buttons
- Given user interactions, should test adding instances, removing instances, and modifying field values within instances
- Given validation, should test validation rules apply correctly to fields within repeatable groups
- Given state preservation, should test repeatable group data persists during form remount (re-hydration)
- Given template evaluation, should test Handlebars templates work with repeatable group data
- Given edge cases, should test empty groups, min/max instance limits, and required group validation
