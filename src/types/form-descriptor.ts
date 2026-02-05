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
  | 'number';

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
 * Field descriptor definition
 * 
 * @property id - Unique identifier for the field
 * @property type - The type of field (text, dropdown, etc.)
 * @property label - Display label for the field
 * @property description - Optional description/help text
 * @property items - Optional static items array (mutually exclusive with dataSource)
 * @property dataSource - Optional dynamic data source config (mutually exclusive with items)
 * @property validation - Array of validation rules
 * @property isDiscriminant - Flag indicating this field triggers re-hydration when changed
 * @property status - Optional status templates for conditional visibility/enabling
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
 */
export interface BlockDescriptor {
  id: string;
  title: string;
  description?: string;
  fields: FieldDescriptor[];
  status?: StatusTemplates;
  subFormRef?: string;
  subFormInstanceId?: string;
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
 * Form data type derived from GlobalFormDescriptor
 * Maps field IDs to their values based on field types
 * Note: File fields store URL strings or arrays of URL strings (not File objects)
 */
export type FormData<T extends GlobalFormDescriptor = GlobalFormDescriptor> = {
  [K in T['blocks'][number]['fields'][number]['id']]?: 
    T['blocks'][number]['fields'][number]['type'] extends 'checkbox'
      ? boolean
      : T['blocks'][number]['fields'][number]['type'] extends 'file'
      ? string | string[] | null
      : T['blocks'][number]['fields'][number]['type'] extends 'radio'
      ? string | number
      : T['blocks'][number]['fields'][number]['type'] extends 'number'
      ? number
      : string | number | null;
};
