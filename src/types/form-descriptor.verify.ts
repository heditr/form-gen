/**
 * Type verification file for form descriptor types
 * 
 * This file imports and uses all type definitions to verify they compile correctly.
 * It serves as a compile-time check that all types are properly defined.
 */

import type {
  GlobalFormDescriptor,
  BlockDescriptor,
  FieldDescriptor,
  ValidationRule,
  CaseContext,
  RulesObject,
  ValidationRuleType,
  FieldType,
  FieldItem,
  DataSourceConfig,
  StatusTemplates,
  SubmissionConfig,
  SubFormDescriptor,
  PopinLoadConfig,
  PopinSubmitConfig,
} from './form-descriptor';

// Verify ValidationRule type
const requiredRule: ValidationRule = {
  type: 'required',
  message: 'This field is required',
};

const minLengthRule: ValidationRule = {
  type: 'minLength',
  value: 3,
  message: 'Must be at least 3 characters',
};

const patternRule: ValidationRule = {
  type: 'pattern',
  value: /^[A-Z]+$/,
  message: 'Must contain only uppercase letters',
};

// Verify FieldDescriptor with static items
const fieldWithItems: FieldDescriptor = {
  id: 'country',
  type: 'dropdown',
  label: 'Country',
  items: [
    { label: 'United States', value: 'US' },
    { label: 'Canada', value: 'CA' },
  ],
  validation: [requiredRule],
};

// Verify FieldDescriptor with dataSource
const fieldWithDataSource: FieldDescriptor = {
  id: 'city',
  type: 'autocomplete',
  label: 'City',
  dataSource: {
    url: '/api/cities?country={{country}}',
    itemsTemplate: '{{#each cities}}{{label}}:{{value}}{{/each}}',
  },
  validation: [],
  isDiscriminant: true,
};

// Verify BlockDescriptor with status templates
const blockWithStatus: BlockDescriptor = {
  id: 'personal-info',
  title: 'Personal Information',
  fields: [fieldWithItems, fieldWithDataSource],
  status: {
    hidden: '{{#if hidePersonalInfo}}true{{/if}}',
    disabled: '{{#if readonly}}true{{/if}}',
    readonly: '{{#if isReadonly}}true{{/if}}',
  },
};

// Verify BlockDescriptor with popin flag
const popinBlock: BlockDescriptor = {
  id: 'contact-info',
  title: 'Contact Information',
  fields: [],
  popin: true,
};

// Verify BlockDescriptor with popinLoad config
const popinBlockWithLoad: BlockDescriptor = {
  id: 'contact-info',
  title: 'Contact Information',
  fields: [],
  popin: true,
  popinLoad: {
    url: '/api/contact/{{entityId}}',
    dataSourceId: 'contact-api',
  },
};

// Verify BlockDescriptor with popinSubmit config
const popinBlockWithSubmit: BlockDescriptor = {
  id: 'contact-info',
  title: 'Contact Information',
  fields: [],
  popin: true,
  popinSubmit: {
    url: '/api/contact/{{entityId}}',
    method: 'POST',
    payloadTemplate: '{{formData}}',
  },
};

// Verify PopinLoadConfig type
const popinLoadConfig: PopinLoadConfig = {
  url: '/api/data/{{id}}',
  dataSourceId: 'api-source',
};

// Verify PopinSubmitConfig type
const popinSubmitConfig: PopinSubmitConfig = {
  url: '/api/submit/{{id}}',
  method: 'PUT',
  payloadTemplate: '{{formData}}',
  auth: {
    type: 'bearer',
    token: 'token123',
  },
};

// Verify GlobalFormDescriptor
const globalDescriptor: GlobalFormDescriptor = {
  id: 'kyc-form-v1',
  title: 'KYC Onboarding Form',
  version: '1.0.0',
  blocks: [blockWithStatus],
  submission: {
    url: '/api/submit',
    method: 'POST',
    payloadTemplate: '{{formData}}',
    headers: {
      'Content-Type': 'application/json',
    },
  },
};

// Verify SubFormDescriptor (submission is optional)
const subFormWithoutSubmission: SubFormDescriptor = {
  id: 'address-subform',
  title: 'Address Sub-Form',
  version: '1.0.0',
  blocks: [blockWithStatus],
};

// Verify SubFormDescriptor with optional submission
const subFormWithSubmission: SubFormDescriptor = {
  id: 'popin-subform',
  title: 'Popin Sub-Form',
  version: '1.0.0',
  blocks: [blockWithStatus],
  submission: {
    url: '/api/subform-submit',
    method: 'POST',
  },
};

// Verify CaseContext
const caseContext: CaseContext = {
  jurisdiction: 'US',
  entityType: 'individual',
  country: 'United States',
};

// Verify RulesObject
const rulesObject: RulesObject = {
  blocks: [
    {
      id: 'personal-info',
      status: {
        hidden: '{{#if hideBlock}}true{{/if}}',
      },
    },
  ],
  fields: [
    {
      id: 'email',
      validation: [
        { type: 'required', message: 'Email is required' },
        { type: 'pattern', value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' },
      ],
      status: {
        disabled: '{{#if readonly}}true{{/if}}',
      },
    },
  ],
};

// Export to ensure the file is treated as a module
export {
  requiredRule,
  minLengthRule,
  patternRule,
  fieldWithItems,
  fieldWithDataSource,
  blockWithStatus,
  popinBlock,
  popinBlockWithLoad,
  popinBlockWithSubmit,
  popinLoadConfig,
  popinSubmitConfig,
  globalDescriptor,
  subFormWithoutSubmission,
  subFormWithSubmission,
  caseContext,
  rulesObject,
};
