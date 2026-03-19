import { describe, test } from 'vitest';
import type { BlockDescriptor, FieldDescriptor } from '@/types/form-descriptor';
import { buildBlockLayoutRows } from './block-layout';

const createField = (id: string, layout?: FieldDescriptor['layout']): FieldDescriptor => ({
  id,
  type: 'checkbox',
  label: id,
  validation: [],
  layout,
});

const createBlock = (layout?: BlockDescriptor['layout']): BlockDescriptor => ({
  id: 'block',
  title: 'Block',
  fields: [],
  layout,
});

describe('buildBlockLayoutRows', () => {
  test('default mode renders one field per row full-width', () => {
    const block = createBlock();
    const fields = [createField('a'), createField('b')];

    const rows = buildBlockLayoutRows(block, fields);

    if (rows.length !== 2) {
      throw new Error(`expected 2 rows, got ${rows.length}`);
    }
    if (rows[0].slots.length !== 1 || rows[0].slots[0].fields[0].id !== 'a') {
      throw new Error('first row should contain field a');
    }
    if (rows[1].slots.length !== 1 || rows[1].slots[0].fields[0].id !== 'b') {
      throw new Error('second row should contain field b');
    }
  });

  test('2-column grid packs two half-width ungrouped fields per row', () => {
    const block = createBlock({ mode: 'grid', columns: 2 });
    const fields = [
      createField('a', { width: 'half' }),
      createField('b', { width: 'half' }),
      createField('c', { width: 'half' }),
      createField('d', { width: 'half' }),
    ];

    const rows = buildBlockLayoutRows(block, fields);

    if (rows.length !== 2) {
      throw new Error(`expected 2 rows, got ${rows.length}`);
    }
  });

  test('3 rows x 2 columns for six half-width checkboxes', () => {
    const block = createBlock({ mode: 'grid', columns: 2 });
    const fields = [
      createField('pref1', { width: 'half' }),
      createField('pref2', { width: 'half' }),
      createField('pref3', { width: 'half' }),
      createField('pref4', { width: 'half' }),
      createField('pref5', { width: 'half' }),
      createField('pref6', { width: 'half' }),
    ];

    const rows = buildBlockLayoutRows(block, fields);

    if (rows.length !== 3) {
      throw new Error(`expected 3 rows, got ${rows.length}`);
    }
  });

  test('full-width field in 2-column grid gets colSpan 2', () => {
    const block = createBlock({ mode: 'grid', columns: 2 });
    const fields = [
      createField('a', { width: 'half' }),
      createField('b', { width: 'half' }),
      createField('c', { width: 'full' }),
    ];

    const rows = buildBlockLayoutRows(block, fields);

    if (rows.length !== 2) {
      throw new Error(`expected 2 rows, got ${rows.length}`);
    }
    const fullRow = rows[1];
    if (fullRow.slots.length !== 1) {
      throw new Error('full-width row should have exactly one slot');
    }
    if (fullRow.slots[0].colSpan !== 2) {
      throw new Error(`expected colSpan 2, got ${fullRow.slots[0].colSpan}`);
    }
  });

  test('full-width field in 3-column grid gets colSpan 3', () => {
    const block = createBlock({ mode: 'grid', columns: 3 });
    const fields = [
      createField('a', { width: 'third' }),
      createField('b', { width: 'third' }),
      createField('c', { width: 'third' }),
      createField('d', { width: 'full' }),
    ];

    const rows = buildBlockLayoutRows(block, fields);

    if (rows.length !== 2) {
      throw new Error(`expected 2 rows, got ${rows.length}`);
    }
    const fullRow = rows[1];
    if (fullRow.slots.length !== 1) {
      throw new Error('full-width row should have exactly one slot');
    }
    if (fullRow.slots[0].colSpan !== 3) {
      throw new Error(`expected colSpan 3, got ${fullRow.slots[0].colSpan}`);
    }
  });

  test('half-width fields in 2-column grid have no colSpan', () => {
    const block = createBlock({ mode: 'grid', columns: 2 });
    const fields = [createField('a', { width: 'half' }), createField('b', { width: 'half' })];

    const rows = buildBlockLayoutRows(block, fields);

    rows[0].slots.forEach((slot) => {
      if (slot.colSpan !== undefined) {
        throw new Error(`expected no colSpan on half-width slot, got ${slot.colSpan}`);
      }
    });
  });

  test('edge case: leftStack + right in 2-column group', () => {
    const block = createBlock({ mode: 'grid', columns: 2 });
    const fields = [
      createField('a', { width: 'half', groupId: 'g', groupRole: 'leftStack' }),
      createField('b', { width: 'half', groupId: 'g', groupRole: 'leftStack' }),
      createField('c', { width: 'half', groupId: 'g', groupRole: 'right' }),
    ];

    const rows = buildBlockLayoutRows(block, fields);

    if (rows.length === 0) {
      throw new Error('expected at least one row');
    }
  });
});

