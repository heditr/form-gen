# Popin Block Component - Standalone Design Example

## Overview

Popin blocks are **standalone** blocks that never render inline. They can only be opened via button field triggers. All popins share the same behavior: they open in a dialog modal, share the same form instance, and can be closed via standard dialog actions. This design simplifies the system by having a single, consistent popin behavior.

## Descriptor Structure

A block becomes a popin by adding `popin: true` to the `BlockDescriptor`. Popin blocks are skipped during normal form rendering and can only be accessed via button field triggers that reference them by ID.

### Example: Normal Block vs Popin Block

```typescript
// Normal block - renders inline
{
  id: 'basic-info',
  title: 'Basic Information',
  fields: [
    { id: 'firstName', type: 'text', label: 'First Name', validation: [...] },
    { id: 'lastName', type: 'text', label: 'Last Name', validation: [...] },
  ]
}

// Popin block - standalone, never renders inline
{
  id: 'contact-info',
  title: 'Contact Information',
  popin: true,  // Mark as standalone popin
  fields: [
    { id: 'email', type: 'text', label: 'Email', validation: [...] },
    { id: 'phone', type: 'text', label: 'Phone', validation: [...] },
  ]
}
```

**Rendered Behavior**:
- Normal block: Renders inline with its fields
- Popin block: Does NOT render inline (skipped during normal rendering)
- Popin block: Can only be opened via button field that references it by ID

## Complete Form Example

```typescript
const formDescriptor: GlobalFormDescriptor = {
  id: 'kyc-form',
  title: 'KYC Application',
  blocks: [
    {
      id: 'entity-info',
      title: 'Entity Information',
      fields: [
        { id: 'entityName', type: 'text', label: 'Entity Name', validation: [...] },
        { id: 'entityType', type: 'dropdown', label: 'Entity Type', validation: [...] },
        {
          id: 'addInfoButton',
          type: 'button',
          label: 'Add Information',
          button: {
            variant: 'menu',
            items: [
              { label: 'Add Contact Details', popinBlockId: 'contact-info' },
              { label: 'Add Beneficial Owner', popinBlockId: 'beneficial-owner-info' },
              { label: 'Upload Documents', popinBlockId: 'additional-docs' }
            ]
          }
        }
      ]
    },
    {
      id: 'address-info',
      title: 'Address',
      fields: [
        { id: 'street', type: 'text', label: 'Street', validation: [...] },
        { id: 'city', type: 'text', label: 'City', validation: [...] },
      ]
    },
    // Popin blocks - standalone, never render inline
    {
      id: 'contact-info',
      title: 'Contact Information',
      popin: true,  // Standalone popin
      fields: [
        { id: 'email', type: 'text', label: 'Email', validation: [...] },
        { id: 'phone', type: 'text', label: 'Phone', validation: [...] },
      ]
    },
    {
      id: 'beneficial-owner-info',
      title: 'Beneficial Owner',
      popin: true,  // Standalone popin
      fields: [
        { id: 'ownerName', type: 'text', label: 'Owner Name', validation: [...] },
        { id: 'ownershipPercent', type: 'number', label: 'Ownership %', validation: [...] },
      ]
    },
    {
      id: 'additional-docs',
      title: 'Additional Documents',
      popin: true,  // Standalone popin
      status: {
        hidden: '{{#unless (eq processType "expedited")}}true{{else}}false{{/if}}',
      },
      fields: [
        { id: 'doc1', type: 'file', label: 'Document 1', validation: [...] },
        { id: 'doc2', type: 'file', label: 'Document 2', validation: [...] },
      ]
    }
  ],
  submission: { url: '/api/submit', method: 'POST' }
}
```

**Rendered Form Flow**:
```
┌─────────────────────────────────────────┐
│ KYC Application                         │
├─────────────────────────────────────────┤
│ Entity Information                      │
│ ┌─────────────────────────────────────┐ │
│ │ Entity Name: [________________]     │ │
│ │ Entity Type: [Dropdown ▼]          │ │
│ │                                       │ │
│ │ [Add Information ▼] ← Button field   │ │
│ │   ├─ Add Contact Details            │ │
│ │   ├─ Add Beneficial Owner           │ │
│ │   └─ Upload Documents               │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Address                                 │
│ ┌─────────────────────────────────────┐ │
│ │ Street: [________________]          │ │
│ │ City:   [________________]          │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘

Note: Popin blocks (contact-info, beneficial-owner-info, additional-docs) 
do NOT render inline - they only appear when triggered by button fields.
```

## Conditional Popin Behavior

Popin blocks respect their `status` templates when being opened:

### Example: Conditional Popin Block

```typescript
{
  id: 'beneficial-owners',
  title: 'Beneficial Owners',
  popin: true,  // Standalone popin
  status: {
    hidden: '{{#unless (eq entityType "corporation")}}true{{else}}false{{/if}}',
    disabled: '{{#if readonly}}true{{else}}false{{/if}}',
  },
  fields: [
    { id: 'ownerName', type: 'text', label: 'Owner Name', validation: [...] },
    { id: 'ownershipPercent', type: 'number', label: 'Ownership %', validation: [...] },
  ]
}
```

**Behavior**:
- If `entityType !== "corporation"`: Block is hidden, popin cannot be opened (button trigger would be disabled/hidden)
- If `readonly === true`: Block is disabled, popin can open but fields are disabled
- Otherwise: Popin can be opened normally

### Conditional Menu Items

Menu button items can also be conditionally shown:

```typescript
{
  id: 'addInfoButton',
  type: 'button',
  label: 'Add Information',
  button: {
    variant: 'menu',
    items: [
      {
        label: 'Add Contact',
        popinBlockId: 'contact-info',
        status: {
          hidden: '{{#unless (eq entityType "corporation")}}true{{else}}false{{/if}}'
        }
      },
      {
        label: 'Add Individual Info',
        popinBlockId: 'individual-info',
        status: {
          hidden: '{{#unless (eq entityType "individual")}}true{{else}}false{{/if}}'
        }
      }
    ]
  }
}
```

## Type Definitions

```typescript
interface BlockDescriptor {
  id: string;
  title: string;
  description?: string;
  fields: FieldDescriptor[];
  status?: StatusTemplates;
  subFormRef?: string;
  subFormInstanceId?: string;
  popin?: boolean;  // If true, block is standalone popin (never renders inline)
  popinLoad?: PopinLoadConfig;  // Optional: Load object data when popin opens (merged into formContext)
  popinSubmit?: PopinSubmitConfig;  // Optional: Call endpoint when validate button clicked, prevent closing on error
}

interface PopinLoadConfig {
  url: string;  // Handlebars-templated URL
  dataSourceId?: string;  // For server-side auth lookup
  auth?: {  // For direct auth (deprecated: use dataSourceId)
    type: 'bearer' | 'apikey' | 'basic';
    token?: string;
    headerName?: string;
    username?: string;
    password?: string;
  };
  // Note: Response is expected to be an object (like CaseContext shape), not an array
  // Response is merged directly into formContext, no transformation needed
}

interface PopinSubmitConfig {
  url: string;  // Handlebars-templated URL
  method: 'POST' | 'PUT' | 'PATCH';  // HTTP method
  payloadTemplate?: string;  // Optional Handlebars template for transforming form data
  auth?: {  // Optional authentication
    type: 'bearer' | 'apikey' | 'basic';
    token?: string;
    headerName?: string;
    username?: string;
    password?: string;
  };
}

interface FieldDescriptor {
  // ... existing properties ...
  type: FieldType | 'button';  // Add 'button' to field types
  button?: {
    variant: 'single' | 'menu' | 'link';
    popinBlockId?: string;  // For single variant
    items?: Array<{  // For menu variant
      label: string;
      popinBlockId: string;
      status?: StatusTemplates;  // Optional conditional visibility
    }>;
  };
}

```

## Single Button Example

Button fields can also trigger a single popin:

```typescript
{
  id: 'address-info',
  title: 'Address',
  fields: [
    { id: 'street', type: 'text', label: 'Street', validation: [...] },
    {
      id: 'editAddressButton',
      type: 'button',
      label: 'Edit Full Address',
      button: {
        variant: 'single',
        popinBlockId: 'full-address-form'
      }
    }
  ]
},
{
  id: 'full-address-form',
  title: 'Full Address Details',
  popin: true,  // Standalone popin
  fields: [
    { id: 'street', type: 'text', label: 'Street', validation: [...] },
    { id: 'city', type: 'text', label: 'City', validation: [...] },
    { id: 'state', type: 'text', label: 'State', validation: [...] },
    { id: 'zip', type: 'text', label: 'ZIP Code', validation: [...] },
    { id: 'country', type: 'dropdown', label: 'Country', validation: [...] },
  ]
}
```

## Key Design Decisions

1. **Standalone**: Popin blocks never render inline - they are skipped during normal form rendering
2. **Button-Only Triggers**: Popins can only be opened via button fields that reference them by ID
3. **Consistent Behavior**: All popins share the same behavior (open in dialog, shared form state, standard close actions)
4. **Declarative**: Popin behavior is declared in the descriptor with `popin: true`
5. **Backward Compatible**: Blocks without `popin` property render normally as inline blocks
6. **Conditional**: Popin blocks and menu items respect `status.hidden` and `status.disabled` templates
7. **Simple API**: Just add `popin: true` to mark a block as standalone popin

## Block Reference Resolution

When a button field references a block by `popinBlockId`:
- The system looks up the block in `mergedDescriptor.blocks` by ID
- If block is not found, an error is logged and popin doesn't open
- Block's `status.hidden` template is evaluated - if hidden, popin cannot be opened
- Block's `status.disabled` template is evaluated - if disabled, popin can open but fields are disabled
- The block is rendered inside a Dialog component with block.title as the dialog header
- All popins share the same behavior: same form instance, same validation, same close actions

## Popin Data Loading (popinLoad)

Popin blocks can optionally load an object when they open. The response is an object (like CaseContext shape) that gets merged directly into formContext, making it available to all fields in the popin. This is different from field `dataSource` which loads arrays of items for dropdowns.

### Example: Popin with Data Loading

```typescript
{
  id: 'contact-info',
  title: 'Contact Information',
  popin: true,  // Standalone popin
  popinLoad: {
    url: '/api/contacts/{{entityId}}',  // Handlebars template
    dataSourceId: 'contacts-api'  // Server-side auth lookup
  },
  fields: [
    { id: 'email', type: 'text', label: 'Email', validation: [...] },
    { id: 'phone', type: 'text', label: 'Phone', validation: [...] },
  ]
}
```

**Response Shape** (example):
```json
{
  "contactId": "123",
  "email": "contact@example.com",
  "phone": "+1234567890",
  "contactType": "primary",
  "lastUpdated": "2024-01-15"
}
```

**Behavior**:
- When popin opens, system evaluates `popinLoad.url` template with current formContext
- Fetches data from the evaluated URL using `dataSourceId` for authentication (or direct `auth` config)
- Expects response to be an object (like CaseContext shape), not an array
- Merges response object directly into formContext (all properties become available in templates)
- Caches loaded data to prevent duplicate requests

### Example: Popin Load with Direct Auth

```typescript
{
  id: 'beneficial-owner-info',
  title: 'Beneficial Owner',
  popin: true,
  popinLoad: {
    url: '/api/owners?entityId={{entityId}}',
    auth: {
      type: 'bearer',
      token: '{{apiToken}}'  // Can use Handlebars template for dynamic tokens
    }
  },
  fields: [
    { id: 'ownerName', type: 'text', label: 'Owner Name', validation: [...] },
    { id: 'ownershipPercent', type: 'number', label: 'Ownership %', validation: [...] },
  ]
}
```

**Response Shape** (example):
```json
{
  "ownerId": "456",
  "ownerName": "John Doe",
  "ownershipPercent": 25,
  "country": "US",
  "verified": true
}
```

**Use Cases**:
- Load existing contact information when editing contact popin
- Load related entity data (beneficial owners, documents) when popin opens
- Pre-populate fields with server-side data (fields can reference loaded properties in defaultValue templates)
- Load context data that popin fields depend on (for status templates, validation, etc.)

**Key Differences from Field DataSource**:
- `dataSource` (for fields): Loads array of items, transforms with `itemsTemplate` for dropdowns
- `popinLoad` (for popins): Loads object, merges directly into formContext (no transformation)

**Error Handling**: If `popinLoad` fails, error is logged but popin still opens (graceful degradation).

## Popin Submit URL Endpoint (popinSubmit)

Popin blocks have **Cancel** and **Validate** buttons in the dialog footer. The Validate button can optionally call an endpoint for server-side validation. If the endpoint returns an error, the popin will **prevent closing** and display an error message.

### Dialog Buttons

- **Cancel Button**: Closes popin immediately without side effects, discards any field changes made in the popin
- **Validate Button**: 
  - If `popinSubmit` is configured: Calls submit endpoint, closes on success, stays open on error
  - If `popinSubmit` is not configured: Closes popin immediately (no endpoint call)
- **Close Button (X)**: Acts as Cancel (closes without side effects)
- **Escape Key**: Acts as Cancel (closes without side effects)
- **Backdrop Click**: Acts as Cancel (closes without side effects)

### Example: Popin with Submit Validation

```typescript
{
  id: 'contact-info',
  title: 'Contact Information',
  popin: true,
  popinSubmit: {
    url: '/api/contacts/validate',
    method: 'POST',
    payloadTemplate: '{"email": "{{email}}", "phone": "{{phone}}"}',
    auth: {
      type: 'bearer',
      token: '{{apiToken}}'
    }
  },
  fields: [
    { id: 'email', type: 'text', label: 'Email', validation: [...] },
    { id: 'phone', type: 'text', label: 'Phone', validation: [...] },
  ]
}
```

**Behavior**:
- When user clicks **Validate** button:
  - System evaluates `popinSubmit.url` template with current formContext
  - Calls endpoint with `popinSubmit.method` (POST/PUT/PATCH)
  - If `payloadTemplate` is provided, transforms form data using Handlebars template
  - Uses `popinSubmit.auth` for authentication
  - **If endpoint succeeds (2xx)**: Popin closes, form field changes are kept
  - **If endpoint fails (4xx/5xx)**: Popin stays open, error message displayed to user
- When user clicks **Cancel** button:
  - Popin closes immediately
  - Any field changes made in popin are discarded (not saved to form state)

### Example: Submit Endpoint with Server-Side Validation

```typescript
{
  id: 'beneficial-owner-info',
  title: 'Beneficial Owner',
  popin: true,
  popinSubmit: {
    url: '/api/owners/validate?entityId={{entityId}}',
    method: 'POST',
    payloadTemplate: JSON.stringify({
      ownerName: '{{ownerName}}',
      ownershipPercent: '{{ownershipPercent}}',
      entityId: '{{entityId}}'
    })
  },
  fields: [
    { id: 'ownerName', type: 'text', label: 'Owner Name', validation: [...] },
    { id: 'ownershipPercent', type: 'number', label: 'Ownership %', validation: [...] },
  ]
}
```

**Use Cases**:
- Server-side validation before allowing popin to close
- Saving data to server when popin is validated
- Triggering side effects (notifications, workflows) on popin submit
- Preventing invalid data by validating before closing

**Error Handling**:
- If submit endpoint returns 4xx/5xx: Popin stays open, error displayed
- Loading state shown on Validate button while submit endpoint is being called
- User can click Cancel to close without validation if needed

## User Flow

1. User sees form with inline blocks and button fields that can trigger popins
2. User clicks a button field (single button or menu item)
3. If popin has `popinLoad` config, system fetches data from URL and merges into formContext
4. Dialog opens with the referenced block's fields and Cancel/Validate buttons in footer
5. If data was loaded, fields can use the loaded data (e.g., in default values, status templates)
6. User fills out fields in popin (form state is shared with main form)
7. User clicks **Validate** button:
   - If popin has `popinSubmit` config:
     - System shows loading indicator on Validate button
     - Calls submit endpoint with form data
     - **If endpoint succeeds (2xx)**: Popin closes, form field changes are kept
     - **If endpoint fails (4xx/5xx)**: Popin stays open, error message displayed
   - If popin has no `popinSubmit` config: Popin closes immediately
8. User clicks **Cancel** button (or X, escape, backdrop):
   - Popin closes immediately
   - Any field changes made in popin are discarded (not saved to form state)
9. If validated successfully, form state persists (fields remain filled)
10. User can reopen popin to edit fields again (data is cached, no reload needed)
