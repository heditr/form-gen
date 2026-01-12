/**
 * Type definitions for the KYC Form Engine form descriptor system
 * 
 * These types define the hierarchical structure: GlobalFormDescriptor → Blocks → Fields
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
 * Validation rule definition
 * 
 * @property type - The type of validation rule
 * @property value - Optional value for the rule (e.g., minLength: 3, pattern: /regex/)
 * @property message - Error message to display when validation fails
 */
export interface ValidationRule {
  type: ValidationRuleType;
  value?: number | string | RegExp | ((value: any) => boolean);
  message: string;
}

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
  | 'file';

/**
 * Static item for dropdown, radio, or autocomplete fields
 */
export interface FieldItem {
  label: string;
  value: string | number | boolean;
}

/**
 * Data source configuration for dynamic field data
 * 
 * @property url - Handlebars-templated URL for fetching data
 * @property itemsTemplate - Handlebars template for transforming API response
 * @property iteratorTemplate - Optional template for iterating over array responses
 * @property auth - Optional authentication configuration
 */
export interface DataSourceConfig {
  url: string;
  itemsTemplate: string;
  iteratorTemplate?: string;
  auth?: {
    type: 'bearer' | 'apikey';
    token?: string;
    headerName?: string;
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
 */
export interface BlockDescriptor {
  id: string;
  title: string;
  description?: string;
  fields: FieldDescriptor[];
  status?: StatusTemplates;
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
    type: 'bearer' | 'apikey';
    token?: string;
    headerName?: string;
  };
}

/**
 * Global form descriptor
 * 
 * The root descriptor containing all blocks, fields, and submission configuration.
 * This is the base structure that gets merged with RulesObject during re-hydration.
 * 
 * @property version - Version identifier for the descriptor
 * @property blocks - Array of block descriptors
 * @property submission - Submission configuration
 */
export interface GlobalFormDescriptor {
  version?: string;
  blocks: BlockDescriptor[];
  submission: SubmissionConfig;
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
