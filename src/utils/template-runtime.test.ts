/**
 * Tests for the CSP-safe template walk.
 *
 * The service-card template nests itemIf, withChildren, radioGroup, and item
 * inside jsonItems. These tests check that the walk evaluates that shape.
 */

import { describe, test, expect } from 'vitest';
import Handlebars from 'handlebars';
import { renderTemplate, type TemplateNode } from './template-runtime';

const serviceCardsTemplate = [
  '{{jsonItems',
  "(itemIf (eq formData.withSignatory true) 'mscq' 'screens.common.card-label.MSCQ' caseContext.casePrefilling.serviceBlock.mscq)",
  "(itemIf (eq formData.withSignatory true) 'mscqRussia' 'screens.common.card-label.MSCQ_RUSSIA' caseContext.casePrefilling.serviceBlock.mscqRussia)",
  "(itemIf (eq formData.withSignatory true) 'fatca' 'screens.common.card-label.FATCA' caseContext.casePrefilling.serviceBlock.fatca)",
  "(itemIf true 'declaration' 'screens.common.card-label.RELATIONSHIP_DECLARATION' caseContext.casePrefilling.serviceBlock.declaration)",
  '(withChildren',
  "(itemIf (or (eq formData.withSignatory true) (eq formData.dueDiligenceCheckbox true)) 'dueDiligenceCheckbox' 'screens.common.due-diligence' true)",
  "(radioGroup 'uboNode'",
  "(item caseContext.dueDiligenceItems.[0].label 'DD_ENHANCED')",
  "(item caseContext.dueDiligenceItems.[1].label 'DD_REGULAR')))}}",
].join(' ');

type ServiceBlock = {
  mscq?: unknown;
  mscqRussia?: unknown;
  fatca?: unknown;
  declaration?: unknown;
};

type DiligenceItem = {
  label?: string;
};

function createCardContext({
  withSignatory = false,
  dueDiligenceCheckbox = false,
  serviceBlock = {
    mscq: 'mscq-prefill',
    mscqRussia: 'mscq-russia-prefill',
    fatca: 'fatca-prefill',
    declaration: 'declaration-prefill',
  },
  dueDiligenceItems = [{ label: 'Enhanced' }, { label: 'Regular' }],
}: {
  withSignatory?: boolean;
  dueDiligenceCheckbox?: boolean;
  serviceBlock?: ServiceBlock;
  dueDiligenceItems?: DiligenceItem[];
} = {}) {
  return {
    formData: { withSignatory, dueDiligenceCheckbox },
    caseContext: {
      casePrefilling: { serviceBlock },
      dueDiligenceItems,
    },
  };
}

function render(template: string, context: unknown): string {
  return renderTemplate(Handlebars.parse(template) as TemplateNode, context);
}

function declarationCard(value: unknown = 'declaration-prefill') {
  return {
    id: 'declaration',
    label: 'screens.common.card-label.RELATIONSHIP_DECLARATION',
    value,
  };
}

function dueDiligenceCard({
  enhancedLabel = 'Enhanced',
  regularLabel = 'Regular',
}: {
  enhancedLabel?: string;
  regularLabel?: string;
} = {}) {
  return {
    id: 'dueDiligenceCheckbox',
    label: 'screens.common.due-diligence',
    value: true,
    children: {
      id: 'uboNode',
      type: 'radio',
      items: [
        { label: enhancedLabel, value: 'DD_ENHANCED' },
        { label: regularLabel, value: 'DD_REGULAR' },
      ],
    },
  };
}

describe('renderTemplate', () => {
  describe('service card template', () => {
    test('given a selected signatory, should include every service card and nest the radio group', () => {
      const rendered = render(serviceCardsTemplate, createCardContext({ withSignatory: true }));

      expect(rendered).toBe(JSON.stringify([
        {
          id: 'mscq',
          label: 'screens.common.card-label.MSCQ',
          value: 'mscq-prefill',
        },
        {
          id: 'mscqRussia',
          label: 'screens.common.card-label.MSCQ_RUSSIA',
          value: 'mscq-russia-prefill',
        },
        {
          id: 'fatca',
          label: 'screens.common.card-label.FATCA',
          value: 'fatca-prefill',
        },
        declarationCard(),
        dueDiligenceCard(),
      ]));
    });

    test('given only the due diligence checkbox, should keep declaration and due diligence and stringify the other cards as null', () => {
      const rendered = render(
        serviceCardsTemplate,
        createCardContext({ dueDiligenceCheckbox: true })
      );

      expect(JSON.parse(rendered)).toEqual([
        null,
        null,
        null,
        declarationCard(),
        dueDiligenceCard(),
      ]);
    });

    test('given neither signatory nor due diligence, should keep the declaration and drop the due diligence parent', () => {
      const rendered = render(serviceCardsTemplate, createCardContext());

      expect(JSON.parse(rendered)).toEqual([
        null,
        null,
        null,
        declarationCard(),
        null,
      ]);
    });

    test('given a missing diligence label, should omit that property from the radio item', () => {
      const rendered = render(
        serviceCardsTemplate,
        createCardContext({
          withSignatory: true,
          dueDiligenceItems: [{}, { label: 'Regular' }],
        })
      );
      const cards = JSON.parse(rendered) as Array<{
        children: { items: Array<Record<string, string>> };
      }>;

      expect(cards[4].children.items).toEqual([
        { value: 'DD_ENHANCED' },
        { label: 'Regular', value: 'DD_REGULAR' },
      ]);
    });
  });

  describe('each data variables', () => {
    test('given an each loop, should mark the first and last items', () => {
      const template = '{{#each items}}[{{@index}}:{{@first}}:{{@last}}:{{@key}}:{{name}}]{{/each}}';

      expect(render(template, {
        items: [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
      })).toBe('[0:true:false:0:a][1:false:false:1:b][2:false:true:2:c]');
    });

    test('given one each item, should mark it both first and last', () => {
      const template = '{{#each items}}{{#if @first}}F{{/if}}{{#if @last}}L{{/if}}{{/each}}';

      expect(render(template, { items: [{ name: 'only' }] })).toBe('FL');
    });

    test('given a nested each, should read the parent loop flags', () => {
      const template = '{{#each groups}}{{#each items}}{{@../index}}.{{@index}}{{#if @../first}}P{{/if}}{{#if @last}}L{{/if}} {{/each}}{{/each}}';

      expect(render(template, {
        groups: [{ items: ['a', 'b'] }, { items: ['c'] }],
      })).toBe('0.0P 0.1PL 1.0L ');
    });

    test('given @root inside each, should read the top context', () => {
      const template = '{{#each items}}{{@root.title}}:{{name}} {{/each}}';

      expect(render(template, {
        title: 'T',
        items: [{ name: 'a' }, { name: 'b' }],
      })).toBe('T:a T:b ');
    });

    test('given @first outside each, should render nothing', () => {
      expect(render('{{@first}}|{{@last}}', { first: true, last: true })).toBe('|');
    });
  });

  describe('radio group items', () => {
    test('given a failed itemIf inside a radio group, should omit that item', () => {
      const template = "{{jsonItems (radioGroup 'uboNode' (itemIf false 'hidden' 'screens.common.hidden' 'nope') (item 'Regular' 'DD_REGULAR'))}}";

      expect(render(template, {})).toBe(JSON.stringify([{
        id: 'uboNode',
        type: 'radio',
        items: [{ label: 'Regular', value: 'DD_REGULAR' }],
      }]));
    });
  });
});
