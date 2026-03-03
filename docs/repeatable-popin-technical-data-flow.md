# Repeatable Popin – Technical Data Flow

This document explains how repeatable popin blocks are implemented in the KYC form engine and how data flows between the main form, the popin dialog, and backend-prefilled data.

---

## 1. Descriptor model

### 1.1 BlockDescriptor flags

Repeatable popin behavior is enabled at the descriptor level:

```ts
{
  id: 'addresses-block',
  title: 'Addresses',
  description: 'Add multiple addresses. Click a summary to edit.',
  repeatable: true,
  repeatablePopin: true,
  repeatableSummaryTemplate: '{{#if street}}{{street}}{{#if city}}, {{city}}{{/if}}{{else}}New address{{/if}}',
  repeatableBlockRef: 'address-block',
  minInstances: 1,
  maxInstances: 5,
  repeatableDefaultSource: 'addresses',
  fields: [], // resolved from 'address-block'
}
```

- **`repeatable`**: marks the block as a repeatable group.
- **`repeatablePopin`**: tells the renderer to show **summaries + Add button** on the main form and use a popin to edit items.
- **`repeatableSummaryTemplate`**: Handlebars summary template evaluated per instance.
- **`repeatableBlockRef`**: reuses fields from a non-repeatable block (e.g. `address-block`) and assigns them a `repeatableGroupId` (e.g. `addresses`).
- **`repeatableDefaultSource`**: points to a `caseContext` key (e.g. `addresses`) used to prefill the repeatable group from backend data.

The address fields themselves live in a normal block (referenced by `repeatableBlockRef`):

```ts
{
  id: 'address-block',
  title: 'Address',
  fields: [
    { id: 'street', type: 'text', label: 'Street', validation: [...] },
    { id: 'city', type: 'text', label: 'City', validation: [...] },
    { id: 'postalCode', type: 'text', label: 'ZIP / Postal Code', validation: [...] },
  ],
}
```

The repeatable block is materialized before it reaches the client by `resolveAllRepeatableBlockRefs`, which:
- Copies fields from `address-block`.
- Adds `repeatableGroupId: 'addresses'`.
- Prefixes field ids as `addresses.street`, `addresses.city`, etc.

---

## 2. Rendering on the main form

### 2.1 FormPresentation → Block

`FormPresentation` renders blocks from the merged descriptor:

```tsx
<Block
  key={block.id}
  block={block}
  isDisabled={isDisabled}
  isHidden={false}
  form={form}
  formContext={formContext}
  onLoadDataSource={onLoadDataSource}
  dataSourceCache={dataSourceCache}
  renderRepeatablesAsSummary
/>
```

The `renderRepeatablesAsSummary` flag is **only** set on the main form, not in popins.

### 2.2 Block: choosing between inline repeatable vs summary

In `Block`:

```ts
const isRepeatable = isRepeatableBlock(block);
const fieldGroups = useMemo(
  () => (isRepeatable ? groupFieldsByRepeatableGroupId(block.fields) : null),
  [block.fields, isRepeatable]
);
```

For each repeatable group:

```tsx
if (renderRepeatablesAsSummary && isRepeatablePopinBlock(block)) {
  return (
    <RepeatablePopinSummary
      key={groupId}
      block={block}
      groupId={groupId}
      fields={fields}
      isDisabled={groupDisabled}
      isHidden={groupHidden}
      form={form}
      formContext={formContext}
    />
  );
}

return (
  <RepeatableFieldGroup
    key={groupId}
    block={block}
    groupId={groupId}
    fields={fields}
    ...
  />
);
```

- **Main form**: `renderRepeatablesAsSummary` is `true` → repeatable popin blocks use `RepeatablePopinSummary`.
- **Other blocks** (non-popin or non-repeatable) still use `RepeatableFieldGroup` or inline fields as before.

---

## 3. RepeatablePopinSummary – Add & edit flows

### 3.1 Internal state (react-hook-form)

`RepeatablePopinSummary` uses `useFieldArray` on the repeatable group:

```ts
const { fields: fieldArrayFields, append, remove } = useFieldArray({
  control: form.control,
  name: groupId, // e.g. 'addresses'
});
```

The backing form data shape (for `addresses`) remains:

```ts
{
  addresses: [
    { street: '123 Main St', city: 'New York', postalCode: '10001' },
    ...
  ];
}
```

### 3.2 Adding an element (Add Address)

```ts
const handleAdd = () => {
  append(getDefaultInstanceValues());
  const groupArray = form.getValues()[groupId] as unknown[] | undefined;
  const newIndex = groupArray && groupArray.length > 0 ? groupArray.length - 1 : 0;
  openPopin(block.id, { groupId, index: newIndex });
};
```

Flow:

```text
User clicks "Add Address"
  → append(defaultInstance) to form.values.addresses
  → read the updated addresses array from form.getValues()
  → compute newIndex = last index
  → openPopin('addresses-block', { groupId: 'addresses', index: newIndex })
```

This guarantees:
- A new address object is added to the array.
- The popin opens for **that specific index** (newly appended row).

### 3.3 Editing an element (clicking a summary)

```ts
const handleSummaryClick = (index: number) => {
  if (isDisabled) return;
  openPopin(block.id, { groupId, index });
};
```

Flow:

```text
User clicks a summary ("123 Main St, New York")
  → openPopin('addresses-block', { groupId: 'addresses', index })
  → PopinManager opens dialog for that instance
```

### 3.4 Summary text

Per instance, `RepeatablePopinSummary` builds a context:

```ts
const instanceContext: FormContext = {
  ...formContext,
  [groupId]: form.watch(groupId),
  ...(currentInstance || {}),
  '@index': index,
  '@first': index === 0,
  '@last': index === (fieldArrayFields.length ?? 0) - 1,
};
```

Then:

```ts
const template = block.repeatableSummaryTemplate;
if (template) {
  const result = evaluateTemplate(template, instanceContext);
  if (result.trim()) return result;
}
// Fallback: first non-empty field, else "Item N"
```

For `addresses`, a summary might be:

```hbs
{{#if street}}{{street}}{{#if city}}, {{city}}{{/if}}{{else}}New address{{/if}}
```

---

## 4. PopinManager – creating an instance block

### 4.1 openPopin with repeatable context

`PopinManager` context accepts:

```ts
export interface OpenPopinOptions {
  groupId?: string;
  index?: number;
}
```

`RepeatablePopinSummary` calls:

```ts
openPopin(block.id, { groupId: 'addresses', index });
```

`PopinManager` stores this in `popinEditContext`:

```ts
const [popinEditContext, setPopinEditContext] =
  useState<{ groupId: string; index: number } | null>(null);
```

### 4.2 Building the popin descriptor for a single instance

`popinDescriptor` is derived as:

```ts
const popinDescriptor = useMemo(() => {
  if (!resolvedBlock || !mergedDescriptor) return null;
  const block = resolvedBlock.block;

  if (popinEditContext && isRepeatableBlock(block)) {
    const { groupId } = popinEditContext;
    const fieldGroups = groupFieldsByRepeatableGroupId(block.fields);
    const groupFields = fieldGroups[groupId];
    if (!groupFields?.length) return null;

    const instanceFields = groupFields
      .filter(f => f.type !== 'button')
      .map(f => {
        const baseId = f.id.startsWith(`${groupId}.`)
          ? f.id.slice(groupId.length + 1)
          : f.id;
        return { ...f, id: baseId, repeatableGroupId: undefined };
      });

    const instanceBlock = {
      id: `${block.id}-instance`,
      title: block.title,
      fields: instanceFields,
    };

    return {
      version: mergedDescriptor.version,
      blocks: [instanceBlock],
      submission: mergedDescriptor.submission,
    } as GlobalFormDescriptor;
  }

  return {
    version: mergedDescriptor.version,
    blocks: [block],
    submission: mergedDescriptor.submission,
  };
}, [resolvedBlock, mergedDescriptor, popinEditContext]);
```

Key idea:
- The main repeatable block (`addresses-block`) is transformed into a **single-instance** block with:
  - Field ids like `street`, `city`, `postalCode`.
  - No `repeatableGroupId`.
- This instance block is what the popin renders.

### 4.3 Seeding the popin form

When `popinEditContext` is set:

```ts
useEffect(() => {
  if (popinEditContext && resolvedBlock) {
    const mainValues = mainForm.getValues() as Record<string, unknown>;
    const groupArray = mainValues[popinEditContext.groupId] as unknown[] | undefined;
    const instanceData = Array.isArray(groupArray) ? groupArray[popinEditContext.index] : undefined;
    if (instanceData && typeof instanceData === 'object') {
      popinForm.reset(instanceData as Record<string, unknown>);
    }
  }
}, [popinEditContext, resolvedBlock, mainForm, popinForm]);
```

So:

```text
mainForm.values.addresses[index] → popinForm defaultValues
```

Inside the popin, `Block` receives `block={popinDescriptor.blocks[0]}` and `renderRepeatablesAsSummary={false}`, so address fields are rendered inline.

---

## 5. Merging back on Validate

### 5.1 Validate in edit mode

At the start of `handleValidate`:

```ts
if (popinEditContext) {
  const values = popinForm.getValues() as Record<string, unknown>;
  const targetForm = block.popin ? popinForm : mainForm;
  (targetForm as UseFormReturn<FieldValues>).setValue(
    `${popinEditContext.groupId}.${popinEditContext.index}` as never,
    values as never
  );
  closePopin();
  return;
}
```

For `addresses-block` on the main form:

```text
popinForm.values = { street: '...', city: '...', postalCode: '...' }
→ mainForm.setValue('addresses.0', { street, city, postalCode })
→ popin closes
→ RepeatablePopinSummary reads updated main form values and re-renders summary
```

For popin blocks that themselves contain a repeatable group (less common), `targetForm` can be `popinForm`, but for the main “Addresses” case, `mainForm` is used.

### 5.2 Non-edit mode (popinSubmit)

When `popinEditContext` is `null` and `block.popinSubmit` is defined, `handleValidate` falls back to the existing **submit-to-backend** flow:
- Build payload via `evaluatePayloadTemplate`.
- Send `fetch` request to `popinSubmit.url`.
- Map any backend errors to `popinForm.setError`.
- Close popin on success; leave open on error.

Repeatable popin edit mode **short-circuits** before this path.

---

## 6. Backend prefill and rehydration

Repeatable popin blocks integrate with the existing initialization/rehydration pipeline:

- `repeatableDefaultSource` + `caseContext.addresses` + `extractDefaultValues`:
  - Pre-populates `form.defaultValues.addresses` from backend arrays.
- `useFormDescriptor` merges:
  - Descriptor-driven defaults.
  - Persisted `formData` from Redux.
- `RepeatablePopinSummary` and `RepeatableFieldGroup` both operate on the same `addresses` array maintained by `react-hook-form` + Redux sync.

From a data-flow perspective:

```text
Backend descriptor + caseContext
  → resolveAllRepeatableBlockRefs
  → extractDefaultValues (fills addresses[] from caseContext or defaults)
  → useForm({ defaultValues })
  → main form renders RepeatablePopinSummary (summaries + Add)
  → user interacts:
      - Add: append + openPopin with groupId/index
      - Edit: openPopin with groupId/index
  → PopinManager seeds popinForm from mainForm.values.addresses[index]
  → Validate: merge popinForm.values back into mainForm.values.addresses[index]
  → summaries re-render from updated array
```

This keeps:
- A single source of truth for addresses (`react-hook-form` + Redux).
- A clean separation between:
  - **Main form UX** (summaries + Add).
  - **Edit UX** (popin with a focused single-instance block).

