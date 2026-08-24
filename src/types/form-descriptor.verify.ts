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
  ButtonConfig,
  ButtonMenuItem,
  FileFieldConfig,
  DocumentCardConfig,
  DocumentCardData,
  DocumentCardSlotData,
  UploadedFileMeta,
  ManualLookupConfig,
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

// Verify ManualLookupConfig type
const manualLookupConfig: ManualLookupConfig = {
  request: {
    url: '/api/company/search?registration={{companyRegistrationNumber}}',
    method: 'GET',
  },
  autoFillTargets: [
    {
      fieldId: 'companyName',
      valueTemplate: '{{result.name}}',
    },
  ],
  resilientErrors: [
    {
      status: 404,
      code: 'COMPANY_NOT_FOUND',
    },
  ],
  lockOnSuccess: true,
  showClearOnSuccess: true,
};

// Verify FieldDescriptor with manual lookup
const fieldWithManualLookup: FieldDescriptor = {
  id: 'companyRegistrationNumber',
  type: 'text',
  label: 'Company Registration Number',
  validation: [],
  manualLookup: manualLookupConfig,
};

// Verify FieldDescriptor with button (single variant)
const buttonFieldSingle: FieldDescriptor = {
  id: 'openContactButton',
  type: 'button',
  label: 'Add Contact',
  validation: [],
  button: {
    variant: 'single',
    popinBlockId: 'contact-info',
  },
};

// Verify FieldDescriptor with button (menu variant)
const buttonFieldMenu: FieldDescriptor = {
  id: 'addInfoButton',
  type: 'button',
  label: 'Add Information',
  validation: [],
  button: {
    variant: 'menu',
    items: [
      { label: 'Add Contact', popinBlockId: 'contact-info' },
      { label: 'Add Owner', popinBlockId: 'owner-info' },
    ],
  },
};

// Verify ButtonConfig type
const buttonConfig: ButtonConfig = {
  variant: 'link',
  popinBlockId: 'documents',
};

// Verify FileFieldConfig type
const fileFieldConfig: FileFieldConfig = {
  acceptedFormats: ['pdf', 'png', 'jpg'],
  maxSizeBytes: 10_000_000,
  multiple: true,
  uploadUrl: '/api/documents/upload',
  deleteUrl: '/api/documents/{id}',
};

// Verify FieldDescriptor with file config
const fileField: FieldDescriptor = {
  id: 'proofOfAddress',
  type: 'file',
  label: 'Proof of address',
  validation: [],
  file: fileFieldConfig,
};

// Verify document card file metadata
const uploadedFileMeta: UploadedFileMeta = {
  id: 'document-file-1',
  url: 'https://example.com/document-file-1.pdf',
  filename: 'passport.pdf',
  uploadedAt: '2026-05-07T09:00:00.000Z',
  sizeBytes: 1024,
  contentType: 'application/pdf',
  clientConfirmationRequested: true,
  frontOfficeName: 'Passport',
};

// Verify document card slot data
const documentCardSlotData: DocumentCardSlotData = {
  requested: true,
  optional: false,
  files: [uploadedFileMeta],
};

// Verify document card form data
const documentCardData: DocumentCardData = {
  requested: true,
  optional: false,
  comment: 'Ask the prospect for the latest version',
  files: [],
  prospects: {
    'person-1': documentCardSlotData,
  },
};

// Verify document field config
const documentCardConfig: DocumentCardConfig = {
  docType: 'identity_document',
  category: 'nominativeUploadableByProspect',
  subcategory: 'identity',
  layout: 'perProspect',
  requiredByAgent: true,
  requestedDefault: true,
  allowOptional: true,
  allowComment: true,
  allowClientConfirmation: true,
  allowFrontOfficeName: true,
  file: fileFieldConfig,
  prospects: [
    {
      id: 'person-1',
      name: 'Jane Doe',
      requestedDefault: true,
      optionalDefault: false,
      defaultFiles: [uploadedFileMeta],
    },
  ],
};

// Verify FieldDescriptor with document config
const documentField: FieldDescriptor = {
  id: 'identityDocuments',
  type: 'document',
  label: 'Identity documents',
  defaultValue: documentCardData,
  validation: [],
  document: documentCardConfig,
};

// Verify ButtonMenuItem type
const buttonMenuItem: ButtonMenuItem = {
  label: 'Add Contact',
  popinBlockId: 'contact-info',
  status: {
    hidden: '{{#unless (eq entityType "corporation")}}true{{else}}false{{/if}}',
  },
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
  invalidateQueryKeys: [['case', '{{caseContext.caseId}}'], ['form', 'data-source']],
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
  files: fileFieldConfig,
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
  manualLookupConfig,
  fieldWithManualLookup,
  buttonFieldSingle,
  buttonFieldMenu,
  buttonConfig,
  fileFieldConfig,
  fileField,
  uploadedFileMeta,
  documentCardSlotData,
  documentCardData,
  documentCardConfig,
  documentField,
  buttonMenuItem,
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
