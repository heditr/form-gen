# Nested Field Paths: Schema Tree and setNestedValue

This document explains how the form descriptor integration treats **dot-notation field IDs** (e.g. `businessAddress.line1`, `legalEntity.businessAddress.line1`) as real nested paths for react-hook-form. It covers:

1. **Setting nested values** – how `setNestedValue` builds nested default/form data from a path string.
2. **Building the Zod schema from a tree** – how `buildZodSchemaFromDescriptor` uses an intermediate tree to produce nested Zod object schemas from dotted field IDs.

---

## 1. Setting Nested Values: `setNestedValue`

### Purpose

Field IDs in the descriptor can be path-like strings. For react-hook-form, the form value shape must be nested (e.g. `{ businessAddress: { line1: '...' } }`), not flat (`{ 'businessAddress.line1': '...' }`). So whenever we write a value for a field by ID, we need to **set a property at a nested path** instead of a single top-level key.

`setNestedValue` does exactly that: given a target object, a dot-separated path, and a value, it creates any missing intermediate objects and sets the final segment to the value.

### Signature

```ts
function setNestedValue(
  target: Record<string, unknown>,
  path: string,
  value: unknown
): void
```

- **`target`** – The object to mutate (e.g. `defaultValues`, or a single row in a repeatable group).
- **`path`** – Dot-notation path (e.g. `"businessAddress.line1"`, `"legalEntity.businessAddress.line1"`).
- **`value`** – The value to assign at the leaf.

### Algorithm

1. **Split the path**  
   `path.split('.')` → e.g. `["businessAddress", "line1"]` or `["legalEntity", "businessAddress", "line1"]`.

2. **Walk the path, create missing branches**  
   For every segment **except the last**:
   - Use the segment as the key into the current object.
   - If there is no value, or the value is not a plain object (e.g. it’s an array or a primitive), **replace** it with a new empty object `{}`.
   - Move “current” into that object and repeat.

3. **Set the leaf**  
   Use the **last** segment as the key and assign `value` to it.

### Example

```ts
const obj = {};
setNestedValue(obj, 'businessAddress.line1', '123 Main St');
setNestedValue(obj, 'businessAddress.line2', 'Unit 4B');
```

Result:

```ts
{
  businessAddress: {
    line1: '123 Main St',
    line2: 'Unit 4B',
  },
}
```

If the path has no dots (e.g. `"name"`), the loop over “all but last” runs zero times, and we only set `current[lastKey] = value` on the original `target`, so we get a flat key. So **flat IDs still work** as before.

### Where It’s Used

- **Non-repeatable blocks** – Each field’s default or type-default is set with `setNestedValue(defaultValues, field.id, value)` so that `businessAddress.line1` ends up under `defaultValues.businessAddress.line1`.
- **Repeatable groups** – For each row object, we set values with `setNestedValue(row, baseFieldId, value)`. So within `addresses[0]`, a field id like `location.street` becomes `addresses[0].location.street`.
- **Normalized repeatable default source** – When mapping `sourceArray` into row objects by base field ids, each value is written with `setNestedValue(out, id, value)` so nested paths in the source are reflected in the row shape.

This keeps the form’s default and current values aligned with react-hook-form’s expected nested shape for `control` and validation.

---

## 2. Building the Zod Schema Using a Tree

### Why a Tree?

We want the **Zod schema shape** to match the **form value shape**. If a field id is `businessAddress.line1`, the schema must be something like:

```ts
z.object({
  businessAddress: z.object({
    line1: z.string(),
    // ...
  }),
})
```

So we cannot treat `"businessAddress.line1"` as a single key in a flat `schemaShape`. We need to:

- Treat the field id as a **path**.
- Build a **tree** where each path segment is a level (e.g. `businessAddress` → `line1` → leaf schema).
- Turn that tree into **nested `z.object(...)`** so that validation matches the nested form data.

The same idea applies inside **repeatable groups**: each row is an object that can have nested paths (e.g. `addresses[0].location.street`), so the **row schema** is also built from a tree of base field ids.

### Tree Data Model

We use an intermediate structure that can be either:

- A **leaf**: a Zod schema (the actual validator for one field).
- A **branch**: a plain object whose keys are path segments and whose values are again tree nodes (leaves or branches).

In code this is represented as:

- **`SchemaTreeObject`** – an interface `{ [key: string]: SchemaTreeNode }` (avoids circular type alias issues).
- **`SchemaTreeNode`** – `z.ZodTypeAny | SchemaTreeObject` (either a Zod type or another level of the tree).

Leaves are identified at runtime by the presence of Zod’s internal `_def` on the node.

### Two Core Helpers

#### 1. `addSchemaToTree(tree, path, schema)`

- **Input**: a tree root (`SchemaTreeObject`), a dot-separated `path`, and a Zod `schema` for the field.
- **Behavior**:
  - Split `path` by `'.'`.
  - Walk the tree along the path segments. For each segment except the last, create an empty object if the current node is missing or not a plain object (e.g. don’t overwrite an existing Zod schema with `{}`; in practice we only create new branches).
  - Assign `schema` to the last segment.

So one field with id `legalEntity.businessAddress.line1` adds a leaf at `tree.legalEntity.businessAddress.line1 = fieldSchema`. Another field `legalEntity.businessAddress.line2` reuses `legalEntity.businessAddress` and adds `line2`. The tree accumulates all nested paths into one structure.

#### 2. `schemaTreeToZod(node)`

- **Input**: a `SchemaTreeNode` (root of a subtree or the whole tree).
- **Behavior**:
  - If `node` is a **leaf** (has `_def`), return it as `z.ZodTypeAny`.
  - Otherwise treat `node` as a **branch**: for each key, recursively call `schemaTreeToZod(child)` and collect the results into a `shape` object.
  - Return `z.object(shape)`.

So the tree is converted recursively: leaves stay as-is, branches become `z.object({ ... })`, which matches the nested form value structure.

### How It’s Used in `buildZodSchemaFromDescriptor`

- **Non-repeatable blocks**
  - **Flat id** (no `'.'`): put the field schema directly in the top-level `schemaShape`: `schemaShape[field.id] = fieldSchema`.
  - **Nested id** (contains `'.'`): call `addSchemaToTree(nonRepeatableTree, field.id, fieldSchema)`.
  - After processing all blocks, **flush the tree** into `schemaShape`: for each top-level key in `nonRepeatableTree`, run `schemaShape[key] = schemaTreeToZod(node)`. So we get one top-level key per root segment (e.g. `businessAddress`, `legalEntity`), each a `z.object(...)` that may contain further nested objects.

- **Repeatable blocks**
  - For each repeatable group we build a **separate** `groupTree` (not shared with other groups or with non-repeatable fields).
  - For each field in the group we have a `baseFieldId` (field id without the group prefix). If `baseFieldId` contains `'.'`, we call `addSchemaToTree(groupTree, baseFieldId, fieldSchema)`; otherwise we set `groupTree[baseFieldId] = fieldSchema`.
  - The **row schema** is `rowSchema = schemaTreeToZod(groupTree)`.
  - The group’s schema is `z.array(rowSchema)` (with optional min/max for `minInstances`/`maxInstances`), and that array schema is stored in `schemaShape[groupId]`.

So:

- **Root level** can have both flat keys and nested trees; the tree is converted per root key so that e.g. `legalEntity` becomes one `z.object` with nested `businessAddress`, etc.
- **Repeatable rows** can have both flat and nested field ids; the group tree is converted once per group into a single `z.object` row schema, then wrapped in `z.array(...)`.

### Example (conceptual)

Descriptor has two non-repeatable fields:

- `businessAddress.line1` (text, required)
- `businessAddress.line2` (text)

Then:

1. `addSchemaToTree(nonRepeatableTree, 'businessAddress.line1', z.string().min(1))`
2. `addSchemaToTree(nonRepeatableTree, 'businessAddress.line2', z.string())`

So `nonRepeatableTree` looks like:

```ts
{ businessAddress: { line1: <ZodString>, line2: <ZodString> } }
```

3. When flushing: `schemaShape.businessAddress = schemaTreeToZod(nonRepeatableTree.businessAddress)`  
   → `z.object({ line1: z.string().min(1), line2: z.string() })`.

Final schema:

```ts
z.object({
  businessAddress: z.object({
    line1: z.string().min(1),
    line2: z.string(),
  }),
})
```

This matches the nested form value produced by `setNestedValue` and used by react-hook-form, so validation and defaults stay in sync with the chosen field paths.
