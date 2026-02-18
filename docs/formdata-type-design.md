# FormData Type Design: A Step-by-Step Journey

This document explains the complete design process for the `FormData` type, from the initial problem statement through every step of the solution.

## Table of Contents

1. [The Starting Point](#the-starting-point)
2. [The Problem](#the-problem)
3. [Understanding the Structure](#understanding-the-structure)
4. [Advanced TypeScript Concepts](#advanced-typescript-concepts)
5. [Step 1: Mapping Field Types to Value Types](#step-1-mapping-field-types-to-value-types)
6. [Step 2: Extracting All Fields](#step-2-extracting-all-fields)
7. [Step 3: Handling Repeatable Groups](#step-3-handling-repeatable-groups)
8. [Step 4: Building the Complete FormData Type](#step-4-building-the-complete-formdata-type)
9. [Putting It All Together](#putting-it-all-together)

---

## The Starting Point

We have a form descriptor system where forms are defined declaratively using a `GlobalFormDescriptor` structure:

```typescript
interface GlobalFormDescriptor {
  blocks: BlockDescriptor[];
  submission: SubmissionConfig;
}

interface BlockDescriptor {
  id: string;
  title: string;
  fields: FieldDescriptor[];
  repeatable?: boolean;  // Can this block be repeated?
}

interface FieldDescriptor {
  id: string;
  type: FieldType;  // 'text', 'number', 'checkbox', etc.
  label: string;
  repeatableGroupId?: string;  // Which repeatable group does this belong to?
  validation: ValidationRule[];
}
```

**The Goal**: Create a TypeScript type `FormData<T>` that automatically infers the shape of form values from a `GlobalFormDescriptor`, ensuring type safety when working with form data.

---

## The Problem

We need to transform this declarative structure:

```typescript
const descriptor: GlobalFormDescriptor = {
  blocks: [
    {
      id: 'basic-info',
      fields: [
        { id: 'name', type: 'text', ... },
        { id: 'age', type: 'number', ... },
        { id: 'isStudent', type: 'checkbox', ... }
      ]
    },
    {
      id: 'addresses-block',
      repeatable: true,
      fields: [
        { id: 'street', type: 'text', repeatableGroupId: 'addresses', ... },
        { id: 'city', type: 'text', repeatableGroupId: 'addresses', ... }
      ]
    }
  ],
  submission: { ... }
};
```

Into a type-safe form data structure:

```typescript
type ExpectedFormData = {
  name?: string;           // text field → string
  age?: number;            // number field → number
  isStudent?: boolean;     // checkbox field → boolean
  addresses?: Array<{      // repeatable group → array of objects
    street?: string;
    city?: string;
  }>;
};
```

**Key Challenges:**
1. Different field types map to different value types (text → string, checkbox → boolean, etc.)
2. Repeatable groups need to become arrays of objects
3. Non-repeatable fields need to be individual properties
4. We must avoid type conflicts between repeatable group IDs and field IDs

---

## Understanding the Structure

Before diving into the type design, let's understand the data flow:

```
GlobalFormDescriptor
  └── blocks: BlockDescriptor[]
       └── fields: FieldDescriptor[]
            ├── id: string
            ├── type: FieldType
            └── repeatableGroupId?: string
```

When a form is rendered:
- **Non-repeatable fields** become top-level properties: `{ name: "John", age: 25 }`
- **Repeatable groups** become arrays: `{ addresses: [{ street: "...", city: "..." }] }`

---

## Advanced TypeScript Concepts

Before diving into the implementation, let's understand the advanced TypeScript features that make this type system possible. These concepts are fundamental to understanding how `FormData` works.

### 1. Conditional Types (`extends`)

**What it is**: A type-level if/else statement that checks if one type extends another.

**Syntax**:
```typescript
type Result<T> = T extends U ? X : Y;
```

**Meaning**: "If `T` extends `U`, then the type is `X`, otherwise it's `Y`."

**Example**:
```typescript
type IsString<T> = T extends string ? true : false;

type A = IsString<string>;  // true
type B = IsString<number>;  // false
```

**In our code**: We use conditional types extensively to check field types and determine value types:
```typescript
F['type'] extends 'checkbox' ? boolean : ...
```

---

### 2. Distributive Conditional Types

**What it is**: When a conditional type is applied to a union type, TypeScript automatically distributes the conditional over each member of the union.

**Key insight**: This only happens when the type being checked (`T` in `T extends U`) is a **naked type parameter** (not wrapped in an array, object, etc.).

**Example - Non-distributive**:
```typescript
type NonDistributive<T> = [T] extends [string] ? T : never;

type Result = NonDistributive<string | number>;
// Result: never
// Why? [string | number] doesn't extend [string]
```

**Example - Distributive**:
```typescript
type Distributive<T> = T extends string ? T : never;

type Result = Distributive<string | number>;
// Result: string
// Why? TypeScript distributes:
//   (string extends string ? string : never) | (number extends string ? number : never)
// = string | never
// = string (never is removed from unions)
```

**Why this matters**: In `RepeatableGroupIds`, we need to check each field individually:
```typescript
AllFields<T> extends infer F
  ? F extends FieldDescriptor
    ? F extends { repeatableGroupId: infer G }
      ? G extends string ? G : never
      : never
    : never
  : never
```

Without distribution, we'd check the entire union at once, which wouldn't work. With distribution, TypeScript checks each field type separately and combines the results.

**Visual breakdown**:
```typescript
// Input union:
type Fields = FieldA | FieldB | FieldC;

// TypeScript distributes:
(FieldA extends { repeatableGroupId: infer G } ? G : never) |
(FieldB extends { repeatableGroupId: infer G } ? G : never) |
(FieldC extends { repeatableGroupId: infer G } ? G : never)

// Results:
'addresses' | never | never
// = 'addresses' (never is removed)
```

---

### 3. The `infer` Keyword

**What it is**: A keyword used within conditional types to extract and name a type from another type.

**Syntax**:
```typescript
type Extract<T> = T extends infer U ? U : never;
```

**Common pattern**: Used with `extends` to "capture" a type:
```typescript
type ExtractReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

type Func = () => string;
type Return = ExtractReturnType<Func>;  // string
```

**In `RepeatableGroupIds`**: We use `infer` twice:

```typescript
AllFields<T> extends infer F        // 1. Capture the union type
  ? F extends FieldDescriptor
    ? F extends { repeatableGroupId: infer G }  // 2. Extract the group ID type
      ? G extends string ? G : never
      : never
    : never
  : never
```

**Why `infer F` first?**
- `AllFields<T>` is a union type: `FieldA | FieldB | FieldC`
- We need to capture this union so we can distribute over it
- Without `infer F`, TypeScript might not distribute correctly

**Why `infer G` second?**
- We need to extract the type of `repeatableGroupId` from the field
- `infer G` captures whatever type `repeatableGroupId` is
- Then we check if it's a string literal type

**Step-by-step example**:
```typescript
type Field = { id: 'street', repeatableGroupId: 'addresses' };

// Step 1: Capture the field
Field extends infer F
// F = { id: 'street', repeatableGroupId: 'addresses' }

// Step 2: Check if it's a FieldDescriptor
F extends FieldDescriptor
// true, continue

// Step 3: Extract repeatableGroupId
F extends { repeatableGroupId: infer G }
// G = 'addresses' (the literal type!)

// Step 4: Ensure it's a string
G extends string
// 'addresses' extends string = true

// Result: 'addresses'
```

**Without `infer`**: We couldn't extract the group ID type - we'd only know the field has a `repeatableGroupId`, but not what its value type is.

---

### 4. Mapped Types (`[K in ...]`)

**What it is**: A way to create new types by transforming properties of existing types.

**Syntax**:
```typescript
type Mapped<T> = {
  [K in keyof T]: T[K];
};
```

**Breaking it down**:
- `K` - a type variable representing each key
- `in` - iterates over the keys
- `keyof T` - union of all keys in type `T`
- `T[K]` - the type of property `K` in `T`

**Simple example**:
```typescript
type Person = {
  name: string;
  age: number;
};

type Optional<T> = {
  [K in keyof T]?: T[K];
};

type OptionalPerson = Optional<Person>;
// Result: {
//   name?: string;
//   age?: number;
// }
```

**In our code**: We use mapped types to create object types from field unions:

```typescript
type RepeatableGroupObject<T, GroupId> = {
  [K in FieldsInGroup<T, GroupId>['id']]: 
    FieldValueType<Extract<FieldsInGroup<T, GroupId>, { id: K }>>;
};
```

**Breaking this down**:
1. `FieldsInGroup<T, GroupId>['id']` - Gets union of field IDs: `'street' | 'city'`
2. `[K in ...]` - Iterates over each ID: `K = 'street'`, then `K = 'city'`
3. `Extract<..., { id: K }>` - Gets the field descriptor for this specific ID
4. `FieldValueType<...>` - Gets the value type for that field

**Visual transformation**:
```typescript
// Input: Union of fields
type Fields = 
  { id: 'street', type: 'text', repeatableGroupId: 'addresses' } |
  { id: 'city', type: 'text', repeatableGroupId: 'addresses' };

// Step 1: Extract IDs
Fields['id']  // 'street' | 'city'

// Step 2: Map over each ID
{
  street: FieldValueType<Extract<Fields, { id: 'street' }>>;
  city: FieldValueType<Extract<Fields, { id: 'city' }>>;
}

// Step 3: Resolve FieldValueType
{
  street: string | number | null;
  city: string | number | null;
}
```

**Key insight**: Mapped types iterate over union types, creating a property for each member. This is how we transform a union of fields into an object type.

---

### 5. Indexed Access Types (`T['key']`)

**What it is**: A way to extract the type of a property from another type.

**Syntax**:
```typescript
type PropType = T['propertyName'];
```

**Example**:
```typescript
type Person = {
  name: string;
  age: number;
};

type NameType = Person['name'];  // string
type AgeType = Person['age'];    // number
```

**With unions**: When accessing a property on a union, you get a union of property types:
```typescript
type Fields = 
  { id: 'street', type: 'text' } |
  { id: 'city', type: 'text' };

type Ids = Fields['id'];  // 'street' | 'city'
```

**In our code**: We use indexed access to extract field IDs:
```typescript
FieldsInGroup<T, GroupId>['id']
// Gets union of all field IDs in the group
```

---

### 6. Utility Types: `Extract`, `Exclude`, `Omit`

**`Extract<T, U>`**: Keeps only types from `T` that are assignable to `U`
```typescript
type A = Extract<'a' | 'b' | 'c', 'a' | 'b'>;  // 'a' | 'b'
```

**`Exclude<T, U>`**: Removes types from `T` that are assignable to `U`
```typescript
type A = Exclude<'a' | 'b' | 'c', 'a'>;  // 'b' | 'c'
```

**`Omit<T, K>`**: Removes properties `K` from type `T`
```typescript
type Person = { name: string; age: number; email: string };
type WithoutEmail = Omit<Person, 'email'>;  
// { name: string; age: number }
```

**In our code**:
- `Extract` - Filters fields by `repeatableGroupId`
- `Exclude` - Removes fields with `repeatableGroupId`
- `Omit` - Prevents ID conflicts in the final type

---

### 7. Intersection Types (`&`)

**What it is**: Combines multiple types into one, requiring all properties to be present.

**Syntax**:
```typescript
type Combined = A & B;
```

**Example**:
```typescript
type A = { x: number };
type B = { y: string };
type Combined = A & B;
// { x: number; y: string }
```

**In our code**: We use intersection to combine repeatable groups and non-repeatable fields:
```typescript
{
  [K in RepeatableGroupIds<T>]?: Array<...>;
} & {
  [K in NonRepeatableFields<T>['id']]?: ...;
}
```

**Why not union (`|`)?**
- Union means "one OR the other"
- Intersection means "both at the same time"
- Form data has both repeatable groups AND regular fields simultaneously

---

### 8. The `never` Type

**What it is**: A type that represents values that never occur. In unions, `never` is automatically removed.

**Properties**:
- `never | T` = `T` (never adds nothing to a union)
- `never & T` = `never` (intersecting with never gives never)
- Used to filter out unwanted types

**In our code**: We use `never` to exclude fields that don't match our criteria:
```typescript
F extends { repeatableGroupId: infer G }
  ? G extends string ? G : never  // If not string, contribute nothing
  : never                          // If no repeatableGroupId, contribute nothing
```

**Example**:
```typescript
type FilterStrings<T> = T extends string ? T : never;

type Result = FilterStrings<string | number | boolean>;
// = (string extends string ? string : never) |
//   (number extends string ? number : never) |
//   (boolean extends string ? boolean : never)
// = string | never | never
// = string (never is removed)
```

---

## Step 1: Mapping Field Types to Value Types

**Problem**: Each field type (`'text'`, `'number'`, `'checkbox'`, etc.) should map to its corresponding JavaScript value type.

**Solution**: Create a helper type `FieldValueType<F>` that extracts the value type from a field descriptor:

```typescript
type FieldValueType<F extends FieldDescriptor> = 
  F['type'] extends 'checkbox'
    ? boolean
    : F['type'] extends 'file'
    ? string | string[] | null
    : F['type'] extends 'radio'
    ? string | number
    : F['type'] extends 'number'
    ? number
    : string | number | null;
```

**Why this works:**
- Uses conditional types (`extends`) to check the field type
- Returns the appropriate TypeScript type based on the field type
- Handles special cases (files store URLs as strings, radio can be string or number)

**Example:**
```typescript
type TextField = { id: 'name', type: 'text', ... };
type CheckboxField = { id: 'isStudent', type: 'checkbox', ... };

type NameValue = FieldValueType<TextField>;        // string | number | null
type IsStudentValue = FieldValueType<CheckboxField>; // boolean
```

---

## Step 2: Extracting All Fields

**Problem**: We need to get all fields from all blocks in a flat union type.

**Solution**: Create `AllFields<T>` that extracts all field descriptors:

```typescript
type AllFields<T extends GlobalFormDescriptor> = 
  T['blocks'][number]['fields'][number];
```

**Breaking it down:**
- `T['blocks']` → array of `BlockDescriptor`
- `T['blocks'][number]` → union of all `BlockDescriptor` types (distributes over the array)
- `T['blocks'][number]['fields']` → array of `FieldDescriptor` for each block
- `T['blocks'][number]['fields'][number]` → union of all `FieldDescriptor` types

**Example:**
```typescript
const descriptor = {
  blocks: [
    { fields: [{ id: 'name', type: 'text' }, { id: 'age', type: 'number' }] },
    { fields: [{ id: 'city', type: 'text' }] }
  ]
};

type AllFields = AllFields<typeof descriptor>;
// Result: { id: 'name', type: 'text' } | { id: 'age', type: 'number' } | { id: 'city', type: 'text' }
```

---

## Step 3: Handling Repeatable Groups

This is the most complex part. We need to:

1. **Extract all repeatable group IDs** from the descriptor
2. **Group fields by their `repeatableGroupId`**
3. **Create object types for each group**
4. **Separate repeatable fields from non-repeatable fields**

### Step 3.1: Extract Repeatable Group IDs

**Problem**: Find all unique `repeatableGroupId` values from all fields.

**Solution**: Use distributive conditional types to extract group IDs:

```typescript
type RepeatableGroupIds<T extends GlobalFormDescriptor> = 
  AllFields<T> extends infer F
    ? F extends FieldDescriptor
      ? F extends { repeatableGroupId: infer G }
        ? G extends string
          ? G
          : never
        : never
      : never
    : never;
```

**Why this complex pattern?**

This pattern leverages several advanced TypeScript features (see [Advanced TypeScript Concepts](#advanced-typescript-concepts) for details):

1. **`AllFields<T> extends infer F`** - Uses `infer` to capture the union type so we can distribute over it
2. **`F extends FieldDescriptor`** - Enables distributive conditional types, checking each field separately
3. **`F extends { repeatableGroupId: infer G }`** - Uses `infer` again to extract the type of `repeatableGroupId` from the field
4. **`G extends string`** - Ensures the extracted type is a string literal (like `'addresses'`)
5. **Returns `G` or `never`** - Contributes the group ID to the union, or `never` if the field doesn't match

**The `never` type**: When used in a union, `never` is automatically excluded. So if a field doesn't have `repeatableGroupId`, it contributes `never` to the union, effectively filtering it out.

**Why we need `infer F`**: Without capturing the union first, TypeScript might not distribute the conditional type correctly. The `infer F` pattern ensures we get proper distribution over each field in the union.

**Step-by-step with a real example**:
```typescript
// Input: Union of fields
type Fields = 
  { id: 'street', repeatableGroupId: 'addresses' } |
  { id: 'city', repeatableGroupId: 'addresses' } |
  { id: 'name' };  // no repeatableGroupId

// Step 1: Capture union
Fields extends infer F
// F = Fields (the entire union)

// Step 2: Distribute over union
F extends FieldDescriptor
// TypeScript distributes:
//   FieldA extends FieldDescriptor ? ... : never |
//   FieldB extends FieldDescriptor ? ... : never |
//   FieldC extends FieldDescriptor ? ... : never

// Step 3: Extract repeatableGroupId (only for fields that have it)
F extends { repeatableGroupId: infer G }
// For FieldA: G = 'addresses'
// For FieldB: G = 'addresses'  
// For FieldC: never (doesn't match pattern)

// Step 4: Ensure string
G extends string
// 'addresses' extends string = true
// Result: 'addresses' | 'addresses' | never = 'addresses'
```

**Example:**
```typescript
const descriptor = {
  blocks: [{
    fields: [
      { id: 'street', repeatableGroupId: 'addresses' },
      { id: 'city', repeatableGroupId: 'addresses' },
      { id: 'name' }  // no repeatableGroupId
    ]
  }]
};

type GroupIds = RepeatableGroupIds<typeof descriptor>;
// Result: 'addresses'
```

### Step 3.2: Extract Fields in a Specific Group

**Problem**: Get all fields that belong to a specific repeatable group.

**Solution**: Use `Extract` utility type:

```typescript
type FieldsInGroup<T extends GlobalFormDescriptor, GroupId extends string> = 
  Extract<AllFields<T>, { repeatableGroupId: GroupId }>;
```

**How it works:**
- `Extract<Union, Condition>` - filters the union to only types matching the condition
- `{ repeatableGroupId: GroupId }` - matches fields with this specific group ID

**Example:**
```typescript
type AddressFields = FieldsInGroup<typeof descriptor, 'addresses'>;
// Result: { id: 'street', repeatableGroupId: 'addresses', ... } | 
//         { id: 'city', repeatableGroupId: 'addresses', ... }
```

### Step 3.3: Create Object Type for a Repeatable Group

**Problem**: Transform fields in a group into an object type mapping field IDs to their value types.

**Solution**: Use mapped types:

```typescript
type RepeatableGroupObject<T extends GlobalFormDescriptor, GroupId extends string> = {
  [K in FieldsInGroup<T, GroupId>['id']]: 
    FieldValueType<Extract<FieldsInGroup<T, GroupId>, { id: K }>>;
};
```

**Breaking it down:**
- `FieldsInGroup<T, GroupId>['id']` - Uses indexed access to get union of all field IDs (`'street' | 'city'`)
- `[K in ...]` - Uses a mapped type to iterate over each field ID (see [Mapped Types](#4-mapped-types-k-in-) for details)
- `Extract<FieldsInGroup<...>, { id: K }>` - Gets the specific field descriptor for ID `K` from the union
- `FieldValueType<...>` - Gets the value type for that field using conditional types

**How mapped types work here**: The `[K in ...]` syntax creates a property for each member of the union. TypeScript iterates over `'street' | 'city'` and creates properties for both.

**Example:**
```typescript
type AddressGroup = RepeatableGroupObject<typeof descriptor, 'addresses'>;
// Result: {
//   street: string | number | null;
//   city: string | number | null;
// }
```

### Step 3.4: Extract Non-Repeatable Fields

**Problem**: Get all fields that don't belong to any repeatable group.

**Solution**: Use `Exclude` utility type:

```typescript
type NonRepeatableFields<T extends GlobalFormDescriptor> = 
  Exclude<AllFields<T>, { repeatableGroupId: string }>;
```

**How it works:**
- `Exclude<Union, Condition>` - removes types matching the condition from the union
- `{ repeatableGroupId: string }` - matches any field with a `repeatableGroupId`
- Result: only fields without `repeatableGroupId`

**Example:**
```typescript
type RegularFields = NonRepeatableFields<typeof descriptor>;
// Result: { id: 'name', ... } (excludes 'street' and 'city' which have repeatableGroupId)
```

---

## Step 4: Building the Complete FormData Type

Now we combine everything into the final `FormData` type:

```typescript
export type FormData<T extends GlobalFormDescriptor = GlobalFormDescriptor> = 
  // Part 1: Add repeatable groups as arrays of objects
  {
    [K in RepeatableGroupIds<T>]?: Array<RepeatableGroupObject<T, K>>;
  } & 
  // Part 2: Add non-repeatable fields as individual properties
  // Use Omit to exclude repeatable group IDs to prevent type conflicts
  Omit<
    {
      [K in NonRepeatableFields<T>['id']]?: FieldValueType<Extract<NonRepeatableFields<T>, { id: K }>>;
    },
    RepeatableGroupIds<T>
  >;
```

### Understanding the Intersection (`&`)

The `&` operator creates an intersection type - both parts must be satisfied:

```typescript
type A = { addresses?: Array<{...}> };
type B = { name?: string };
type Combined = A & B;  // { addresses?: Array<{...}>, name?: string }
```

### Understanding the `Omit`

**Why do we need `Omit`?**

Consider this scenario:
- A repeatable group ID is `'addresses'`
- A non-repeatable field also has ID `'addresses'`

Without `Omit`, we'd have:
```typescript
{
  addresses?: Array<{...}>;  // from repeatable groups
  addresses?: string;        // from non-repeatable fields
}
```

This creates a type conflict! TypeScript would try to intersect:
```typescript
Array<{...}> & string  // This is impossible!
```

**Solution**: Use `Omit` to exclude repeatable group IDs from the non-repeatable fields object:

```typescript
Omit<
  { [K in NonRepeatableFields<T>['id']]?: ... },
  RepeatableGroupIds<T>  // Remove any IDs that are also group IDs
>
```

This ensures that if a field ID conflicts with a group ID, the repeatable group takes precedence.

---

## Putting It All Together

Let's trace through a complete example:

### Input Descriptor

```typescript
const descriptor: GlobalFormDescriptor = {
  blocks: [
    {
      id: 'basic-info',
      fields: [
        { id: 'name', type: 'text', validation: [] },
        { id: 'age', type: 'number', validation: [] },
        { id: 'isStudent', type: 'checkbox', validation: [] }
      ]
    },
    {
      id: 'addresses-block',
      repeatable: true,
      fields: [
        { id: 'street', type: 'text', repeatableGroupId: 'addresses', validation: [] },
        { id: 'city', type: 'text', repeatableGroupId: 'addresses', validation: [] },
        { id: 'zipCode', type: 'text', repeatableGroupId: 'addresses', validation: [] }
      ]
    }
  ],
  submission: { url: '/api/submit', method: 'POST' }
};
```

### Step-by-Step Type Evaluation

1. **AllFields**: 
   ```typescript
   // Union of all fields:
   { id: 'name', type: 'text' } |
   { id: 'age', type: 'number' } |
   { id: 'isStudent', type: 'checkbox' } |
   { id: 'street', type: 'text', repeatableGroupId: 'addresses' } |
   { id: 'city', type: 'text', repeatableGroupId: 'addresses' } |
   { id: 'zipCode', type: 'text', repeatableGroupId: 'addresses' }
   ```

2. **RepeatableGroupIds**:
   ```typescript
   // Extracts: 'addresses'
   ```

3. **RepeatableGroupObject<'addresses'>**:
   ```typescript
   {
     street: string | number | null;
     city: string | number | null;
     zipCode: string | number | null;
   }
   ```

4. **NonRepeatableFields**:
   ```typescript
   // Excludes fields with repeatableGroupId:
   { id: 'name', type: 'text' } |
   { id: 'age', type: 'number' } |
   { id: 'isStudent', type: 'checkbox' }
   ```

5. **Final FormData**:
   ```typescript
   {
     // From repeatable groups:
     addresses?: Array<{
       street?: string | number | null;
       city?: string | number | null;
       zipCode?: string | number | null;
     }>;
   } & {
     // From non-repeatable fields:
     name?: string | number | null;
     age?: number;
     isStudent?: boolean;
   }
   ```

### Result

```typescript
type MyFormData = FormData<typeof descriptor>;

// TypeScript infers:
{
  addresses?: Array<{
    street?: string | number | null;
    city?: string | number | null;
    zipCode?: string | number | null;
  }>;
  name?: string | number | null;
  age?: number;
  isStudent?: boolean;
}
```

---

## Key Design Decisions

### 1. Why Optional Properties (`?`)?

All properties are optional because:
- Forms start empty
- Fields can be conditionally hidden
- Users may not fill all fields

### 2. Why Intersection Instead of Union?

Intersection (`&`) combines both parts:
- Repeatable groups AND non-repeatable fields coexist
- Union (`|`) would mean "one OR the other", which is incorrect

### 3. Why `Omit` for Conflict Resolution?

- Prevents type conflicts when field IDs match group IDs
- Ensures repeatable groups take precedence
- Maintains type safety

### 4. Why Distributive Conditional Types?

- Allows TypeScript to distribute over union types (see [Distributive Conditional Types](#2-distributive-conditional-types) for details)
- Enables extracting group IDs from multiple fields by checking each field individually
- Critical for handling complex form structures with many fields
- Without distribution, we'd check the entire union at once, which wouldn't work for extracting individual properties

### 5. Why `infer` in RepeatableGroupIds?

- The first `infer F` captures the union type to enable proper distribution (see [The `infer` Keyword](#3-the-infer-keyword) for details)
- The second `infer G` extracts the actual type of `repeatableGroupId` from each field
- Without `infer`, we couldn't extract the group ID type - we'd only know a field has `repeatableGroupId`, but not what its value is
- This pattern is essential for extracting types from nested structures

### 6. Why Mapped Types (`[K in ...]`)?

- Mapped types iterate over union types, creating a property for each member (see [Mapped Types](#4-mapped-types-k-in-) for details)
- This transforms a union of fields into an object type with properties for each field ID
- Essential for creating the shape of repeatable group objects

---

## Real-World Usage

```typescript
// Type-safe form data access
const formData: FormData<typeof descriptor> = {
  name: 'John Doe',
  age: 25,
  isStudent: true,
  addresses: [
    { street: '123 Main St', city: 'New York', zipCode: '10001' },
    { street: '456 Oak Ave', city: 'Boston', zipCode: '02101' }
  ]
};

// TypeScript knows the types:
formData.name?.toUpperCase();           // ✅ string methods available
formData.age?.toFixed(2);                // ✅ number methods available
formData.isStudent === true;             // ✅ boolean comparison
formData.addresses?.[0]?.street;         // ✅ nested access
formData.addresses?.map(addr => addr.city); // ✅ array methods
```

---

## Summary

The `FormData` type design follows these principles:

1. **Type Safety**: Automatically infers correct types from the descriptor
2. **Composability**: Handles both repeatable and non-repeatable fields
3. **Conflict Resolution**: Uses `Omit` to prevent ID conflicts
4. **Distributivity**: Leverages TypeScript's distributive conditional types
5. **Flexibility**: Works with any `GlobalFormDescriptor` structure

The complexity comes from TypeScript's type system capabilities, but the result is a type-safe form data structure that automatically adapts to any form descriptor configuration.

---

## Quick Reference: When to Use Each Concept

### Use Conditional Types (`extends`) when:
- You need to check if one type extends another
- You want to return different types based on a condition
- Example: `T extends string ? T : never`

### Use Distributive Conditional Types when:
- You need to process each member of a union separately
- You want to filter or transform union types
- Example: `T extends U ? X : never` where `T` is a union

### Use `infer` when:
- You need to extract a type from within another type
- You want to capture a type for later use in a conditional
- Example: `T extends (...args: any[]) => infer R ? R : never`

### Use Mapped Types (`[K in ...]`) when:
- You need to transform an object type property by property
- You want to create a new type from a union of keys
- Example: `{ [K in keyof T]: T[K] }`

### Use Indexed Access (`T['key']`) when:
- You need to extract the type of a property
- You want to get a union of property types from a union of objects
- Example: `Fields['id']` → `'street' | 'city'`

### Use `Extract`/`Exclude` when:
- You need to filter a union type
- You want to keep or remove specific types
- Example: `Extract<T, U>` keeps matching types, `Exclude<T, U>` removes them

### Use `Omit` when:
- You need to remove properties from an object type
- You want to prevent type conflicts
- Example: `Omit<Person, 'email'>`

### Use Intersection (`&`) when:
- You need to combine multiple types
- You want all properties from multiple types
- Example: `A & B` combines properties from both

### Use `never` when:
- You want to exclude types from a union
- You need to represent impossible types
- Example: `T extends string ? T : never` filters out non-strings
