# Repeatable Popin — Usage Example

This document describes how to use repeatable blocks that render a clickable summary per element and open a popin to add/edit each element.

## Concept

- **Current behavior**: Repeatable blocks render all fields inline for each instance.
- **Repeatable popin behavior**: Repeatable blocks render a compact summary per instance. Each summary is clickable and opens a popin to add or edit that instance. An "Add" button at the end appends a new element.

## Layout

```
┌─────────────────────────────────────────────────────┐
│ Emergency Contacts                                  │
│ Add emergency contacts. Click a contact to edit.    │
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────┐ │
│ │ Jane Doe (spouse)                          [×]   │ │  ← clickable summary
│ └─────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────┐ │
│ │ John Smith (parent)                         [×]   │ │  ← clickable summary
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ [ + Add Emergency Contact ]                         │  ← Add button
└─────────────────────────────────────────────────────┘
```

## Descriptor Configuration

### Minimal example

```typescript
{
  id: 'emergency-contacts-block',
  title: 'Emergency Contacts',
  description: 'Add emergency contacts. Click a contact to edit.',
  repeatable: true,
  repeatablePopin: true,
  minInstances: 0,
  maxInstances: 5,
  repeatableBlockRef: 'emergency-contact-block',
}
```

### With custom summary template

```typescript
{
  id: 'emergency-contacts-block',
  title: 'Emergency Contacts',
  repeatable: true,
  repeatablePopin: true,
  repeatableSummaryTemplate: '{{#if emergencyName}}{{emergencyName}} ({{emergencyRelationship}}){{else}}New contact{{/if}}',
  minInstances: 0,
  maxInstances: 5,
  repeatableBlockRef: 'emergency-contact-block',
}
```

- **repeatableSummaryTemplate**: Handlebars template evaluated with the current instance as context.
- If omitted, a fallback like `"Item {n}"` or the first non-empty field value is used.

### Referenced block (provides the fields)

```typescript
{
  id: 'emergency-contact-block',
  title: 'Emergency Contact',
  fields: [
    {
      id: 'emergencyName',
      type: 'text',
      label: 'Full Name',
      validation: [{ type: 'required', message: 'Name is required' }],
    },
    {
      id: 'emergencyRelationship',
      type: 'dropdown',
      label: 'Relationship',
      items: [
        { label: 'Spouse', value: 'spouse' },
        { label: 'Parent', value: 'parent' },
        { label: 'Sibling', value: 'sibling' },
      ],
      validation: [{ type: 'required', message: 'Relationship is required' }],
    },
    {
      id: 'emergencyPhone',
      type: 'text',
      label: 'Phone Number',
      validation: [
        { type: 'required', message: 'Phone is required' },
        { type: 'pattern', value: /^[\d\s\-\+\(\)]+$/, message: 'Invalid phone format' },
      ],
    },
  ],
}
```

## Pre-populated data from backend

When the repeatable group is already populated from the backend (via `repeatableDefaultSource`, `casePrefill`, `popinLoad`, or initial form load), the component must:

1. **Display summaries** for every existing element using the template and actual instance values (e.g. "Jane Doe (spouse)", "John Smith (parent)").
2. **Allow edit on click**: clicking a summary opens the popin pre-filled with that instance's data and lets the user edit; on Validate, changes merge back into the main form at the correct index.

### Data sources that pre-populate the array

| Source | Usage |
|--------|--------|
| `repeatableDefaultSource` | Case context key (e.g. `"addresses"`) that provides initial array |
| `casePrefill` / prefill API | Response includes array at the group key (e.g. `addresses`, `emergency-contacts`) |
| `popinLoad` (for popin blocks) | Response merged into form context; repeatable group array at group key |
| Initial descriptor default values | Default values for the repeatable group |

In all cases, summaries must render using the actual values, and edit-on-click must behave correctly for each instance.

---

## User flows

### When data already exists from backend

1. Form loads with pre-populated array (e.g. from prefill or popinLoad).
2. Summary elements display for each item (e.g. "Jane Doe (spouse)", "John Smith (parent)").
3. User clicks "Jane Doe (spouse)" → popin opens with that instance's data pre-filled.
4. User edits and clicks "Validate" → changes merge back; summary updates accordingly.

### Adding an element

1. User clicks "Add Emergency Contact".
2. A new empty instance is appended.
3. A new summary row appears (e.g. "New contact").
4. User clicks the summary → popin opens with the form for that instance.
5. User fills the form and clicks "Validate" → values are saved, popin closes.

### Editing an element (user-added or backend-loaded)

1. User sees summary "Jane Doe (spouse)".
2. User clicks it → popin opens pre-filled with that instance’s data.
3. User edits and clicks "Validate" → changes are saved, popin closes; summary reflects edits.

### Removing an element

- Each summary row can have a remove (×) control (when above `minInstances`).
- Or remove is available inside the popin.

## Form data shape

Form data structure is unchanged from standard repeatable groups:

```typescript
{
  'emergency-contacts': [
    {
      emergencyName: 'Jane Doe',
      emergencyRelationship: 'spouse',
      emergencyPhone: '+1-555-123-4567',
    },
    {
      emergencyName: 'John Smith',
      emergencyRelationship: 'parent',
      emergencyPhone: '+1-555-987-6543',
    },
  ],
}
```

## Summary template context

The `repeatableSummaryTemplate` is evaluated with:

- All fields of the current instance (e.g. `emergencyName`, `emergencyRelationship`, `emergencyPhone`).
- Helpers: `@index`, `@first`, `@last`, `@key` (if applicable).

Example: `"{{emergencyName}} — {{emergencyRelationship}}"` → "Jane Doe — spouse"
