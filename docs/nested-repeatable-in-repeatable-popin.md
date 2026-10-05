# Nested Repeatable Inside a Repeatable Popin

The demo Contacts block is one repeatable popin that contains a second repeatable list: emergency contacts for the contact that is open.

The inner list is not a second popin, and it is not a separate block. Both groups live on the same block. The engine splits them by `repeatableGroupId`.

Source: `src/app/api/form/global-descriptor-demo/route.ts` (`contacts-block`). Prefill: `src/app/api/demo/prefill/route.ts`.

## Descriptor

```typescript
{
  id: 'contacts-block',
  title: 'Contacts',
  description:
    'Each summary opens that contact. Emergency contacts are seeded from caseContext.contactGroupId.@index.emergencyContacts.',
  repeatable: true,
  repeatablePopin: true,
  repeatableSummaryTemplate: '{{#if name}}{{name}}{{else}}New contact{{/if}}',
  repeatableDefaultSource: 'contactGroupId',
  minInstances: 0,
  maxInstances: 5,
  fields: [
    {
      id: 'contactGroupId.name',
      type: 'text',
      label: 'Contact Name',
      repeatableGroupId: 'contactGroupId',
      validation: [],
    },
    {
      id: 'emergency-contacts.emergencyName',
      type: 'text',
      label: 'Emergency Contact Name',
      description: 'Seeded from the open contact row in case context',
      repeatableGroupId: 'emergency-contacts',
      repeatableDefaultSource: 'caseContext.contactGroupId.@index.emergencyContacts',
      validation: [],
    },
    {
      id: 'emergency-contacts.emergencyPhone',
      type: 'text',
      label: 'Emergency Contact Phone',
      repeatableGroupId: 'emergency-contacts',
      validation: [],
    },
  ],
}
```

Two groups share this block:

| Group | Fields | Where it is stored | Where it is shown |
| --- | --- | --- | --- |
| `contactGroupId` | `name` | `formData.contactGroupId[]` | Main form, as clickable summaries |
| `emergency-contacts` | `emergencyName`, `emergencyPhone` | `formData.contactGroupId[i]['emergency-contacts'][]` after the popin is validated | Only inside the open contact popin, as inline rows |

`repeatableDefaultSource` on a field wins over the block-level source for that field's group. The block source `contactGroupId` seeds the outer rows. The field source on `emergencyName` seeds the inner rows.

## Case prefill

Each contact in `caseContext.contactGroupId` may carry its own `emergencyContacts` array. The property name on the case row (`emergencyContacts`) is the path the source template reads. The form group id (`emergency-contacts`) is a different string: it is the key written into form data.

```typescript
contactGroupId: [
  {
    name: 'Ada',
    emergencyContacts: [{ emergencyName: 'Alice', emergencyPhone: '111' }],
  },
  {
    name: 'Grace',
    emergencyContacts: [
      { emergencyName: 'Jane', emergencyPhone: '098' },
      { emergencyName: 'John', emergencyPhone: '123' },
    ],
  },
]
```

Row objects are copied onto form fields by **base field id** (`emergencyName`, `emergencyPhone`), not by copying the source key name.

## What the main form does

`groupFieldsByRepeatableGroupId` splits the block into the two groups above.

On the main form, repeatable popin blocks render summaries. A group whose source path contains `@index` is skipped there (`seedsFromOpenInstance` in `Block`). `@index` means "the contact that is open", and no contact is open on the main form, so emergency contacts do not get their own summary list.

The outer group source is `contactGroupId` (no `@index`), so the main form shows one summary per contact:

```
Contacts
┌─────────────────────────┐
│ Ada                  [×] │
└─────────────────────────┘
┌─────────────────────────┐
│ Grace                [×] │
└─────────────────────────┘
[ + Add ]
```

Initial main-form defaults only fill fields that belong to `contactGroupId`. That is `name`. Emergency contacts stay on `caseContext` until that contact's popin opens.

```typescript
contactGroupId: [
  { name: 'Ada' },
  { name: 'Grace' },
]
```

## What opening a contact builds

`PopinManager` turns the block into a one-instance descriptor for the dialog (`popinEditContext` is `{ groupId: 'contactGroupId', index }`).

1. Fields in the opened group are flattened. The `contactGroupId.` prefix is removed and `repeatableGroupId` is cleared, so they become ordinary fields of this dialog.
2. Fields whose `repeatableGroupId` is some other group are copied through unchanged.
3. If any of those other-group fields exist, the instance block is marked `repeatable: true`, so the dialog renders them with `RepeatableFieldGroup` (inline add and remove), not as another popin.

Opened contact (index `1`, Grace):

```typescript
{
  id: 'contacts-block-instance',
  title: 'Contacts',
  repeatable: true,
  fields: [
    {
      id: 'name',
      type: 'text',
      label: 'Contact Name',
      validation: [],
    },
    {
      id: 'emergency-contacts.emergencyName',
      type: 'text',
      label: 'Emergency Contact Name',
      repeatableGroupId: 'emergency-contacts',
      repeatableDefaultSource: 'caseContext.contactGroupId.@index.emergencyContacts',
      validation: [],
    },
    {
      id: 'emergency-contacts.emergencyPhone',
      type: 'text',
      label: 'Emergency Contact Phone',
      repeatableGroupId: 'emergency-contacts',
      validation: [],
    },
  ],
}
```

Inside the dialog:

```
Contact Name
[ Grace ]

Emergency contacts
┌──────────────────────────────┐
│ Jane          098        [×] │
│ John          123        [×] │
└──────────────────────────────┘
[ + Add ]
[ Validate ]
```

## How `@index` is bound

`extractDefaultValues` is called for the popin with `index` set to the open contact.

`@index` in a **group source path** is the open contact. For Grace that path becomes `caseContext.contactGroupId.1.emergencyContacts`, which is Jane and John. For Ada (`index` `0`) it is Alice. The other contact's list is not loaded.

`@index` inside an **inner field `defaultValue`** is that emergency-contact row (`0`, `1`, …), not the open contact. This demo does not use field `defaultValue` templates on the inner fields. It copies `emergencyName` and `emergencyPhone` straight from each source object. If a field did use `{{caseContext.contactGroupId.@index.emergencyContacts.@index.emergencyName}}`, the first `@index` would still be the open contact only when it appears in `repeatableDefaultSource`. Inside `defaultValue`, `@index` is the inner row. The source path is the place that selects which contact's array to read.

Create mode uses `index: -1`. A source that contains `@index` cannot be resolved, so the inner group starts as `[]`.

If this contact was already validated, the saved row is merged on top of those defaults. A later open keeps the emergency contacts the user edited.

## What Validate writes back

Validate replaces one element of `contactGroupId` with the whole popin value object. The inner array is a property of that element, under the inner group id.

After validating Grace:

```typescript
contactGroupId: [
  { name: 'Ada' },
  {
    name: 'Grace',
    'emergency-contacts': [
      { emergencyName: 'Jane', emergencyPhone: '098' },
      { emergencyName: 'John', emergencyPhone: '123' },
    ],
  },
]
```

Ada's row is unchanged until her popin is opened and validated. A new contact (`index` `< 0`) is appended.

## Rules for this pattern

- Put the outer row fields and the inner list fields on the **same** repeatable popin block.
- Give them **different** `repeatableGroupId` values.
- Prefix outer field ids with the outer group id (`contactGroupId.name`). Prefix inner field ids with the inner group id (`emergency-contacts.emergencyName`).
- Put `@index` on the inner group's `repeatableDefaultSource`, pointing at the array on the open outer row: `caseContext.contactGroupId.@index.emergencyContacts`.
- Leave the inner group off the main form. The `@index` in that source is what hides it until a contact is open.
