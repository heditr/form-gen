# TypeScript Type Widening: Why `FieldsInGroup` Returns `never`

## The Problem

When you write:

```typescript
const descriptor: GlobalFormDescriptor = {
  blocks: [
    {
      id: 'addresses-block',
      fields: [
        { id: 'street', type: 'text', repeatableGroupId: 'addresses', ... },
        { id: 'city', type: 'text', repeatableGroupId: 'addresses', ... },
      ],
    },
  ],
  submission: { ... },
};

type AddressFields = FieldsInGroup<typeof descriptor, 'addresses'>;
// Result: never ❌
```

The type resolves to `never` instead of the expected field union.

## Why This Happens: Type Widening

When you explicitly annotate a variable with a type (`const descriptor: GlobalFormDescriptor`), TypeScript performs **type widening**:

1. **Literal types are widened to their general types:**
   - `'addresses'` → `string`
   - `'text'` → `FieldType`
   - `'street'` → `string`

2. **The inferred type becomes:**
   ```typescript
   {
     blocks: Array<{
       fields: Array<{
         repeatableGroupId: string;  // ❌ Widened from 'addresses'
         ...
       }>
     }>
   }
   ```

3. **When `FieldsInGroup` tries to match:**
   ```typescript
   Extract<AllFields<T>, { repeatableGroupId: 'addresses' }>
   ```
   
   It's looking for `repeatableGroupId: 'addresses'` (literal type), but the actual type is `repeatableGroupId: string` (general type).

4. **Result:** No fields match, so `Extract` returns `never`.

## The Solution: Preserve Literal Types

You need to preserve literal types so TypeScript can match them exactly. Here are three approaches:

### Solution 1: Use `as const` (TypeScript 3.4+)

```typescript
const descriptor = {
  blocks: [
    {
      id: 'addresses-block',
      fields: [
        { id: 'street', type: 'text' as const, repeatableGroupId: 'addresses' as const, ... },
        { id: 'city', type: 'text' as const, repeatableGroupId: 'addresses' as const, ... },
      ],
    },
  ],
  submission: { url: '/api/submit', method: 'POST' as const },
} as const satisfies GlobalFormDescriptor;

type AddressFields = FieldsInGroup<typeof descriptor, 'addresses'>;
// Result: ✅ { id: 'street', repeatableGroupId: 'addresses', ... } | 
//            { id: 'city', repeatableGroupId: 'addresses', ... }
```

**How it works:**
- `as const` makes all properties readonly and preserves literal types
- `satisfies` checks the type without widening it
- `typeof descriptor` now has literal types: `repeatableGroupId: 'addresses'`

### Solution 2: Remove Type Annotation (Let TypeScript Infer)

```typescript
const descriptor = {
  blocks: [
    {
      id: 'addresses-block',
      fields: [
        { id: 'street', type: 'text' as const, repeatableGroupId: 'addresses' as const, ... },
        { id: 'city', type: 'text' as const, repeatableGroupId: 'addresses' as const, ... },
      ],
    },
  ],
  submission: { url: '/api/submit', method: 'POST' as const },
} as const;

// TypeScript infers the type with literal types preserved
type AddressFields = FieldsInGroup<typeof descriptor, 'addresses'>;
// Result: ✅ Works!
```

**Note:** Without `satisfies`, you lose type checking, so this is less safe.

### Solution 3: Use `satisfies` Without Explicit Annotation (TypeScript 4.9+)

```typescript
const descriptor = {
  blocks: [
    {
      id: 'addresses-block',
      fields: [
        { id: 'street', type: 'text' as const, repeatableGroupId: 'addresses' as const, ... },
        { id: 'city', type: 'text' as const, repeatableGroupId: 'addresses' as const, ... },
      ],
    },
  ],
  submission: { url: '/api/submit', method: 'POST' as const },
} as const satisfies GlobalFormDescriptor;

type AddressFields = FieldsInGroup<typeof descriptor, 'addresses'>;
// Result: ✅ Works!
```

**This is the best approach:**
- ✅ Preserves literal types
- ✅ Type-checks against `GlobalFormDescriptor`
- ✅ Works with `typeof` to extract types

## Visual Comparison

### ❌ With Type Annotation (Widened)

```typescript
const descriptor: GlobalFormDescriptor = { ... };

// TypeScript sees:
typeof descriptor = {
  blocks: Array<{
    fields: Array<{
      repeatableGroupId: string  // ❌ Widened
    }>
  }>
}

// Extract can't match 'addresses' literal
Extract<..., { repeatableGroupId: 'addresses' }>  // ❌ No match → never
```

### ✅ With `as const satisfies` (Preserved)

```typescript
const descriptor = { ... } as const satisfies GlobalFormDescriptor;

// TypeScript sees:
typeof descriptor = {
  readonly blocks: readonly [{
    readonly fields: readonly [{
      readonly repeatableGroupId: 'addresses'  // ✅ Literal preserved
    }]
  }]
}

// Extract can match 'addresses' literal
Extract<..., { repeatableGroupId: 'addresses' }>  // ✅ Match!
```

## Why `FieldsInGroup` Needs Literal Types

Looking at the implementation:

```typescript
type FieldsInGroup<T extends GlobalFormDescriptor, GroupId extends string> = 
  Extract<AllFields<T>, { repeatableGroupId: GroupId }>;
```

The `Extract` utility type uses structural matching. For it to work:

1. `GroupId` is `'addresses'` (literal type)
2. `AllFields<T>` must have fields with `repeatableGroupId: 'addresses'` (literal type)
3. If `repeatableGroupId` is widened to `string`, the match fails

## Key Takeaways

1. **Type annotations widen literal types** - `const x: Type = { ... }` widens literals
2. **`as const` preserves literal types** - Makes everything readonly and literal
3. **`satisfies` checks without widening** - Validates type while preserving literals
4. **Use `as const satisfies` together** - Best of both worlds: type safety + literal preservation

## Example: Complete Working Code

```typescript
// ✅ Correct approach
const descriptor = {
  blocks: [
    {
      id: 'addresses-block',
      title: 'Addresses',
      repeatable: true,
      fields: [
        {
          id: 'street',
          type: 'text' as const,
          label: 'Street',
          repeatableGroupId: 'addresses' as const,
          validation: [],
        },
        {
          id: 'city',
          type: 'text' as const,
          label: 'City',
          repeatableGroupId: 'addresses' as const,
          validation: [],
        },
      ],
    },
  ],
  submission: {
    url: '/api/submit',
    method: 'POST' as const,
  },
} as const satisfies GlobalFormDescriptor;

// Now this works!
type AddressFields = FieldsInGroup<typeof descriptor, 'addresses'>;
// ✅ { id: 'street', repeatableGroupId: 'addresses', ... } |
//    { id: 'city', repeatableGroupId: 'addresses', ... }

type FormDataType = FormData<typeof descriptor>;
// ✅ { addresses?: Array<{ street?: string | number | null; city?: string | number | null }> }
```

## Summary

**The issue:** Type annotations widen literal types, preventing `Extract` from matching specific literal values.

**The fix:** Use `as const satisfies GlobalFormDescriptor` to preserve literal types while maintaining type safety.
