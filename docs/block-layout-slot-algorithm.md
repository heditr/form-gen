# Block Layout Slot Algorithm

This document explains step-by-step how `buildBlockLayoutRows` (in `src/utils/block-layout.ts`)
converts a `BlockDescriptor` and its `FieldDescriptor[]` array into a list of `LayoutRow` objects,
each containing one or more `LayoutSlot`s that the `Block` component renders as a CSS grid.

---

## Key Data Structures

```
GlobalFormDescriptor
  └─ BlockDescriptor          (block.layout.mode, .columns, .gap)
       └─ FieldDescriptor[]   (field.layout.width, .groupId, .groupRole)
```

**Output** — a `LayoutRow[]` tree:

```
LayoutRow[]
  └─ LayoutRow
       ├─ gridColumns? : 1 | 2 | 3        (optional row-level grid override)
       └─ LayoutSlot[]
            ├─ id       : 'left' | 'right' | 'col1' | 'col2' | 'col3'
            ├─ fields   : FieldDescriptor[]   (1..N fields stacked inside the slot)
            └─ colSpan? : number              (CSS grid column span override)
```

---

## Step 0 — Entry Conditions

The algorithm is invoked only when the block's layout mode is `'grid'`:

```
block.layout?.mode === 'grid'
```

When `mode` is `'default'` (or omitted), every field gets its own row with a single `col1` slot
and the algorithm exits immediately:

```
fields.map(field => ({ slots: [{ id: 'col1', fields: [field] }] }))
```

No pairing, no grouping, no column logic — just one field per row.

---

## Step 1 — Determine the Column Count

```
columns = block.layout?.columns ?? 1
→ clamp to 1 | 2 | 3
```

| Configured value | Resolved columns |
|-----------------|-----------------|
| undefined / 1   | 1               |
| 2               | 2               |
| 3 (or more)     | 3               |

The column count drives every downstream decision:

- Which field widths are "pairable" (can be combined into a single row).
- How many fields fill a pair buffer before it flushes.
- Which slot IDs are used.

---

## Step 2 — Pre-group Fields by `groupId`

Before processing starts, all fields that carry a `layout.groupId` are collected into a map:

```
Map<groupId, FieldDescriptor[]>
```

Fields are added to the map **in the order they appear in the descriptor**, so the relative order
within a group is always preserved. Fields without a `groupId` are not added to the map.

This map is read-only during the main loop — it exists only so that when the first member of a
group is encountered the engine already knows all other members that belong to the same group.

---

## Step 3 — Initialise Loop State

Three pieces of mutable state are created:

| Variable         | Type                  | Purpose                                                  |
|------------------|-----------------------|----------------------------------------------------------|
| `rows`           | `LayoutRow[]`         | Accumulates the final result.                            |
| `emittedGroups`  | `Set<string>`         | Tracks which `groupId`s have already been emitted.       |
| `pairBuffer`     | `FieldDescriptor[]`   | Temporary buffer for consecutive pairable ungrouped fields. |

`pairBuffer` is now **homogeneous**: it only stores one width at a time (`half` or `third`).
When width changes, the buffer flushes first to prevent mixed-width rows.

---

## Step 4 — Main Loop (Process Each Field in Descriptor Order)

For every `field` in the filtered `fields` array:

### 4a — Grouped Field Branch

**Condition:** `field.layout?.groupId` is defined.

1. **Already emitted?** → skip (`continue`). Subsequent members of a group are no-ops; the
   entire group was already emitted when the first member was encountered.

2. **First encounter:**
   a. Flush the pair buffer (see Step 5).
   b. Mark the group as emitted: `emittedGroups.add(groupId)`.
   c. Call `emitGroupRow(groupedById.get(groupId))` (see Step 6).

### 4b — Ungrouped Field Branch

**Condition:** field has no `groupId`.

Determine the field's semantic width:
```
width = field.layout?.width ?? 'full'   →  'full' | 'half' | 'third'
```

Determine if the field is pairable and its pack size:

| columns | pairable widths | pack size |
|---------|-----------------|-----------|
| 2       | `'half'`, `'third'` | `2` for half, `3` for third |
| 3       | `'half'`, `'third'` | `2` for half, `3` for third |
| 1       | none            | —         |

**If pairable:**
- If buffer already contains a different width (`half` vs `third`), flush first.
- Push the field onto `pairBuffer`.
- If `pairBuffer.length === packSize(width)` → flush immediately (see Step 5).

**If not pairable (full-width or mismatched width):**
- Flush `pairBuffer` first.
- Emit a single-slot row:
  ```
  { slots: [{ id: 'col1', fields: [field], colSpan: columns > 1 ? columns : undefined }] }
  ```
  A full-width field in a 2-column grid gets `colSpan: 2`; in a 3-column grid `colSpan: 3`.

---

## Step 5 — `flushPairBuffer()`

Called whenever a group or full-width field interrupts the buffer, or when the buffer reaches
`maxPairSize`, or at the very end of the loop.

If the buffer is empty, nothing happens.

### 2-column flush

`half` buffer:

| Buffer length | Result |
|---------------|--------|
| 1             | `[{ id: 'left', fields: [item0] }]` |
| 2             | `[{ id: 'left', fields: [item0] }, { id: 'right', fields: [item1] }]` |

`third` buffer:

| Buffer length | Result |
|---------------|--------|
| 1             | `[{ id: 'col1', fields: [item0] }]` |
| 2             | `[{ id: 'col1', ... }, { id: 'col2', ... }]` |
| 3             | `[{ id: 'col1', ... }, { id: 'col2', ... }, { id: 'col3', ... }]` + `gridColumns: 3` on row |

### 3-column flush

`half` buffer:

| Buffer length | Result |
|---------------|--------|
| 1             | `[{ id: 'col1', fields: [item0], colSpan: 2 }]` |
| 2             | `[{ id: 'col1', ... }, { id: 'col2', ... }]` |

`third` buffer:

| Buffer length | Result |
|---------------|--------|
| 1             | `[{ id: 'col1', fields: [item0] }]` |
| 2             | `[{ id: 'col1', ... }, { id: 'col2', ... }]` |
| 3             | `[{ id: 'col1', ... }, { id: 'col2', ... }, { id: 'col3', ... }]` |

After flushing, `pairBuffer` is reset to `[]`.

---

## Step 6 — `emitGroupRow(groupFields)`

Handles the richer layout cases where fields within a group need special arrangement.

### 1-column groups

Each field in the group becomes its own `col1` row. Groups have no effect on layout at
single-column width.

### 2-column groups

The engine checks for two recognised patterns in order:

**Pattern A — leftStack + right**

Condition: at least one field has `groupRole: 'leftStack'` AND `width: 'half'`, and exactly one
field has `groupRole: 'right'` AND `width: 'half'`.

```
Row:
  left slot  → [field_leftStack_1, field_leftStack_2, ...]   (stacked vertically)
  right slot → [field_right]
```

This is the canonical pattern for placing a tall stack of small fields next to one taller field.

**Pattern B — two plain half-width fields**

Condition: exactly 2 fields, neither has a `groupRole`, both have `width: 'half'`.

```
Row:
  left slot  → [fieldA]
  right slot → [fieldB]
```

**General grouped packing**

If role-based patterns don't match, grouped fields are processed with the same homogeneous rules
as ungrouped fields:

- `half` packs as `left/right` pairs (leftover half stays alone in `left`)
- `third` packs as triplets (`col1/col2/col3`)
- mixed `half` and `third` do **not** share the same buffered row
- for `third` triplets in a 2-column block, row gets `gridColumns: 3`
- non-pairable fields still fall back to full-width (`colSpan: 2`)

### 3-column groups

Grouped fields use homogeneous buffering:

- `half` packs as 2 (`col1/col2`, leftover half uses `col1` with `colSpan: 2`)
- `third` packs as 3 (`col1/col2/col3`)
- mixed widths do not share buffer rows
- non-pairable fields fall back to full-width (`colSpan: 3`)

---

## Step 7 — Post-loop Flush

After iterating all fields, `flushPairBuffer()` is called one final time to emit any
trailing pairable fields that never reached `maxPairSize`.

Example: a 2-column grid with a single `'half'`-width field at the end would sit in the
buffer until this final flush, producing a row with only a `left` slot.

---

## Full Decision Tree

```
buildBlockLayoutRows(block, fields)
│
├─ mode !== 'grid'
│    └─ return one row per field, each with a single col1 slot
│
└─ mode === 'grid'
     │
     ├─ resolve columns (1 | 2 | 3)
     ├─ pre-group fields by groupId
     │
     └─ for each field in order:
          │
          ├─ has groupId?
          │    ├─ already emitted → skip
          │    └─ first encounter:
          │         ├─ flushPairBuffer()
          │         └─ emitGroupRow(allGroupFields)
          │              ├─ columns === 1 → one col1 row per field
          │              ├─ columns === 2
          │              │    ├─ leftStack+right pattern → one row, two slots
          │              │    ├─ two plain half fields   → one row, two slots
          │              │    └─ homogeneous group packing:
          │              │         - half pairs
          │              │         - third triplets (row.gridColumns=3)
          │              │         - no half+third mixing
          │              │         - full-width fallback for non-pairable fields
          │              └─ columns === 3
          │                   └─ homogeneous group packing:
          │                        - half pairs
          │                        - third triplets
          │                        - no half+third mixing
          │                        - full-width fallback for non-pairable fields
          │
          └─ no groupId:
               ├─ pairable (half|third for columns > 1)?
               │    ├─ flush if buffer width changes
               │    ├─ push to pairBuffer
               │    └─ buffer reaches pack size → flushPairBuffer()
               └─ not pairable:
                    ├─ flushPairBuffer()
                    └─ emit single-slot row (colSpan=columns if >1)
     │
     └─ flushPairBuffer()   ← trailing fields
```

---

## Configuration Reference

### `BlockDescriptor.layout`

| Property  | Type                   | Default     | Effect                                      |
|-----------|------------------------|-------------|---------------------------------------------|
| `mode`    | `'default' \| 'grid'`  | `'default'` | Enables the grid algorithm when `'grid'`.   |
| `columns` | `1 \| 2 \| 3`         | `1`         | Sets the column count for the grid.         |
| `gap`     | `'sm' \| 'md' \| 'lg'` | `'md'`      | Controls vertical gap between rows (CSS). Not used by the slot algorithm itself. |

### `FieldDescriptor.layout`

| Property    | Type                                          | Default   | Effect                                              |
|-------------|-----------------------------------------------|-----------|-----------------------------------------------------|
| `width`     | `'full' \| 'half' \| 'third'`                | `'full'`  | Determines if a field is pairable or full-spanning. |
| `groupId`   | `string`                                      | —         | Associates the field with a named layout group.     |
| `groupRole` | `'left' \| 'right' \| 'leftStack' \| 'rightStack'` | — | Declares the field's role within a 2-column group.  |

---

## Worked Examples

### Example 1 — Default mode

```json
{ "layout": { "mode": "default" } }
```

Fields: `[A, B, C]`

Result:
```
Row 0: [col1: A]
Row 1: [col1: B]
Row 2: [col1: C]
```

---

### Example 2 — 2-column grid, all half-width

```json
{ "layout": { "mode": "grid", "columns": 2 } }
```

Fields: `[A(half), B(half), C(half), D(full)]`

Processing:
1. A → pairable → buffer: [A]
2. B → pairable → buffer: [A, B] → **flush** → Row 0: [left: A, right: B]
3. C → pairable → buffer: [C]
4. D → not pairable → flush buffer → Row 1: [left: C]; then Row 2: [col1/colSpan=2: D]

Result:
```
Row 0: [left: A] [right: B]
Row 1: [left: C]
Row 2: [col1 (span 2): D]
```

---

### Example 3 — 2-column group with leftStack+right

```json
{ "layout": { "mode": "grid", "columns": 2 } }
```

Fields:
```
City      (groupId: "addr", groupRole: "leftStack", width: "half")
PostCode  (groupId: "addr", groupRole: "leftStack", width: "half")
Country   (groupId: "addr", groupRole: "right",     width: "half")
```

Processing:
1. City → first encounter of group "addr" → emitGroupRow([City, PostCode, Country])
   - leftStack pattern matches → Row 0: [left: [City, PostCode], right: [Country]]
2. PostCode → group already emitted → skip
3. Country  → group already emitted → skip

Result:
```
Row 0: [left: City + PostCode (stacked)] [right: Country]
```

---

### Example 4 — 2-column grid with third triplet override

```json
{ "layout": { "mode": "grid", "columns": 2 } }
```

Fields: `[A(third), B(third), C(third), D(half)]`

Result:
```
Row 0: gridColumns=3, [col1: A] [col2: B] [col3: C]
Row 1: [left: D]
```

---

### Example 5 — 3-column grid, mixed homogeneous runs

```json
{ "layout": { "mode": "grid", "columns": 3 } }
```

Fields: `[A(half), B(half), C(third), D(third), E(third), F(full)]`

Processing:
1. A(half) + B(half) → half pair flush → Row 0: [col1: A] [col2: B]
2. C/D/E (third run) → third triplet flush → Row 1: [col1: C] [col2: D] [col3: E]
3. F(full) → Row 2: [col1 (span 3): F]

Result:
```
Row 0: [col1: A] [col2: B]
Row 1: [col1: C] [col2: D] [col3: E]
Row 2: [col1 (span 3): F]
```
