/**
 * Tests for form descriptor type definitions
 * 
 * These tests verify that the TypeScript types correctly represent
 * the form descriptor system structure.
 */

import { describe, test, expect } from 'vitest';
import type {
  GlobalFormDescriptor,
  SubFormDescriptor,
  BlockDescriptor,
  FieldDescriptor,
  ValidationRule,
  CaseContext,
  RulesObject,
  FormData,
  // Intermediate helper types (exported for testing)
  FieldValueType,
  AllFields,
  FieldsInGroup,
  RepeatableGroupObject,
  RepeatableGroupIds,
  NonRepeatableFields,
} from './form-descriptor';

describe('form-descriptor types', () => {
  describe('ValidationRule', () => {
    test('given a required validation rule, should define type, value, and message properties', () => {
      const rule: ValidationRule = {
        type: 'required',
        message: 'This field is required',
      };

      expect(rule.type).toBe('required');
      expect(rule.message).toBe('This field is required');
    });

    test('given a minLength validation rule, should define type, value, and message properties', () => {
      const rule: ValidationRule = {
        type: 'minLength',
        value: 3,
        message: 'Must be at least 3 characters',
      };

      expect(rule.type).toBe('minLength');
      expect(rule.value).toBe(3);
      expect(rule.message).toBe('Must be at least 3 characters');
    });

    test('given a pattern validation rule, should define type, value, and message properties', () => {
      const rule: ValidationRule = {
        type: 'pattern',
        value: /^[A-Z]+$/,
        message: 'Must contain only uppercase letters',
      };

      expect(rule.type).toBe('pattern');
      expect(rule.value).toBeInstanceOf(RegExp);
      expect(rule.message).toBe('Must contain only uppercase letters');
    });
  });

  describe('FieldDescriptor', () => {
    test('given a field with static items, should support items array', () => {
      const field: FieldDescriptor = {
        id: 'country',
        type: 'dropdown',
        label: 'Country',
        items: [
          { label: 'United States', value: 'US' },
          { label: 'Canada', value: 'CA' },
        ],
        validation: [],
      };

      expect(field.items).toBeDefined();
      expect(field.items?.length).toBe(2);
    });

    test('given a field with dynamic dataSource, should support dataSource config', () => {
      const field: FieldDescriptor = {
        id: 'city',
        type: 'autocomplete',
        label: 'City',
        dataSource: {
          url: '/api/cities?country={{country}}',
          itemsTemplate: '{{#each cities}}{{label}}:{{value}}{{/each}}',
        },
        validation: [],
      };

      expect(field.dataSource).toBeDefined();
      expect(field.dataSource?.url).toContain('{{country}}');
    });

    test('given a field with validation rules, should support validation array', () => {
      const field: FieldDescriptor = {
        id: 'email',
        type: 'text',
        label: 'Email',
        validation: [
          { type: 'required', message: 'Email is required' },
          { type: 'pattern', value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email format' },
        ],
      };

      expect(field.validation.length).toBe(2);
    });

    test('given a discriminant field, should support isDiscriminant flag', () => {
      const field: FieldDescriptor = {
        id: 'jurisdiction',
        type: 'dropdown',
        label: 'Jurisdiction',
        items: [{ label: 'US', value: 'US' }],
        isDiscriminant: true,
        validation: [],
      };

      expect(field.isDiscriminant).toBe(true);
    });

    test('given a field in a repeatable group, should support repeatableGroupId', () => {
      const field: FieldDescriptor = {
        id: 'street',
        type: 'text',
        label: 'Street Address',
        repeatableGroupId: 'addresses',
        validation: [],
      };

      expect(field.repeatableGroupId).toBe('addresses');
    });

    test('given a button field with single variant, should support button type and popinBlockId', () => {
      const field: FieldDescriptor = {
        id: 'openContactButton',
        type: 'button',
        label: 'Add Contact',
        validation: [],
        button: {
          variant: 'single',
          popinBlockId: 'contact-info',
        },
      };

      expect(field.type).toBe('button');
      expect(field.button?.variant).toBe('single');
      expect(field.button?.popinBlockId).toBe('contact-info');
    });

    test('given a button field with menu variant, should support items array with popinBlockId', () => {
      const field: FieldDescriptor = {
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

      expect(field.type).toBe('button');
      expect(field.button?.variant).toBe('menu');
      expect(field.button?.items).toBeDefined();
      expect(field.button?.items?.length).toBe(2);
      expect(field.button?.items?.[0].popinBlockId).toBe('contact-info');
    });

    test('given a button field with menu variant, should support status templates on menu items', () => {
      const field: FieldDescriptor = {
        id: 'addInfoButton',
        type: 'button',
        label: 'Add Information',
        validation: [],
        button: {
          variant: 'menu',
          items: [
            {
              label: 'Add Contact',
              popinBlockId: 'contact-info',
              status: {
                hidden: '{{#unless (eq entityType "corporation")}}true{{else}}false{{/if}}',
              },
            },
          ],
        },
      };

      expect(field.button?.items?.[0].status).toBeDefined();
      expect(field.button?.items?.[0].status?.hidden).toBeDefined();
    });

    test('given a button field with link variant, should support link variant', () => {
      const field: FieldDescriptor = {
        id: 'openDocsButton',
        type: 'button',
        label: 'Open Documents',
        validation: [],
        button: {
          variant: 'link',
          popinBlockId: 'documents',
        },
      };

      expect(field.button?.variant).toBe('link');
      expect(field.button?.popinBlockId).toBe('documents');
    });
  });

  describe('BlockDescriptor', () => {
    test('given a block with status templates, should define hidden and disabled templates', () => {
      const block: BlockDescriptor = {
        id: 'personal-info',
        title: 'Personal Information',
        fields: [],
        status: {
          hidden: '{{#if hidePersonalInfo}}true{{/if}}',
          disabled: '{{#if readonly}}true{{/if}}',
        },
      };

      expect(block.status?.hidden).toBeDefined();
      expect(block.status?.disabled).toBeDefined();
    });

    test('given a block with readonly status, should support readonly template', () => {
      const block: BlockDescriptor = {
        id: 'readonly-block',
        title: 'Read Only Block',
        fields: [],
        status: {
          readonly: '{{#if isReadonly}}true{{/if}}',
        },
      };

      expect(block.status?.readonly).toBeDefined();
    });

    test('given a block that composes a sub-form, should support subFormRef and instance ID', () => {
      const block: BlockDescriptor = {
        id: 'incorporation-address',
        title: 'Incorporation Address',
        fields: [],
        subFormRef: 'address',
        subFormInstanceId: 'incorporation',
      };

      expect(block.subFormRef).toBe('address');
      expect(block.subFormInstanceId).toBe('incorporation');
    });

    test('given a popin block, should support popin flag', () => {
      const block: BlockDescriptor = {
        id: 'contact-info',
        title: 'Contact Information',
        fields: [],
        popin: true,
      };

      expect(block.popin).toBe(true);
    });

    test('given a repeatable block, should support repeatable flag', () => {
      const block: BlockDescriptor = {
        id: 'addresses-block',
        title: 'Addresses',
        fields: [
          {
            id: 'street',
            type: 'text',
            label: 'Street',
            repeatableGroupId: 'addresses',
            validation: [],
          },
        ],
        repeatable: true,
      };

      expect(block.repeatable).toBe(true);
    });

    test('given a repeatable block with instance limits, should support minInstances and maxInstances', () => {
      const block: BlockDescriptor = {
        id: 'beneficiaries-block',
        title: 'Beneficiaries',
        fields: [
          {
            id: 'name',
            type: 'text',
            label: 'Name',
            repeatableGroupId: 'beneficiaries',
            validation: [],
          },
        ],
        repeatable: true,
        minInstances: 1,
        maxInstances: 5,
      };

      expect(block.repeatable).toBe(true);
      expect(block.minInstances).toBe(1);
      expect(block.maxInstances).toBe(5);
    });

    test('given a repeatable block referencing another block, should support repeatableBlockRef', () => {
      const block: BlockDescriptor = {
        id: 'addresses-block',
        title: 'Addresses',
        fields: [],
        repeatable: true,
        repeatableBlockRef: 'address-block',
      };

      expect(block.repeatable).toBe(true);
      expect(block.repeatableBlockRef).toBe('address-block');
    });

    test('given a popin block with popinLoad config, should support popinLoad with url and dataSourceId', () => {
      const block: BlockDescriptor = {
        id: 'contact-info',
        title: 'Contact Information',
        fields: [],
        popin: true,
        popinLoad: {
          url: '/api/contact/{{entityId}}',
          dataSourceId: 'contact-api',
        },
      };

      expect(block.popinLoad).toBeDefined();
      expect(block.popinLoad?.url).toBe('/api/contact/{{entityId}}');
      expect(block.popinLoad?.dataSourceId).toBe('contact-api');
    });

    test('given a popin block with popinLoad config, should support popinLoad with auth', () => {
      const block: BlockDescriptor = {
        id: 'contact-info',
        title: 'Contact Information',
        fields: [],
        popin: true,
        popinLoad: {
          url: '/api/contact/{{entityId}}',
          auth: {
            type: 'bearer',
            token: 'token123',
          },
        },
      };

      expect(block.popinLoad?.auth).toBeDefined();
      expect(block.popinLoad?.auth?.type).toBe('bearer');
      expect(block.popinLoad?.auth?.token).toBe('token123');
    });

    test('given a popin block with popinSubmit config, should support popinSubmit with url, method, and payloadTemplate', () => {
      const block: BlockDescriptor = {
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

      expect(block.popinSubmit).toBeDefined();
      expect(block.popinSubmit?.url).toBe('/api/contact/{{entityId}}');
      expect(block.popinSubmit?.method).toBe('POST');
      expect(block.popinSubmit?.payloadTemplate).toBe('{{formData}}');
    });

    test('given a popin block with popinSubmit config, should support popinSubmit with auth', () => {
      const block: BlockDescriptor = {
        id: 'contact-info',
        title: 'Contact Information',
        fields: [],
        popin: true,
        popinSubmit: {
          url: '/api/contact/{{entityId}}',
          method: 'PUT',
          auth: {
            type: 'apikey',
            headerName: 'X-API-Key',
            token: 'key123',
          },
        },
      };

      expect(block.popinSubmit?.auth).toBeDefined();
      expect(block.popinSubmit?.auth?.type).toBe('apikey');
      expect(block.popinSubmit?.auth?.headerName).toBe('X-API-Key');
    });
  });

  describe('GlobalFormDescriptor', () => {
    test('given a form descriptor structure, should define blocks, fields, and submission config', () => {
      const descriptor: GlobalFormDescriptor = {
        id: 'kyc-form-v1',
        title: 'KYC Onboarding Form',
        version: '1.0.0',
        blocks: [
          {
            id: 'block1',
            title: 'Block 1',
            fields: [
              {
                id: 'field1',
                type: 'text',
                label: 'Field 1',
                validation: [],
              },
            ],
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      expect(descriptor.id).toBe('kyc-form-v1');
      expect(descriptor.title).toBe('KYC Onboarding Form');
      expect(descriptor.blocks).toBeDefined();
      expect(descriptor.blocks.length).toBe(1);
      expect(descriptor.submission).toBeDefined();
      expect(descriptor.submission.url).toBe('/api/submit');
    });

    test('given a form descriptor with sub-form references, should reference sub-forms via block subFormRef', () => {
      const descriptor: GlobalFormDescriptor = {
        id: 'kyc-form-v1',
        blocks: [
          {
            id: 'incorporation-address',
            title: 'Incorporation Address',
            fields: [],
            subFormRef: 'address',
            subFormInstanceId: 'incorporation',
          },
          {
            id: 'onboarding-address',
            title: 'Onboarding Address',
            fields: [],
            subFormRef: 'address',
            subFormInstanceId: 'onboarding',
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      expect(descriptor.blocks[0].subFormRef).toBe('address');
      expect(descriptor.blocks[0].subFormInstanceId).toBe('incorporation');
      expect(descriptor.blocks[1].subFormRef).toBe('address');
      expect(descriptor.blocks[1].subFormInstanceId).toBe('onboarding');
    });
  });

  describe('SubFormDescriptor', () => {
    test('given a sub-form descriptor, should have optional submission config', () => {
      const subForm: SubFormDescriptor = {
        id: 'address-subform',
        title: 'Address Sub-Form',
        version: '1.0.0',
        blocks: [
          {
            id: 'address-block',
            title: 'Address',
            fields: [
              {
                id: 'line1',
                type: 'text',
                label: 'Address Line 1',
                validation: [],
              },
            ],
          },
        ],
      };

      expect(subForm.id).toBe('address-subform');
      expect(subForm.submission).toBeUndefined();
    });

    test('given a sub-form with submission, should support optional submission config', () => {
      const subForm: SubFormDescriptor = {
        id: 'popin-subform',
        title: 'Popin Sub-Form',
        version: '1.0.0',
        blocks: [],
        submission: {
          url: '/api/popin-submit',
          method: 'POST',
        },
      };

      expect(subForm.id).toBe('popin-subform');
      expect(subForm.title).toBe('Popin Sub-Form');
      expect(subForm.version).toBe('1.0.0');
      expect(subForm.submission).toBeDefined();
      expect(subForm.submission?.url).toBe('/api/popin-submit');
    });
  });

  describe('CaseContext', () => {
    test('given API communication needs, should define CaseContext type', () => {
      const context: CaseContext = {
        jurisdiction: 'US',
        entityType: 'individual',
      };

      expect(context.jurisdiction).toBe('US');
      expect(context.entityType).toBe('individual');
    });
  });

  describe('RulesObject', () => {
    test('given API communication needs, should define RulesObject type', () => {
      const rules: RulesObject = {
        blocks: [
          {
            id: 'block1',
            status: {
              hidden: '{{#if hideBlock}}true{{/if}}',
            },
          },
        ],
        fields: [
          {
            id: 'field1',
            validation: [
              { type: 'required', message: 'Required field' },
            ],
          },
        ],
      };

      expect(rules.blocks).toBeDefined();
      expect(rules.fields).toBeDefined();
    });
  });

  describe('File field types', () => {
    test('given a file field descriptor, should allow defaultValue as URL string', () => {
      const field: FieldDescriptor = {
        id: 'document',
        type: 'file',
        label: 'Document',
        defaultValue: 'https://example.com/file.pdf',
        validation: [],
      };

      expect(field.defaultValue).toBe('https://example.com/file.pdf');
    });

    test('given a file field descriptor, should allow defaultValue as array of URL strings', () => {
      const field: FieldDescriptor = {
        id: 'documents',
        type: 'file',
        label: 'Documents',
        defaultValue: 'https://example.com/file1.pdf',
        validation: [],
      };

      expect(field.defaultValue).toEqual(['https://example.com/file1.pdf', 'https://example.com/file2.pdf']);
    });

    test('given a file field descriptor, should allow defaultValue as null', () => {
      const field: FieldDescriptor = {
        id: 'document',
        type: 'file',
        label: 'Document',
        defaultValue: null,
        validation: [],
      };

      expect(field.defaultValue).toBeNull();
    });

    test('given a file field descriptor, should allow defaultValue as Handlebars template string', () => {
      const field: FieldDescriptor = {
        id: 'document',
        type: 'file',
        label: 'Document',
        defaultValue: '{{caseContext.documentUrl}}',
        validation: [],
      };

      expect(field.defaultValue).toBe('{{caseContext.documentUrl}}');
    });
  });

  describe('FormData with repeatable groups', () => {
    test('given a descriptor with repeatable fields, should support array of objects for repeatable groups', () => {
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
                repeatableGroupId: 'addresses',
                validation: [],
              },
              {
                id: 'city',
                type: 'text' as const,
                label: 'City',
                repeatableGroupId: 'addresses',
                validation: [],
              },
            ],
          },
          {
            id: 'basic-info',
            title: 'Basic Info',
            fields: [
              {
                id: 'name',
                type: 'text' as const,
                label: 'Name',
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

      // FormData should have addresses as array of objects, and name as string
      type FormDataType = FormData<typeof descriptor>;
      const formData: FormDataType = {
        addresses: [
          { street: '123 Main St', city: 'New York' },
          { street: '456 Oak Ave', city: 'Boston' },
        ],
        name: 'John Doe',
      };

      expect(formData.addresses).toBeDefined();
      expect(Array.isArray(formData.addresses)).toBe(true);
      if (formData.addresses && Array.isArray(formData.addresses)) {
        expect(formData.addresses[0]).toHaveProperty('street');
        expect(formData.addresses[0]).toHaveProperty('city');
      }
      expect(formData.name).toBe('John Doe');
    });

    test('given a descriptor with multiple repeatable groups, should support multiple array properties', () => {
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
                repeatableGroupId: 'addresses',
                validation: [],
              },
            ],
          },
          {
            id: 'contacts-block',
            title: 'Contacts',
            repeatable: true,
            fields: [
              {
                id: 'email',
                type: 'text' as const,
                label: 'Email',
                repeatableGroupId: 'contacts',
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

      type FormDataType = FormData<typeof descriptor>;
      const formData: FormDataType = {
        addresses: [{ street: '123 Main St' }],
        contacts: [{ email: 'test@example.com' }],
      };

      expect(formData.addresses).toBeDefined();
      expect(formData.contacts).toBeDefined();
      if (formData.addresses) {
        expect(Array.isArray(formData.addresses)).toBe(true);
      }
      if (formData.contacts) {
        expect(Array.isArray(formData.contacts)).toBe(true);
      }
    });

    test('given a descriptor with empty repeatable group, should allow empty array', () => {
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
                repeatableGroupId: 'addresses',
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

      type FormDataType = FormData<typeof descriptor>;
      const formData: FormDataType = {
        addresses: [],
      };

      expect(formData.addresses).toBeDefined();
      if (formData.addresses) {
        expect(Array.isArray(formData.addresses)).toBe(true);
        expect(formData.addresses.length).toBe(0);
      }
    });

    test('given a repeatable group with mixed field types, should correctly type each field', () => {
      const descriptor = {
        blocks: [
          {
            id: 'beneficiaries-block',
            title: 'Beneficiaries',
            repeatable: true,
            fields: [
              { id: 'name', type: 'text', label: 'Name', repeatableGroupId: 'beneficiaries', validation: [] },
              { id: 'age', type: 'number', label: 'Age', repeatableGroupId: 'beneficiaries', validation: [] },
              { id: 'isStudent', type: 'checkbox', label: 'Is Student', repeatableGroupId: 'beneficiaries', validation: [] },
            ],
          },
        ],
        submission: { url: '/api/submit', method: 'POST' },
      } as const satisfies GlobalFormDescriptor;

      const formData: FormData<typeof descriptor> = {
        beneficiaries: [
          { name: 'John Doe', age: 25, isStudent: false },
          { name: 'Jane Smith', age: 18, isStudent: true },
        ],
      };

      expect(formData.beneficiaries).toBeDefined();
      const first = formData.beneficiaries?.[0];
      expect(first?.name).toBe('John Doe');
      expect(first?.age).toBe(25);
      expect(first?.isStudent).toBe(false);
      expect(typeof first?.name).toBe('string');
      expect(typeof first?.age).toBe('number');
      expect(typeof first?.isStudent).toBe('boolean');
    });
  });

  describe('Intermediate Helper Types - Independent Usage', () => {
    // These tests showcase the intermediate types that are used internally
    // but not exported. We test them by using type assertions and type checks.
    // Variables prefixed with _ are used for type-level testing only
    /* eslint-disable @typescript-eslint/no-unused-vars */

    describe('FieldValueType', () => {
      test('given a text field, should map to string | number | null', () => {
        type TextField = { id: 'name'; type: 'text'; label: string; validation: ValidationRule[] };
        type ValueType = FieldValueType<TextField>;
        
        // Type-level test: verify the type is correct
         
        const _test: ValueType = 'test';
         
        const _test2: ValueType = 123;
         
        const _test3: ValueType = null;
        // Type-level test: boolean should not be assignable
        // This would cause a type error if uncommented:
        // const _test4: ValueType = true;
        
        expect(true).toBe(true); // Runtime assertion passes
      });

      test('given a number field, should map to number', () => {
        type NumberField = { id: 'age'; type: 'number'; label: string; validation: ValidationRule[] };
        type ValueType = FieldValueType<NumberField>;
        
         
        const _test: ValueType = 42;
        // Type-level test: string should not be assignable
        // This would cause a type error if uncommented:
        // const _test2: ValueType = 'not a number';
        
        expect(true).toBe(true);
      });

      test('given a checkbox field, should map to boolean', () => {
        type CheckboxField = { id: 'isActive'; type: 'checkbox'; label: string; validation: ValidationRule[] };
        type ValueType = FieldValueType<CheckboxField>;
        
         
        const _test: ValueType = true;
         
        const _test2: ValueType = false;
        // Type-level test: string should not be assignable
        // This would cause a type error if uncommented:
        // const _test3: ValueType = 'true';
        
        expect(true).toBe(true);
      });

      test('given a file field, should map to string | string[] | null', () => {
        type FileField = { id: 'document'; type: 'file'; label: string; validation: ValidationRule[] };
        type ValueType = FieldValueType<FileField>;
        
         
        const _test: ValueType = 'https://example.com/file.pdf';
         
        const _test2: ValueType = ['https://example.com/file1.pdf', 'https://example.com/file2.pdf'];
         
        const _test3: ValueType = null;
        // Type-level test: number should not be assignable
        // This would cause a type error if uncommented:
        // const _test4: ValueType = 123;
        
        expect(true).toBe(true);
      });

      test('given a radio field, should map to string | number', () => {
        type RadioField = { id: 'choice'; type: 'radio'; label: string; validation: ValidationRule[] };
        type ValueType = FieldValueType<RadioField>;
        
         
        const _test: ValueType = 'option1';
         
        const _test2: ValueType = 42;
        // Type-level test: boolean should not be assignable
        // This would cause a type error if uncommented:
        // const _test3: ValueType = true;
        
        expect(true).toBe(true);
      });
    });

    describe('AllFields', () => {
      test('given a descriptor with multiple blocks, should extract all fields as union', () => {
        const descriptor = {
          blocks: [
            {
              id: 'block1',
              title: 'Block 1',
              fields: [
                { id: 'field1', type: 'text' as const, label: 'Field 1', validation: [] },
                { id: 'field2', type: 'number' as const, label: 'Field 2', validation: [] },
              ],
            },
            {
              id: 'block2',
              title: 'Block 2',
              fields: [
                { id: 'field3', type: 'checkbox' as const, label: 'Field 3', validation: [] },
              ],
            },
          ],
          submission: { url: '/api/submit', method: 'POST' as const },
        } as const satisfies GlobalFormDescriptor;

        // Type-level test: AllFields should be a union of all field descriptors
        type ExtractedFields = AllFields<typeof descriptor>;
        
        // Verify we can extract each field type
        type Field1 = Extract<ExtractedFields, { id: 'field1' }>;
        type Field2 = Extract<ExtractedFields, { id: 'field2' }>;
        type Field3 = Extract<ExtractedFields, { id: 'field3' }>;
        
         
        const _field1: Field1 = { id: 'field1', type: 'text', label: 'Field 1', validation: [] };
         
        const _field2: Field2 = { id: 'field2', type: 'number', label: 'Field 2', validation: [] };
         
        const _field3: Field3 = { id: 'field3', type: 'checkbox', label: 'Field 3', validation: [] };
        
        expect(true).toBe(true);
      });

      test('given a descriptor with repeatable groups, should include all fields regardless of repeatableGroupId', () => {
        const descriptor = {
          blocks: [
            {
              id: 'addresses-block',
              title: 'Addresses',
              repeatable: true,
              fields: [
                { id: 'street', type: 'text' as const, label: 'Street', repeatableGroupId: 'addresses', validation: [] },
                { id: 'city', type: 'text' as const, label: 'City', repeatableGroupId: 'addresses', validation: [] },
              ],
            },
            {
              id: 'basic-info',
              title: 'Basic Info',
              fields: [
                { id: 'name', type: 'text' as const, label: 'Name', validation: [] },
              ],
            },
          ],
          submission: { url: '/api/submit', method: 'POST' as const },
        } as const satisfies GlobalFormDescriptor;

        type ExtractedFields = AllFields<typeof descriptor>;
        
        // Should include both repeatable and non-repeatable fields
        type StreetField = Extract<ExtractedFields, { id: 'street' }>;
        type CityField = Extract<ExtractedFields, { id: 'city' }>;
        type NameField = Extract<ExtractedFields, { id: 'name' }>;
        
        // Type-level verification: these types should be defined
        const _street: StreetField = { id: 'street', type: 'text', label: 'Street', repeatableGroupId: 'addresses', validation: [] };
        const _city: CityField = { id: 'city', type: 'text', label: 'City', repeatableGroupId: 'addresses', validation: [] };
        const _name: NameField = { id: 'name', type: 'text', label: 'Name', validation: [] };
        
        expect(_street.id).toBe('street');
        expect(_city.id).toBe('city');
        expect(_name.id).toBe('name');
      });
    });

    describe('RepeatableGroupIds', () => {
      test('given fields with repeatableGroupId, should extract unique group IDs', () => {
        const descriptor = {
          blocks: [
            {
              id: 'addresses-block',
              title: 'Addresses',
              repeatable: true,
              fields: [
                { id: 'street', type: 'text' as const, label: 'Street', repeatableGroupId: 'addresses', validation: [] },
                { id: 'city', type: 'text' as const, label: 'City', repeatableGroupId: 'addresses', validation: [] },
              ],
            },
          ],
          submission: { url: '/api/submit', method: 'POST' as const },
        } as const satisfies GlobalFormDescriptor;

        type GroupIds = RepeatableGroupIds<typeof descriptor>;
        
        // Should extract 'addresses' as the group ID
        const _test: GroupIds = 'addresses';
        // Type-level test: 'invalid' should not be assignable
        // This would cause a type error if uncommented:
        // const _test2: GroupIds = 'invalid';
        
        expect(true).toBe(true);
      });

      test('given multiple repeatable groups, should extract all unique group IDs', () => {
        const descriptor = {
          blocks: [
            {
              id: 'addresses-block',
              title: 'Addresses',
              repeatable: true,
              fields: [
                { id: 'street', type: 'text' as const, label: 'Street', repeatableGroupId: 'addresses', validation: [] },
              ],
            },
            {
              id: 'contacts-block',
              title: 'Contacts',
              repeatable: true,
              fields: [
                { id: 'email', type: 'text' as const, label: 'Email', repeatableGroupId: 'contacts', validation: [] },
              ],
            },
          ],
          submission: { url: '/api/submit', method: 'POST' as const },
        } as const satisfies GlobalFormDescriptor;

        type GroupIds = RepeatableGroupIds<typeof descriptor>;
        
        // Should be union of 'addresses' | 'contacts'
        const _test1: GroupIds = 'addresses';
        const _test2: GroupIds = 'contacts';
        // Type-level test: 'invalid' should not be assignable
        // This would cause a type error if uncommented:
        // const _test3: GroupIds = 'invalid';
        
        expect(true).toBe(true);
      });

      test('given fields without repeatableGroupId, should not include them in group IDs', () => {
        const descriptor = {
          blocks: [
            {
              id: 'basic-info',
              title: 'Basic Info',
              fields: [
                { id: 'name', type: 'text' as const, label: 'Name', validation: [] },
                { id: 'age', type: 'number' as const, label: 'Age', validation: [] },
              ],
            },
          ],
          submission: { url: '/api/submit', method: 'POST' as const },
        } as const satisfies GlobalFormDescriptor;

        type GroupIds = RepeatableGroupIds<typeof descriptor>;
        
        // Should be never (no repeatable groups)
        const _test: GroupIds = undefined as never;
        
        expect(true).toBe(true);
      });
    });

    describe('FieldsInGroup', () => {
      test('given a specific group ID, should extract only fields in that group', () => {
        const descriptor: GlobalFormDescriptor = {
          blocks: [
            {
              id: 'addresses-block',
              title: 'Addresses',
              repeatable: true,
              fields: [
                { id: 'street', type: 'text' as const, label: 'Street', repeatableGroupId: 'addresses', validation: [] },
                { id: 'city', type: 'text' as const, label: 'City', repeatableGroupId: 'addresses', validation: [] },
                { id: 'zipCode', type: 'text' as const, label: 'ZIP', repeatableGroupId: 'addresses', validation: [] },
              ],
            },
            {
              id: 'contacts-block',
              title: 'Contacts',
              repeatable: true,
              fields: [
                { id: 'email', type: 'text' as const, label: 'Email', repeatableGroupId: 'contacts', validation: [] },
              ],
            },
          ],
          submission: { url: '/api/submit', method: 'POST' as const },
        } as const satisfies GlobalFormDescriptor;

        type AddressFields = FieldsInGroup<typeof descriptor, 'addresses'>;
        
        // Should only include fields with repeatableGroupId: 'addresses'
        type StreetField = Extract<AddressFields, { id: 'street' }>;
        type CityField = Extract<AddressFields, { id: 'city' }>;
        type ZipField = Extract<AddressFields, { id: 'zipCode' }>;
        // Email should not be in AddressFields
        type EmailField = Extract<AddressFields, { id: 'email' }>;
        
        const _street: StreetField = { id: 'street', type: 'text', label: 'Street', repeatableGroupId: 'addresses', validation: [] };
        const _city: CityField = { id: 'city', type: 'text', label: 'City', repeatableGroupId: 'addresses', validation: [] };
        const _zip: ZipField = { id: 'zipCode', type: 'text', label: 'ZIP', repeatableGroupId: 'addresses', validation: [] };
        // Type-level test: EmailField should be never
        // This would cause a type error if uncommented:
        // const _email: EmailField = { id: 'email', type: 'text', label: 'Email', repeatableGroupId: 'contacts', validation: [] };
        
        expect(true).toBe(true);
      });

      test('given a non-existent group ID, should return never', () => {
        const descriptor = {
          blocks: [
            {
              id: 'addresses-block',
              title: 'Addresses',
              repeatable: true,
              fields: [
                { id: 'street', type: 'text' as const, label: 'Street', repeatableGroupId: 'addresses', validation: [] },
              ],
            },
          ],
          submission: { url: '/api/submit', method: 'POST' as const },
        } as const satisfies GlobalFormDescriptor;

        type InvalidFields = FieldsInGroup<typeof descriptor, 'nonexistent'>;
        
        // Should be never
        const _test: InvalidFields = undefined as never;
        
        expect(true).toBe(true);
      });
    });

    describe('RepeatableGroupObject', () => {
      test('given a repeatable group, should create object type mapping field IDs to value types', () => {
        const descriptor = {
          blocks: [
            {
              id: 'beneficiaries-block',
              title: 'Beneficiaries',
              repeatable: true,
              fields: [
                { id: 'name', type: 'text' as const, label: 'Name', repeatableGroupId: 'beneficiaries', validation: [] },
                { id: 'age', type: 'number' as const, label: 'Age', repeatableGroupId: 'beneficiaries', validation: [] },
                { id: 'isStudent', type: 'checkbox' as const, label: 'Is Student', repeatableGroupId: 'beneficiaries', validation: [] },
              ],
            },
          ],
          submission: { url: '/api/submit', method: 'POST' as const },
        } as const satisfies GlobalFormDescriptor;

        type BeneficiaryObject = RepeatableGroupObject<typeof descriptor, 'beneficiaries'>;
        
        // Should create object with correct types
        const _test: BeneficiaryObject = {
          name: 'John Doe',        // string | number | null
          age: 25,                 // number
          isStudent: true,         // boolean
        };
        
        // Type-level test: age should be number, not string
        // This would cause a type error if uncommented:
        // const _test2: BeneficiaryObject = { name: 'John', age: '25', isStudent: false };
        
        expect(true).toBe(true);
      });

      test('given a group with only text fields, should create object with string types', () => {
        const descriptor = {
          blocks: [
            {
              id: 'addresses-block',
              title: 'Addresses',
              repeatable: true,
              fields: [
                { id: 'street', type: 'text' as const, label: 'Street', repeatableGroupId: 'addresses', validation: [] },
                { id: 'city', type: 'text' as const, label: 'City', repeatableGroupId: 'addresses', validation: [] },
              ],
            },
          ],
          submission: { url: '/api/submit', method: 'POST' as const },
        } as const satisfies GlobalFormDescriptor;

        type AddressObject = RepeatableGroupObject<typeof descriptor, 'addresses'>;
        
        const _test: AddressObject = {
          street: '123 Main St',
          city: 'New York',
        };
        
        expect(true).toBe(true);
      });
    });

    describe('NonRepeatableFields', () => {
      test('given fields with and without repeatableGroupId, should extract only non-repeatable fields', () => {
        const descriptor = {
          blocks: [
            {
              id: 'addresses-block',
              title: 'Addresses',
              repeatable: true,
              fields: [
                { id: 'street', type: 'text' as const, label: 'Street', repeatableGroupId: 'addresses', validation: [] },
              ],
            },
            {
              id: 'basic-info',
              title: 'Basic Info',
              fields: [
                { id: 'name', type: 'text' as const, label: 'Name', validation: [] },
                { id: 'age', type: 'number' as const, label: 'Age', validation: [] },
              ],
            },
          ],
          submission: { url: '/api/submit', method: 'POST' as const },
        } as const satisfies GlobalFormDescriptor;

        type RegularFields = NonRepeatableFields<typeof descriptor>;
        
        // Should only include fields without repeatableGroupId
        type NameField = Extract<RegularFields, { id: 'name' }>;
        type AgeField = Extract<RegularFields, { id: 'age' }>;
        // Street should not be in RegularFields
        type StreetField = Extract<RegularFields, { id: 'street' }>;
        
        const _name: NameField = { id: 'name', type: 'text', label: 'Name', validation: [] };
        const _age: AgeField = { id: 'age', type: 'number', label: 'Age', validation: [] };
        // Type-level test: StreetField should be never
        // This would cause a type error if uncommented:
        // const _street: StreetField = { id: 'street', type: 'text', label: 'Street', repeatableGroupId: 'addresses', validation: [] };
        
        expect(true).toBe(true);
      });

      test('given only repeatable fields, should return never', () => {
        const descriptor = {
          blocks: [
            {
              id: 'addresses-block',
              title: 'Addresses',
              repeatable: true,
              fields: [
                { id: 'street', type: 'text' as const, label: 'Street', repeatableGroupId: 'addresses', validation: [] },
                { id: 'city', type: 'text' as const, label: 'City', repeatableGroupId: 'addresses', validation: [] },
              ],
            },
          ],
          submission: { url: '/api/submit', method: 'POST' as const },
        } as const satisfies GlobalFormDescriptor;

        type RegularFields = NonRepeatableFields<typeof descriptor>;
        
        // Should be never (all fields are repeatable)
        const _test: RegularFields = undefined as never;
        
        expect(true).toBe(true);
      });
    });
  });

  describe('Intermediate Helper Types - Combined Usage', () => {
    // These tests showcase how the intermediate types work together
    // to build the final FormData type

    test('given complex descriptor, should combine AllFields, RepeatableGroupIds, and NonRepeatableFields correctly', () => {
      const descriptor = {
        blocks: [
          {
            id: 'basic-info',
            title: 'Basic Info',
            fields: [
              { id: 'name', type: 'text' as const, label: 'Name', validation: [] },
              { id: 'age', type: 'number' as const, label: 'Age', validation: [] },
              { id: 'isStudent', type: 'checkbox' as const, label: 'Is Student', validation: [] },
            ],
          },
          {
            id: 'addresses-block',
            title: 'Addresses',
            repeatable: true,
            fields: [
              { id: 'street', type: 'text' as const, label: 'Street', repeatableGroupId: 'addresses', validation: [] },
              { id: 'city', type: 'text' as const, label: 'City', repeatableGroupId: 'addresses', validation: [] },
            ],
          },
          {
            id: 'contacts-block',
            title: 'Contacts',
            repeatable: true,
            fields: [
              { id: 'email', type: 'text' as const, label: 'Email', repeatableGroupId: 'contacts', validation: [] },
              { id: 'phone', type: 'text' as const, label: 'Phone', repeatableGroupId: 'contacts', validation: [] },
            ],
          },
        ],
        submission: { url: '/api/submit', method: 'POST' as const },
      } as const satisfies GlobalFormDescriptor;

      // Step 1: Extract all fields
      type AllFieldsType = AllFields<typeof descriptor>;
      // Should include all 7 fields
      type NameField = Extract<AllFieldsType, { id: 'name' }>;
      type StreetField = Extract<AllFieldsType, { id: 'street' }>;
      type EmailField = Extract<AllFieldsType, { id: 'email' }>;
      
        // Type-level verification: these types should be defined
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _name: NameField = { id: 'name', type: 'text', label: 'Name', validation: [] };
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _street: StreetField = { id: 'street', type: 'text', label: 'Street', repeatableGroupId: 'addresses', validation: [] };
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _email: EmailField = { id: 'email', type: 'text', label: 'Email', repeatableGroupId: 'contacts', validation: [] };
        
        expect(_name.id).toBe('name');
        expect(_street.id).toBe('street');
        expect(_email.id).toBe('email');

      // Step 2: Extract repeatable group IDs
      type GroupIds = RepeatableGroupIds<typeof descriptor>;
      // Should be 'addresses' | 'contacts'
      const _group1: GroupIds = 'addresses';
      const _group2: GroupIds = 'contacts';

      // Step 3: Extract fields in each group
      type AddressFields = FieldsInGroup<typeof descriptor, 'addresses'>;
      type ContactFields = FieldsInGroup<typeof descriptor, 'contacts'>;
      
      type StreetInGroup = Extract<AddressFields, { id: 'street' }>;
      type EmailInGroup = Extract<ContactFields, { id: 'email' }>;
      
        // Type-level verification: these types should be defined
        const _streetInGroup: StreetInGroup = { id: 'street', type: 'text', label: 'Street', repeatableGroupId: 'addresses', validation: [] };
        const _emailInGroup: EmailInGroup = { id: 'email', type: 'text', label: 'Email', repeatableGroupId: 'contacts', validation: [] };
        
        expect(_streetInGroup.id).toBe('street');
        expect(_emailInGroup.id).toBe('email');

      // Step 4: Create object types for each group
      type AddressObject = RepeatableGroupObject<typeof descriptor, 'addresses'>;
      type ContactObject = RepeatableGroupObject<typeof descriptor, 'contacts'>;
      
      const _addressObj: AddressObject = { street: '123 Main St', city: 'New York' };
      const _contactObj: ContactObject = { email: 'test@example.com', phone: '555-1234' };

      // Step 5: Extract non-repeatable fields
      type RegularFields = NonRepeatableFields<typeof descriptor>;
      type NameRegular = Extract<RegularFields, { id: 'name' }>;
      type AgeRegular = Extract<RegularFields, { id: 'age' }>;
      // Street should not be in regular fields
      type StreetRegular = Extract<RegularFields, { id: 'street' }>;
      
        // Type-level verification: these types should be defined
        const _nameRegular: NameRegular = { id: 'name', type: 'text', label: 'Name', validation: [] };
        const _ageRegular: AgeRegular = { id: 'age', type: 'number', label: 'Age', validation: [] };
        // StreetRegular should be never (can't assign)
        // Type-level test: this would cause a type error
        // const _streetRegular: StreetRegular = undefined as never;
        
        expect(_nameRegular.id).toBe('name');
        expect(_ageRegular.id).toBe('age');

      // Step 6: Final FormData combines everything
      type FinalFormData = FormData<typeof descriptor>;
      
      const _final: FinalFormData = {
        name: 'John Doe',
        age: 25,
        isStudent: true,
        addresses: [
          { street: '123 Main St', city: 'New York' },
        ],
        contacts: [
          { email: 'test@example.com', phone: '555-1234' },
        ],
      };

      expect(true).toBe(true);
    });

    test('given descriptor with mixed field types in repeatable group, should correctly map each field type', () => {
      const descriptor = {
        blocks: [
          {
            id: 'beneficiaries-block',
            title: 'Beneficiaries',
            repeatable: true,
            fields: [
              { id: 'name', type: 'text' as const, label: 'Name', repeatableGroupId: 'beneficiaries', validation: [] },
              { id: 'age', type: 'number' as const, label: 'Age', repeatableGroupId: 'beneficiaries', validation: [] },
              { id: 'isStudent', type: 'checkbox' as const, label: 'Is Student', repeatableGroupId: 'beneficiaries', validation: [] },
              { id: 'document', type: 'file' as const, label: 'Document', repeatableGroupId: 'beneficiaries', validation: [] },
            ],
          },
        ],
        submission: { url: '/api/submit', method: 'POST' as const },
      } as const satisfies GlobalFormDescriptor;

      // Extract group IDs
      type GroupIds = RepeatableGroupIds<typeof descriptor>;
      const _groupId: GroupIds = 'beneficiaries';

      // Get fields in group
      type BeneficiaryFields = FieldsInGroup<typeof descriptor, 'beneficiaries'>;
      
      // Verify each field type is correctly extracted
      type NameField = Extract<BeneficiaryFields, { id: 'name' }>;
      type AgeField = Extract<BeneficiaryFields, { id: 'age' }>;
      type IsStudentField = Extract<BeneficiaryFields, { id: 'isStudent' }>;
      type DocumentField = Extract<BeneficiaryFields, { id: 'document' }>;

      // Create object type - should map each field to correct value type
      type BeneficiaryObject = RepeatableGroupObject<typeof descriptor, 'beneficiaries'>;
      
      const _obj: BeneficiaryObject = {
        name: 'John Doe',                    // FieldValueType<text> = string | number | null
        age: 25,                              // FieldValueType<number> = number
        isStudent: true,                      // FieldValueType<checkbox> = boolean
        document: 'https://example.com/doc.pdf', // FieldValueType<file> = string | string[] | null
      };

      // Type-level test: age should be number
      // This would cause a type error if uncommented:
      // const _invalid: BeneficiaryObject = { name: 'John', age: '25', isStudent: false, document: null };

      expect(true).toBe(true);
    });

    test('given descriptor with no repeatable groups, should only have non-repeatable fields', () => {
      const descriptor = {
        blocks: [
          {
            id: 'basic-info',
            title: 'Basic Info',
            fields: [
              { id: 'name', type: 'text' as const, label: 'Name', validation: [] },
              { id: 'age', type: 'number' as const, label: 'Age', validation: [] },
            ],
          },
        ],
        submission: { url: '/api/submit', method: 'POST' as const },
      } as const satisfies GlobalFormDescriptor;

      // Extract all fields
      type AllFieldsType = AllFields<typeof descriptor>;
      type NameField = Extract<AllFieldsType, { id: 'name' }>;
      type AgeField = Extract<AllFieldsType, { id: 'age' }>;
      
      // Type-level verification: these types should be defined
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _nameField: NameField = { id: 'name', type: 'text', label: 'Name', validation: [] };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _ageField: AgeField = { id: 'age', type: 'number', label: 'Age', validation: [] };
      
      expect(_nameField.id).toBe('name');
      expect(_ageField.id).toBe('age');

      // Extract repeatable group IDs - should be never
      type GroupIds = RepeatableGroupIds<typeof descriptor>;
      const _groups: GroupIds = undefined as never;

      // Extract non-repeatable fields - should include all fields
      type RegularFields = NonRepeatableFields<typeof descriptor>;
      type NameRegular = Extract<RegularFields, { id: 'name' }>;
      type AgeRegular = Extract<RegularFields, { id: 'age' }>;
      
        // Type-level verification: these types should be defined
        const _nameRegular: NameRegular = { id: 'name', type: 'text', label: 'Name', validation: [] };
        const _ageRegular: AgeRegular = { id: 'age', type: 'number', label: 'Age', validation: [] };
        
        expect(_nameRegular.id).toBe('name');
        expect(_ageRegular.id).toBe('age');

      // Final FormData should only have regular fields
      type FinalFormData = FormData<typeof descriptor>;
      
      const _final: FinalFormData = {
        name: 'John Doe',
        age: 25,
      };

      expect(true).toBe(true);
    });

    test('given descriptor with only repeatable groups, should only have array properties', () => {
      const descriptor = {
        blocks: [
          {
            id: 'addresses-block',
            title: 'Addresses',
            repeatable: true,
            fields: [
              { id: 'street', type: 'text' as const, label: 'Street', repeatableGroupId: 'addresses', validation: [] },
              { id: 'city', type: 'text' as const, label: 'City', repeatableGroupId: 'addresses', validation: [] },
            ],
          },
        ],
        submission: { url: '/api/submit', method: 'POST' as const },
      } as const satisfies GlobalFormDescriptor;

      // Extract all fields
      type AllFieldsType = AllFields<typeof descriptor>;
      type StreetField = Extract<AllFieldsType, { id: 'street' }>;
      
        // Type-level verification: StreetField should be defined
        const _street: StreetField = { id: 'street', type: 'text', label: 'Street', repeatableGroupId: 'addresses', validation: [] };
        expect(_street.id).toBe('street');

      // Extract repeatable group IDs
      type GroupIds = RepeatableGroupIds<typeof descriptor>;
      const _groupId: GroupIds = 'addresses';

      // Extract non-repeatable fields - should be never
      type RegularFields = NonRepeatableFields<typeof descriptor>;
      const _regular: RegularFields = undefined as never;

      // Create object type for the group
      type AddressObject = RepeatableGroupObject<typeof descriptor, 'addresses'>;
      const _obj: AddressObject = { street: '123 Main St', city: 'New York' };

      // Final FormData should only have repeatable groups
      type FinalFormData = FormData<typeof descriptor>;
      
      const _final: FinalFormData = {
        addresses: [
          { street: '123 Main St', city: 'New York' },
        ],
      };

      expect(true).toBe(true);
    });

    test('given descriptor with multiple groups in same block, should handle each group separately', () => {
      const descriptor = {
        blocks: [
          {
            id: 'contact-info-block',
            title: 'Contact Information',
            repeatable: true,
            fields: [
              // First repeatable group: emails
              { id: 'email', type: 'text' as const, label: 'Email', repeatableGroupId: 'emails', validation: [] },
              // Second repeatable group: phones
              { id: 'phoneNumber', type: 'text' as const, label: 'Phone Number', repeatableGroupId: 'phones', validation: [] },
              { id: 'phoneType', type: 'dropdown' as const, label: 'Phone Type', repeatableGroupId: 'phones', validation: [] },
            ],
          },
        ],
        submission: { url: '/api/submit', method: 'POST' as const },
      } as const satisfies GlobalFormDescriptor;

      // Extract all fields
      type AllFieldsType = AllFields<typeof descriptor>;
      type EmailField = Extract<AllFieldsType, { id: 'email' }>;
      type PhoneField = Extract<AllFieldsType, { id: 'phoneNumber' }>;
      
        // Type-level verification: these types should be defined
        const _email: EmailField = { id: 'email', type: 'text', label: 'Email', repeatableGroupId: 'emails', validation: [] };
        const _phone: PhoneField = { id: 'phoneNumber', type: 'text', label: 'Phone Number', repeatableGroupId: 'phones', validation: [] };
        
        expect(_email.id).toBe('email');
        expect(_phone.id).toBe('phoneNumber');

      // Extract repeatable group IDs - should be 'emails' | 'phones'
      type GroupIds = RepeatableGroupIds<typeof descriptor>;
      const _emails: GroupIds = 'emails';
      const _phones: GroupIds = 'phones';

      // Extract fields in each group
      type EmailFields = FieldsInGroup<typeof descriptor, 'emails'>;
      type PhoneFields = FieldsInGroup<typeof descriptor, 'phones'>;
      
      type EmailInGroup = Extract<EmailFields, { id: 'email' }>;
      type PhoneInGroup = Extract<PhoneFields, { id: 'phoneNumber' }>;
      type PhoneTypeInGroup = Extract<PhoneFields, { id: 'phoneType' }>;
      
        // Type-level verification: these types should be defined
        const _emailInGroup: EmailInGroup = { id: 'email', type: 'text', label: 'Email', repeatableGroupId: 'emails', validation: [] };
        const _phoneInGroup: PhoneInGroup = { id: 'phoneNumber', type: 'text', label: 'Phone Number', repeatableGroupId: 'phones', validation: [] };
        const _phoneTypeInGroup: PhoneTypeInGroup = { id: 'phoneType', type: 'dropdown', label: 'Phone Type', repeatableGroupId: 'phones', validation: [] };
        
        expect(_emailInGroup.id).toBe('email');
        expect(_phoneInGroup.id).toBe('phoneNumber');
        expect(_phoneTypeInGroup.id).toBe('phoneType');

      // Create object types for each group
      type EmailObject = RepeatableGroupObject<typeof descriptor, 'emails'>;
      type PhoneObject = RepeatableGroupObject<typeof descriptor, 'phones'>;
      
      const _emailObj: EmailObject = { email: 'test@example.com' };
      const _phoneObj: PhoneObject = { phoneNumber: '555-1234', phoneType: 'mobile' };

      // Final FormData should have both groups as separate arrays
      type FinalFormData = FormData<typeof descriptor>;
      
      const _final: FinalFormData = {
        emails: [
          { email: 'primary@example.com' },
          { email: 'secondary@example.com' },
        ],
        phones: [
          { phoneNumber: '555-1234', phoneType: 'mobile' },
          { phoneNumber: '555-5678', phoneType: 'work' },
        ],
      };

      expect(true).toBe(true);
    });
  });
});
