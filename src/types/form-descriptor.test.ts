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
      const descriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'addresses-block',
            title: 'Addresses',
            repeatable: true,
            fields: [
              {
                id: 'street',
                type: 'text',
                label: 'Street',
                repeatableGroupId: 'addresses',
                validation: [],
              },
              {
                id: 'city',
                type: 'text',
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
                type: 'text',
                label: 'Name',
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

      // FormData should have addresses as array of objects, and name as string
      const formData: FormData<typeof descriptor> = {
        addresses: [
          { street: '123 Main St', city: 'New York' },
          { street: '456 Oak Ave', city: 'Boston' },
        ],
        name: 'John Doe',
      };

      expect(formData.addresses).toBeDefined();
      expect(Array.isArray(formData.addresses)).toBe(true);
      expect(formData.addresses?.[0]).toHaveProperty('street');
      expect(formData.addresses?.[0]).toHaveProperty('city');
      expect(formData.name).toBe('John Doe');
    });

    test('given a descriptor with multiple repeatable groups, should support multiple array properties', () => {
      const descriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'addresses-block',
            title: 'Addresses',
            repeatable: true,
            fields: [
              {
                id: 'street',
                type: 'text',
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
                type: 'text',
                label: 'Email',
                repeatableGroupId: 'contacts',
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

      const formData: FormData<typeof descriptor> = {
        addresses: [{ street: '123 Main St' }],
        contacts: [{ email: 'test@example.com' }],
      };

      expect(formData.addresses).toBeDefined();
      expect(formData.contacts).toBeDefined();
      expect(Array.isArray(formData.addresses)).toBe(true);
      expect(Array.isArray(formData.contacts)).toBe(true);
    });

    test('given a descriptor with empty repeatable group, should allow empty array', () => {
      const descriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'addresses-block',
            title: 'Addresses',
            repeatable: true,
            fields: [
              {
                id: 'street',
                type: 'text',
                label: 'Street',
                repeatableGroupId: 'addresses',
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

      const formData: FormData<typeof descriptor> = {
        addresses: [],
      };

      expect(formData.addresses).toBeDefined();
      expect(Array.isArray(formData.addresses)).toBe(true);
      expect(formData.addresses?.length).toBe(0);
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
});
