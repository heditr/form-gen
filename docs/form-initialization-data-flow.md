## Form Initialization & Interaction Data Flow

### 1. High‑Level Overview

**Core idea**: the form’s values are driven by a **descriptor + context** pipeline, with **Redux** used to preserve state across re‑hydrations.

- **Initialization**
  - Backend descriptor + case context → `defaultValues`
  - `defaultValues` + Redux `formData` → `initialValues`
  - `initialValues` → `react-hook-form` `useForm({ defaultValues })`
- **User Interaction**
  - User changes → `react-hook-form` internal state
  - Hook watches values → pushes to Redux `formData`
  - If discriminant fields changed → new `CaseContext` → `/api/rules/context`
  - `/api/rules/context` response → new `mergedDescriptor`
  - New descriptor/context → new `initialValues`, merged with preserved user input

---

### 2. Initialization: From Descriptor to `initialValues`

#### 2.1 Demo Page Sets Up Descriptor & Case Context

On `DemoPage`:

- Global descriptor:

```ts
const { refetch: refetchDescriptor } =
  useGlobalDescriptor('/api/form/global-descriptor-demo');
```

- Prefill / context:

```ts
dispatch(initializeCaseContextFromPrefill({ casePrefill: body.casePrefill ?? {} }));
dispatch(updateCaseContextValues({
  caseContext: {
    email: 'test@example.com',
    phone: '+1-555-123-4567',
    documentUrl: 'https://example.com/sample-document.pdf',
    priority: 5,
    newsletter: true,
  },
}));
```

After this:

- `Redux.globalDescriptor` and `Redux.mergedDescriptor` are set.
- `Redux.caseContext` contains initial discriminant/context values.
- `Redux.formData` is still `{}`.

#### 2.2 Container Wires Redux Into `useFormDescriptor`

In `FormContainer`:

- Read Redux form state:

```ts
const formState = useSelector((s: RootState) => getFormState(s));
const { mergedDescriptor, caseContext, formData } = formState;
```

- Compute a **key** that depends on validation and `caseContext`:

```ts
const formKey = useMemo(() => {
  if (!mergedDescriptor) return 'no-descriptor';
  const validationHash = mergedDescriptor.blocks
    .flatMap(block => block.fields)
    .map(field => {
      const ruleTypes = field.validation?.map(r => {
        if (r.type === 'pattern') {
          const patternValue =
            typeof r.value === 'string' ? r.value : r.value.toString();
          return `${r.type}:${patternValue}`;
        }
        return `${r.type}:${'value' in r ? r.value : ''}`;
      }).join(',') || 'none';
      return `${field.id}:${ruleTypes}`;
    })
    .join('|');

  const contextHash = JSON.stringify(caseContext);
  return `form-${validationHash}-ctx-${contextHash}`;
}, [mergedDescriptor, caseContext]);
```

- Render `FormInner` with that key:

```tsx
<FormInner
  key={formKey}
  mergedDescriptor={mergedDescriptor}
  caseContext={caseContext}
  formData={formData}
  ...
/>
```

Whenever rules or `caseContext` change, **`formKey` changes**, causing `FormInner` to **remount** and re‑create `react-hook-form` with fresh defaults.

Inside `FormInner`:

```ts
const { form } = useFormDescriptor(mergedDescriptor, {
  onDiscriminantChange: handleDiscriminantChange,
  savedFormData: formData,
  caseContext,
  formData: formData,
});
```

#### 2.3 `useFormDescriptor`: Computing `defaultValues`

`useFormDescriptor` builds a `formContext`:

```ts
const formContext = {
  caseContext,
  formData: contextFormData,
  ...contextFormData,
};
```

Then:

```ts
const defaultValues = extractDefaultValues(descriptor, formContext);
```

Inside `extractDefaultValues`:

- For **non‑repeatable fields**:
  - If `field.defaultValue` is present:
    - Use `evaluateDefaultValue(field.defaultValue, field.type, context)` which can interpret Handlebars templates using `formContext`.
  - Otherwise, apply type‑specific defaults:
    - `''` for text/date/dropdown/autocomplete/radio
    - `false` for checkbox
    - `0` for number
    - `null` for file
- For **repeatable blocks** (`block.repeatable === true`):
  - Group fields by `repeatableGroupId`.
  - If `block.repeatableDefaultSource` exists:
    - Treat it as a (possibly templated) key into `caseContext` (via `evaluateTemplate`).
    - If `caseContext[key]` is an array:
      - If any default uses `@index`, build each row by evaluating that template per index.
      - Otherwise, normalize items into `{ baseFieldId: value }` objects.
    - Set `defaultValues[groupId]` to that array.
  - If no external source but some field defaults exist:
    - Build one default row from those defaults + type defaults.
  - If no defaults at all:
    - Build an empty instance shape and repeat it `minInstances` times.

Result: **`defaultValues` is a full, context‑aware, type‑safe initial value object**.

#### 2.4 Template Default Fields

`useFormDescriptor` detects template‑driven default fields:

```ts
const fieldsWithTemplateDefaults = identifyFieldsWithTemplateDefaults(descriptor);
```

- It scans for `field.defaultValue` strings that contain `{{ ... }}`.
- Returns a `Set` of field IDs.
- Used later to decide when a user has “overridden” a templated default.

#### 2.5 Merging `savedFormData` and `defaultValues` → `initialValues`

Key logic:

```ts
const initialValues = useMemo(() => {
  if (!savedFormData || Object.keys(savedFormData).length === 0) {
    return defaultValues;
  }

  const merged: Partial<FormData> = { ...defaultValues };

  for (const [key, savedValue] of Object.entries(savedFormData)) {
    const fieldId = key as keyof FormData;
    const newDefault = defaultValues[fieldId];

    if (savedValue === undefined || savedValue === null) continue;

    if (fieldsWithTemplateDefaults.has(key)) {
      const valuesDiffer = JSON.stringify(savedValue) !== JSON.stringify(newDefault);
      if (valuesDiffer) {
        merged[fieldId] = savedValue as FormData[keyof FormData];
      }
      // else: same as default → keep the new default already in `merged`
    } else {
      merged[fieldId] = savedValue as FormData[keyof FormData];
    }
  }

  return merged;
}, [defaultValues, savedFormData, fieldsWithTemplateDefaults]);
```

**Semantics**:

- Always start from `defaultValues` to keep the form fully controlled.
- **Overlay `savedFormData`**:
  - For **template fields**:
    - If the saved value differs from the *current* default → treat as a user override, **preserve** it.
    - If saved equals default → treat as still default, let the **new** default take effect.
  - For **non‑template fields**:
    - Always prefer the saved value (user input wins).

#### 2.6 Initializing `react-hook-form`

Finally:

```ts
const form = useForm<FieldValues>({
  defaultValues: initialValues,
  resolver: zodResolver(zodSchema),
  mode: 'onChange',
});
```

So the **effective `initialValues`** are those `defaultValues` + `savedFormData` merged according to the rules above.

---

### 3. User Interaction Flow

Once the form is mounted, the user interacts with it; the system reacts on every meaningful change.

#### 3.1 Watching Values in `useFormDescriptor`

`useFormDescriptor` uses `useWatch`:

```ts
const watchedValues = useWatch({ control: form.control });
const previousValuesRef = useRef<string | null>(null);

useEffect(() => {
  if (!descriptor || !onDiscriminantChange) return;

  const currentValues = watchedValues ?? {};
  const currentValuesString = JSON.stringify(currentValues);

  if (currentValuesString === previousValuesRef.current) return;

  previousValuesRef.current = currentValuesString;

  const formData = currentValues as Partial<FormData>;
  onDiscriminantChange(formData);
}, [descriptor, watchedValues, onDiscriminantChange]);
```

- Any actual change in `watchedValues` triggers `onDiscriminantChange(formData)`.
- This is **per‑form change**, not per field, and deduplicated via JSON string comparison.

#### 3.2 Container: Sync to Redux & Discriminant Handling

In `FormInner`:

```ts
const handleDiscriminantChange = (newFormData: Partial<FormData>) => {
  syncFormData(newFormData); // dispatch(syncFormDataToContext({ formData: newFormData }))

  const discriminantFields = mergedDescriptor
    ? identifyDiscriminantFields(visibleFields)
    : [];

  if (discriminantFields.length === 0) return;

  if (!haveDiscriminantFieldsChanged(caseContext, newFormData, discriminantFields)) {
    return;
  }

  const updatedContext = updateCaseContext(caseContext, newFormData, discriminantFields);

  rehydrate(updatedContext);
};
```

So for **every user change**:

- Redux’s `formData` is updated via `syncFormDataToContext`.
- If any discriminant field changed:
  - `updateCaseContext` builds a new `CaseContext`.
  - `rehydrate(updatedContext)` is called.

#### 3.3 Debounced Rehydration & Rules Endpoint

`rehydrate` is backed by `useDebouncedRehydration`:

```ts
const { mutate: debouncedRehydrate, isPending } = useDebouncedRehydration();

const rehydrate = (caseContext: CaseContext) => {
  debouncedRehydrate(caseContext);
};
```

Inside `useDebouncedRehydration`:

- Maintains refs for:
  - `timeoutRef`, `latestContextRef`, `lastSentContextRef`.
- Provides a debounced function:

```ts
const debouncedMutate = (caseContext: CaseContext) => {
  const contextString = JSON.stringify(caseContext);
  if (contextString === lastSentContextRef.current) return;

  latestContextRef.current = caseContext;

  if (timeoutRef.current !== null) {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }

  const timeoutId = setTimeout(() => {
    if (timeoutRef.current !== timeoutId) return;
    if (!isMountedRef.current) return;

    timeoutRef.current = null;

    if (latestContextRef.current !== null) {
      const currentContextString = JSON.stringify(latestContextRef.current);
      if (currentContextString !== lastSentContextRef.current) {
        lastSentContextRef.current = currentContextString;
        mutateRef.current(latestContextRef.current);
      }
    }
  }, 500);

  timeoutRef.current = timeoutId;
};
```

The mutation itself:

```ts
const mutation = useMutation<RulesObject, Error, CaseContext>({
  mutationFn: async (caseContext) => {
    dispatch(triggerRehydration()); // set isRehydrating=true
    const response = await apiCall('/api/rules/context', {
      method: 'POST',
      body: JSON.stringify(caseContext),
    });
    return await response.json();
  },
  onSuccess: (rulesObject) => {
    dispatch(applyRulesUpdate({ rulesObject }));
  },
  onError: () => {
    dispatch(applyRulesUpdate({ rulesObject: null }));
  },
});
```

`applyRulesUpdate` in the reducer:

```ts
const updatedMergedDescriptor =
  mergeDescriptorWithRules(state.globalDescriptor, rulesObject);

return {
  ...state,
  mergedDescriptor: updatedMergedDescriptor,
  isRehydrating: false,
};
```

So:

- **Debounced discriminant changes → CaseContext POST**.
- Response → **new `mergedDescriptor`** in Redux.

---

### 4. Rehydration and New `initialValues` (While Preserving Input)

When `mergedDescriptor` or `caseContext` changes in Redux:

1. `FormContainer` recomputes `formKey(mergedDescriptor, caseContext)`.
2. Key changes → React remounts `FormInner`.
3. `FormInner` calls `useFormDescriptor` with:
   - New `descriptor = mergedDescriptor`.
   - New `caseContext`.
   - **Persisted `savedFormData = Redux.formData`** from previous form instance.
4. `useFormDescriptor`:
   - Recomputes **`defaultValues`** based on the new descriptor and context.
   - Re‑merges with `savedFormData` using the same logic:
     - Template fields: default vs user override logic.
     - Non‑template: user values win.
5. `useForm` is re‑initialized with the new `initialValues`.

**Effect**:

- All user‑typed values are preserved via `savedFormData`.
- Templated defaults can **evolve** with changing `caseContext` when the user hasn’t overridden them.
- New validation rules and visibility apply immediately via the new `mergedDescriptor` + Zod schema.

---

### 5. Diagrams

#### 5.1 Initialization

```text
[Backend: Global Descriptor]        [Backend: Prefill]
               |                             |
               v                             v
     fetchGlobalDescriptorThunk   initializeCaseContextFromPrefill
               |                             |
               v                             v
    Redux.globalDescriptor           Redux.caseContext
    Redux.mergedDescriptor
               \                             /
                \                           /
                 v                         v
              FormContainer (reads Redux)
                        |
                        v
        formKey = hash(mergedDescriptor.rules, caseContext)
                        |
                        v
            <FormInner key={formKey} ... />
                        |
                        v
   useFormDescriptor(mergedDescriptor, { caseContext, savedFormData })
          |
          +--> extractDefaultValues(descriptor, { caseContext, formData })
          +--> identifyFieldsWithTemplateDefaults(descriptor)
          +--> merge defaultValues + savedFormData -> initialValues
          |
          v
   useForm({ defaultValues: initialValues, resolver: zodResolver(...) })
```

#### 5.2 Interaction + Rehydration Loop

```text
User edits a field
      |
      v
react-hook-form updates form state
      |
      v
useWatch(...) in useFormDescriptor
      |
      v
onDiscriminantChange(formData)
      |
      +--> syncFormDataToContext({ formData })
      |         |
      |         v
      |   Redux.formData updated
      |
      +--> if discriminant fields changed:
             updatedContext = updateCaseContext(caseContext, formData)
             rehydrate(updatedContext)
                    |
                    v
         useDebouncedRehydration().mutate(caseContext)
                    |
          (debounced 500ms, deduplicated)
                    |
                    v
           triggerRehydration() -> Redux.isRehydrating = true
                    |
                    v
           POST /api/rules/context
                    |
                    v
           applyRulesUpdate({ rulesObject })
                    |
                    v
      Redux.mergedDescriptor updated (mergeDescriptorWithRules)
                    |
                    v
FormContainer recomputes formKey(mergedDescriptor, caseContext)
                    |
                    v
     key changed -> FormInner remounts
                    |
                    v
 useFormDescriptor(...) recomputes defaultValues + initialValues
                    |
                    v
   New useForm instance with:
   - preserved user values (from Redux.formData)
   - updated defaults & rules (from new descriptor/context)
```

---

### 6. Mental Model

- **`defaultValues`**: descriptor + `caseContext` + Handlebars templates + repeatable logic.
- **`initialValues`**: `defaultValues` merged with persisted `formData`:
  - Template fields: default vs override detection.
  - Non‑template fields: always take user value.
- **Every change**:
  - Pushes values to Redux.
  - If discriminant fields changed, eventually rehydrates rules and descriptor.
- **Rehydration**:
  - Changes `mergedDescriptor`/`caseContext`, forces a keyed remount.
  - `useFormDescriptor` recomputes `initialValues`, preserving user input but refreshing descriptor‑driven behavior.

