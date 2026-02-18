/**
 * Type definitions for the KYC Form Engine form descriptor system
 * 
 * These types define the hierarchical structure: GlobalFormDescriptor → Blocks → Fields,
 * with optional SubFormDescriptor support for reusable form fragments.
 * with support for dynamic data sources, validation rules, and status templates.
 */

/**
 * Validation rule types supported by the form engine
 */
export type ValidationRuleType = 
  | 'required'
  | 'minLength'
  | 'maxLength'
  | 'pattern'
  | 'custom';

/**
 * Discriminated union for validation rules with type-specific value types
 */
export type ValidationRule =
  | {
      type: 'required';
      message: string;
    }
  | {
      type: 'minLength';
      value: number;
      message: string;
    }
  | {
      type: 'maxLength';
      value: number;
      message: string;
    }
  | {
      type: 'pattern';
      value: RegExp | string;
      message: string;
    }
  | {
      type: 'custom';
      value: (value: unknown) => boolean | string;
      message: string;
    };

/**
 * Field types supported by the form engine
 */
export type FieldType = 
  | 'text'
  | 'dropdown'
  | 'autocomplete'
  | 'radio'
  | 'checkbox'
  | 'date'
  | 'file'
  | 'number'
  | 'button';

/**
 * Static item for dropdown, radio, or autocomplete fields
 */
export interface FieldItem {
  label: string;
  value: string | number | boolean;
}

/**
 * Type-safe default value based on field type
 */
export type FieldDefaultValue<T extends FieldType> =
  T extends 'text' | 'dropdown' | 'autocomplete' | 'date'
    ? string
    : T extends 'checkbox'
    ? boolean
    : T extends 'radio'
    ? string | number
    : T extends 'file'
    ? string | string[] | null
    : T extends 'number'
    ? number
    : unknown;

/**
 * Data source configuration for dynamic field data
 * 
 * @property url - Handlebars-templated URL for fetching data
 * @property itemsTemplate - Handlebars template for transforming API response
 * @property iteratorTemplate - Optional template for iterating over array responses
 * @property dataSourceId - Unique identifier for the data source (used to look up auth credentials server-side)
 * @property auth - Optional authentication configuration (deprecated: use dataSourceId instead)
 */
export interface DataSourceConfig {
  url: string;
  itemsTemplate: string;
  iteratorTemplate?: string;
  dataSourceId?: string;
  auth?: {
    type: 'bearer' | 'apikey' | 'basic';
    token?: string;
    headerName?: string;
    username?: string;
    password?: string;
  };
}

/**
 * Status template configuration for blocks and fields
 * 
 * @property hidden - Handlebars template evaluating to boolean string for visibility
 * @property disabled - Handlebars template evaluating to boolean string for enabled state
 * @property readonly - Optional Handlebars template evaluating to boolean string for readonly state
 */
export interface StatusTemplates {
  hidden?: string;
  disabled?: string;
  readonly?: string;
}

/**
 * Button menu item configuration
 * 
 * @property label - Display label for the menu item
 * @property popinBlockId - ID of the popin block to open when item is selected
 * @property status - Optional status templates for conditional visibility of menu item
 */
export interface ButtonMenuItem {
  label: string;
  popinBlockId: string;
  status?: StatusTemplates;
}

/**
 * Button field configuration
 * 
 * @property variant - Button variant: 'single' for single button, 'menu' for dropdown menu, 'link' for link-style button
 * @property popinBlockId - For single/link variant: ID of the popin block to open when button is clicked
 * @property items - For menu variant: Array of menu items, each with label and popinBlockId
 */
export interface ButtonConfig {
  variant: 'single' | 'menu' | 'link';
  popinBlockId?: string;
  items?: ButtonMenuItem[];
}

/**
 * Field descriptor definition
 * 
 * @property id - Unique identifier for the field
 * @property type - The type of field (text, dropdown, button, etc.)
 * @property label - Display label for the field
 * @property description - Optional description/help text
 * @property items - Optional static items array (mutually exclusive with dataSource)
 * @property dataSource - Optional dynamic data source config (mutually exclusive with items)
 * @property validation - Array of validation rules
 * @property isDiscriminant - Flag indicating this field triggers re-hydration when changed
 * @property status - Optional status templates for conditional visibility/enabling
 * @property button - Optional button configuration (only for button type fields)
 * @property repeatableGroupId - Optional identifier to associate this field with a repeatable group
 */
export interface FieldDescriptor {
  id: string;
  type: FieldType;
  label: string;
  description?: string;
  defaultValue?: string | number | boolean | null;
  items?: FieldItem[];
  dataSource?: DataSourceConfig;
  validation: ValidationRule[];
  isDiscriminant?: boolean;
  status?: StatusTemplates;
  button?: ButtonConfig;
  repeatableGroupId?: string;
}

/**
 * Popin load configuration for loading data when popin opens
 * 
 * @property url - Handlebars-templated URL for fetching data
 * @property dataSourceId - Unique identifier for the data source (used to look up auth credentials server-side)
 * @property auth - Optional authentication configuration (deprecated: use dataSourceId instead)
 * 
 * Note: Response is expected to be an object (like CaseContext shape), not an array.
 * Response is merged directly into formContext, no transformation needed.
 */
export interface PopinLoadConfig {
  url: string;
  dataSourceId?: string;
  auth?: {
    type: 'bearer' | 'apikey' | 'basic';
    token?: string;
    headerName?: string;
    username?: string;
    password?: string;
  };
}

/**
 * Popin submit configuration for calling endpoint when validate button clicked
 * 
 * @property url - Handlebars-templated URL endpoint
 * @property method - HTTP method (POST, PUT, PATCH)
 * @property payloadTemplate - Optional Handlebars template for transforming form data
 * @property auth - Optional authentication configuration
 */
export interface PopinSubmitConfig {
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  payloadTemplate?: string;
  auth?: {
    type: 'bearer' | 'apikey' | 'basic';
    token?: string;
    headerName?: string;
    username?: string;
    password?: string;
  };
}

/**
 * Block descriptor definition
 * 
 * @property id - Unique identifier for the block
 * @property title - Display title for the block
 * @property description - Optional description/help text
 * @property fields - Array of field descriptors within this block
 * @property status - Optional status templates for conditional visibility/enabling
 * @property subFormRef - Optional ID of a SubFormDescriptor to compose into this block
 * @property subFormInstanceId - Optional instance identifier to distinguish multiple uses
 * of the same sub-form template (e.g., incorporation vs onboarding address)
 * @property popin - If true, block is standalone popin (never renders inline, only via button triggers)
 * @property popinLoad - Optional: Load object data when popin opens (merged into formContext)
 * @property popinSubmit - Optional: Call endpoint when validate button clicked, prevent closing on error
 * @property repeatable - If true, block contains repeatable field groups that can be added/removed dynamically
 * @property minInstances - Optional minimum number of instances required for repeatable blocks
 * @property maxInstances - Optional maximum number of instances allowed for repeatable blocks
 * @property repeatableBlockRef - Optional ID of another block to reference and make repeatable (avoids duplicating block definitions)
 */
export interface BlockDescriptor {
  id: string;
  title: string;
  description?: string;
  fields: FieldDescriptor[];
  status?: StatusTemplates;
  subFormRef?: string;
  subFormInstanceId?: string;
  popin?: boolean;
  popinLoad?: PopinLoadConfig;
  popinSubmit?: PopinSubmitConfig;
  repeatable?: boolean;
  minInstances?: number;
  maxInstances?: number;
  repeatableBlockRef?: string;
}

/**
 * Submission configuration
 * 
 * @property url - Endpoint URL for form submission
 * @property method - HTTP method (GET, POST, PUT, PATCH)
 * @property payloadTemplate - Optional Handlebars template for transforming form data
 * @property headers - Optional custom headers
 * @property auth - Optional authentication configuration
 */
export interface SubmissionConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH';
  payloadTemplate?: string;
  headers?: Record<string, string>;
  auth?: {
    type: 'bearer' | 'apikey' | 'basic';
    token?: string;
    headerName?: string;
    username?: string;
    password?: string;
  };
}

/**
 * Global form descriptor
 * 
 * The root descriptor containing all blocks, fields, and submission configuration.
 * This is the base structure that gets merged with RulesObject during re-hydration.
 * 
 * Sub-forms are referenced via BlockDescriptor.subFormRef, so there's no need for
 * a separate includes array - the resolver can traverse blocks to find all sub-form references.
 * 
 * @property id - Optional identifier for the descriptor when stored externally (e.g., in a database)
 * @property title - Optional human-readable title for the form descriptor
 * @property version - Version identifier for the descriptor
 * @property blocks - Array of block descriptors (may include blocks with subFormRef)
 * @property submission - Submission configuration
 */
export interface GlobalFormDescriptor {
  id?: string;
  title?: string;
  version?: string;
  blocks: BlockDescriptor[];
  submission: SubmissionConfig;
}

/**
 * Sub-form descriptor
 * 
 * A reusable form fragment that can be composed into a GlobalFormDescriptor via
 * BlockDescriptor.subFormRef. It represents a reusable block structure that can
 * be included multiple times with different instance IDs.
 * 
 * Unlike GlobalFormDescriptor, submission is optional because sub-forms are typically
 * just structural blocks. However, submission can be provided for cases where a sub-form
 * needs its own submission endpoint (e.g., popin flows or block-scoped submissions).
 * 
 * @property id - Required identifier for the sub-form (used for database storage and resolution)
 * @property title - Required human-readable title for the sub-form
 * @property version - Required version identifier for the sub-form
 * @property blocks - Array of block descriptors within this sub-form
 * @property submission - Optional submission configuration (only needed if sub-form has its own submission)
 */
export interface SubFormDescriptor {
  id: string;
  title: string;
  version: string;
  blocks: BlockDescriptor[];
  submission?: SubmissionConfig;
}

/**
 * Case prefill data provided at case creation
 * 
 * Contains initial values for case context that are set when the case is created.
 * 
 * @property incorporationCountry - Country where the entity is incorporated
 * @property onboardingCountries - Array of countries where onboarding is needed
 * @property processType - Type of onboarding process (e.g., 'standard', 'expedited')
 * @property needSignature - Whether signature is required
 */
export interface CasePrefill {
  incorporationCountry?: string;
  onboardingCountries?: string[];
  processType?: string;
  needSignature?: boolean;
}

/**
 * Case context for rules re-hydration
 * 
 * Contains discriminant field values that determine which rules apply.
 * This is extracted from form data and sent to the backend for rule evaluation.
 * 
 * @property [key: string] - Dynamic properties based on discriminant fields
 */
export interface CaseContext {
  [key: string]: string | number | boolean | null | undefined | string[];
}

/**
 * Rules object returned from backend re-hydration
 * 
 * Contains updated validation rules and status conditions that get merged
 * into the GlobalFormDescriptor.
 * 
 * @property blocks - Optional array of block-level rule updates
 * @property fields - Optional array of field-level rule updates
 */
export interface RulesObject {
  blocks?: Array<{
    id: string;
    status?: StatusTemplates;
  }>;
  fields?: Array<{
    id: string;
    validation?: ValidationRule[];
    status?: StatusTemplates;
  }>;
}

/**
 * Helper type to get field value type based on field type
 * @internal - Exported for testing purposes
 */
export type FieldValueType<F extends FieldDescriptor> = 
  F['type'] extends 'checkbox'
    ? boolean
    : F['type'] extends 'file'
    ? string | string[] | null
    : F['type'] extends 'radio'
    ? string | number
    : F['type'] extends 'number'
    ? number
    : string | number | null;

/**
 * Extract all fields from a descriptor
 * This creates a union of all field descriptors across all blocks
 * @internal - Exported for testing purposes
 */
export type AllFields<T extends GlobalFormDescriptor> = T['blocks'][number]['fields'][number];

/**
 * Extract fields that belong to a specific repeatable group
 * @internal - Exported for testing purposes
 */
export type FieldsInGroup<T extends GlobalFormDescriptor, GroupId extends string> = 
  Extract<AllFields<T>, { repeatableGroupId: GroupId }>;

/**
 * Create object type for a repeatable group (maps field IDs to their value types)
 * @internal - Exported for testing purposes
 */
export type RepeatableGroupObject<T extends GlobalFormDescriptor, GroupId extends string> = {
  [K in FieldsInGroup<T, GroupId>['id']]: FieldValueType<Extract<FieldsInGroup<T, GroupId>, { id: K }>>;
};

/**
 * Extract all unique repeatable group IDs from a descriptor
 * Properly distributes over union of fields to extract all group IDs
 * The key is using `extends infer F` then checking `F extends FieldDescriptor` to enable distribution
 * @internal - Exported for testing purposes
 */
export type RepeatableGroupIds<T extends GlobalFormDescriptor> = 
  AllFields<T> extends infer F
    ? F extends FieldDescriptor
      ? F extends { repeatableGroupId: infer G }
        ? G extends string
          ? G
          : never
        : never
      : never
    : never;

/**
 * Extract fields that don't belong to any repeatable group
 * @internal - Exported for testing purposes
 */
export type NonRepeatableFields<T extends GlobalFormDescriptor> = 
  Exclude<AllFields<T>, { repeatableGroupId: string }>;

/**
 * Form data type derived from GlobalFormDescriptor
 * Maps field IDs to their values based on field types
 * For repeatable groups, maps the group ID to an array of objects containing all fields in that group
 * Note: File fields store URL strings or arrays of URL strings (not File objects)
 */
export type FormData<T extends GlobalFormDescriptor = GlobalFormDescriptor> = 
  // Add repeatable groups as arrays of objects
  {
    [K in RepeatableGroupIds<T>]?: Array<RepeatableGroupObject<T, K>>;
  } & 
  // Add non-repeatable fields as individual properties
  // Use Omit to exclude repeatable group IDs to prevent type conflicts
  Omit<
    {
      [K in NonRepeatableFields<T>['id']]?: FieldValueType<Extract<NonRepeatableFields<T>, { id: K }>>;
    },
    RepeatableGroupIds<T>
  >;
