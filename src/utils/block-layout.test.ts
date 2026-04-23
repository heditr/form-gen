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

  test('edge case: left + rightStack in 2-column group', () => {
    const block = createBlock({ mode: 'grid', columns: 2 });
    const fields = [
      createField('a', { width: 'half', groupId: 'g', groupRole: 'left' }),
      createField('b', { width: 'half', groupId: 'g', groupRole: 'rightStack' }),
      createField('c', { width: 'half', groupId: 'g', groupRole: 'rightStack' }),
    ];

    const rows = buildBlockLayoutRows(block, fields);

    if (rows.length !== 1) {
      throw new Error(`expected 1 row, got ${rows.length}`);
    }
    if (rows[0].slots.length !== 2) {
      throw new Error(`expected 2 slots, got ${rows[0].slots.length}`);
    }
    const leftIds = rows[0].slots[0].fields.map((f) => f.id);
    const rightIds = rows[0].slots[1].fields.map((f) => f.id);
    if (leftIds.length !== 1 || leftIds[0] !== 'a') {
      throw new Error(`expected left slot to contain ['a'], got: ${JSON.stringify(leftIds)}`);
    }
    if (rightIds.length !== 2 || !rightIds.includes('b') || !rightIds.includes('c')) {
      throw new Error(`expected right slot to contain ['b','c'], got: ${JSON.stringify(rightIds)}`);
    }
  });

  // ── Natural field order ─────────────────────────────────────────────────────

  test('grouped field appearing first in descriptor produces the first row', () => {
    const block = createBlock({ mode: 'grid', columns: 2 });
    // 'first' and 'second' are grouped together and both appear before 'last'
    const fields = [
      createField('first', { width: 'half', groupId: 'inline' }),
      createField('second', { width: 'half', groupId: 'inline' }),
      createField('last', { width: 'full' }),
    ];

    const rows = buildBlockLayoutRows(block, fields);

    if (rows.length !== 2) {
      throw new Error(`expected 2 rows, got ${rows.length}`);
    }
    const firstRowFieldIds = rows[0].slots.flatMap((s) => s.fields.map((f) => f.id));
    if (!firstRowFieldIds.includes('first')) {
      throw new Error(`grouped field 'first' should appear in row 0, got: ${JSON.stringify(firstRowFieldIds)}`);
    }
    const secondRowFieldIds = rows[1].slots.flatMap((s) => s.fields.map((f) => f.id));
    if (!secondRowFieldIds.includes('last')) {
      throw new Error(`ungrouped field 'last' should appear in row 1, got: ${JSON.stringify(secondRowFieldIds)}`);
    }
  });

  test('ungrouped field before a group stays before the group row', () => {
    const block = createBlock({ mode: 'grid', columns: 2 });
    const fields = [
      createField('top', { width: 'full' }),
      createField('left', { width: 'half', groupId: 'pair' }),
      createField('right', { width: 'half', groupId: 'pair' }),
      createField('bottom', { width: 'full' }),
    ];

    const rows = buildBlockLayoutRows(block, fields);

    if (rows.length !== 3) {
      throw new Error(`expected 3 rows, got ${rows.length}`);
    }
    const row0 = rows[0].slots.flatMap((s) => s.fields.map((f) => f.id));
    const row1 = rows[1].slots.flatMap((s) => s.fields.map((f) => f.id));
    const row2 = rows[2].slots.flatMap((s) => s.fields.map((f) => f.id));
    if (!row0.includes('top')) throw new Error(`row 0 should contain 'top', got: ${JSON.stringify(row0)}`);
    if (!row1.includes('left') || !row1.includes('right')) throw new Error(`row 1 should contain the group pair, got: ${JSON.stringify(row1)}`);
    if (!row2.includes('bottom')) throw new Error(`row 2 should contain 'bottom', got: ${JSON.stringify(row2)}`);
  });

  test('multiple groups interleaved with ungrouped fields preserve descriptor order', () => {
    const block = createBlock({ mode: 'grid', columns: 2 });
    const fields = [
      createField('g1a', { width: 'half', groupId: 'group1' }),
      createField('standalone', { width: 'full' }),
      createField('g1b', { width: 'half', groupId: 'group1' }),
      createField('g2a', { width: 'half', groupId: 'group2' }),
      createField('g2b', { width: 'half', groupId: 'group2' }),
    ];

    const rows = buildBlockLayoutRows(block, fields);

    // group1 → row 0 (triggered by g1a)
    // standalone → row 1
    // group2 → row 2 (triggered by g2a)
    if (rows.length !== 3) {
      throw new Error(`expected 3 rows, got ${rows.length}`);
    }
    const row0Ids = rows[0].slots.flatMap((s) => s.fields.map((f) => f.id));
    if (!row0Ids.includes('g1a')) {
      throw new Error(`row 0 should contain group1 (g1a), got: ${JSON.stringify(row0Ids)}`);
    }
    const row1Ids = rows[1].slots.flatMap((s) => s.fields.map((f) => f.id));
    if (!row1Ids.includes('standalone')) {
      throw new Error(`row 1 should contain 'standalone', got: ${JSON.stringify(row1Ids)}`);
    }
    const row2Ids = rows[2].slots.flatMap((s) => s.fields.map((f) => f.id));
    if (!row2Ids.includes('g2a')) {
      throw new Error(`row 2 should contain group2 (g2a), got: ${JSON.stringify(row2Ids)}`);
    }
  });

  test('grouped field at position 0 produces first row even when other fields follow', () => {
    const block = createBlock({ mode: 'grid', columns: 2 });
    const fields = [
      createField('g-left', { width: 'half', groupId: 'topGroup' }),
      createField('g-right', { width: 'half', groupId: 'topGroup' }),
      createField('ungrouped-1', { width: 'half' }),
      createField('ungrouped-2', { width: 'half' }),
    ];

    const rows = buildBlockLayoutRows(block, fields);

    if (rows.length !== 2) {
      throw new Error(`expected 2 rows, got ${rows.length}`);
    }
    const firstSlotIds = rows[0].slots.flatMap((s) => s.fields.map((f) => f.id));
    if (!firstSlotIds.includes('g-left')) {
      throw new Error(`grouped fields should occupy the first row, got: ${JSON.stringify(firstSlotIds)}`);
    }
    const secondSlotIds = rows[1].slots.flatMap((s) => s.fields.map((f) => f.id));
    if (!secondSlotIds.includes('ungrouped-1')) {
      throw new Error(`ungrouped fields should occupy the second row, got: ${JSON.stringify(secondSlotIds)}`);
    }
  });

  test('half-width ungrouped fields buffered before a group are flushed as a row before the group', () => {
    const block = createBlock({ mode: 'grid', columns: 2 });
    const fields = [
      createField('solo-half', { width: 'half' }),
      createField('g-left', { width: 'half', groupId: 'g' }),
      createField('g-right', { width: 'half', groupId: 'g' }),
    ];

    const rows = buildBlockLayoutRows(block, fields);

    // solo-half → row 0 (flushed alone before group)
    // group g → row 1
    if (rows.length !== 2) {
      throw new Error(`expected 2 rows, got ${rows.length}`);
    }
    const row0Ids = rows[0].slots.flatMap((s) => s.fields.map((f) => f.id));
    if (!row0Ids.includes('solo-half')) {
      throw new Error(`row 0 should contain 'solo-half', got: ${JSON.stringify(row0Ids)}`);
    }
    const row1Ids = rows[1].slots.flatMap((s) => s.fields.map((f) => f.id));
    if (!row1Ids.includes('g-left')) {
      throw new Error(`row 1 should contain the group, got: ${JSON.stringify(row1Ids)}`);
    }
  });

  test('2-column grid renders third/third/third in one row with 3-column override', () => {
    const block = createBlock({ mode: 'grid', columns: 2 });
    const fields = [
      createField('t1', { width: 'third' }),
      createField('t2', { width: 'third' }),
      createField('t3', { width: 'third' }),
    ];

    const rows = buildBlockLayoutRows(block, fields);

    if (rows.length !== 1) {
      throw new Error(`expected 1 row, got ${rows.length}`);
    }
    if (rows[0].gridColumns !== 3) {
      throw new Error(`expected row gridColumns=3, got ${rows[0].gridColumns}`);
    }
    if (rows[0].slots.length !== 3) {
      throw new Error(`expected 3 slots, got ${rows[0].slots.length}`);
    }
  });

  test('3-column grid renders half/half in one row', () => {
    const block = createBlock({ mode: 'grid', columns: 3 });
    const fields = [
      createField('h1', { width: 'half' }),
      createField('h2', { width: 'half' }),
    ];

    const rows = buildBlockLayoutRows(block, fields);

    if (rows.length !== 1) {
      throw new Error(`expected 1 row, got ${rows.length}`);
    }
    if (rows[0].slots.length !== 2) {
      throw new Error(`expected 2 slots, got ${rows[0].slots.length}`);
    }
  });

  test('does not mix half and third in the same buffered row', () => {
    const block = createBlock({ mode: 'grid', columns: 2 });
    const fields = [
      createField('h1', { width: 'half' }),
      createField('t1', { width: 'third' }),
      createField('t2', { width: 'third' }),
      createField('t3', { width: 'third' }),
    ];

    const rows = buildBlockLayoutRows(block, fields);

    if (rows.length !== 2) {
      throw new Error(`expected 2 rows, got ${rows.length}`);
    }
    const row0Ids = rows[0].slots.flatMap((s) => s.fields.map((f) => f.id));
    const row1Ids = rows[1].slots.flatMap((s) => s.fields.map((f) => f.id));
    if (row0Ids.length !== 1 || row0Ids[0] !== 'h1') {
      throw new Error(`row 0 should contain only ['h1'], got ${JSON.stringify(row0Ids)}`);
    }
    if (!row1Ids.includes('t1') || !row1Ids.includes('t2') || !row1Ids.includes('t3')) {
      throw new Error(`row 1 should contain third triplet, got ${JSON.stringify(row1Ids)}`);
    }
  });

  test('2-column grouped third/third/third renders in one row with 3-column override', () => {
    const block = createBlock({ mode: 'grid', columns: 2 });
    const fields = [
      createField('g-t1', { width: 'third', groupId: 'g-third' }),
      createField('g-t2', { width: 'third', groupId: 'g-third' }),
      createField('g-t3', { width: 'third', groupId: 'g-third' }),
    ];

    const rows = buildBlockLayoutRows(block, fields);

    if (rows.length !== 1) {
      throw new Error(`expected 1 row, got ${rows.length}`);
    }
    if (rows[0].gridColumns !== 3) {
      throw new Error(`expected row gridColumns=3, got ${rows[0].gridColumns}`);
    }
    if (rows[0].slots.length !== 3) {
      throw new Error(`expected 3 slots, got ${rows[0].slots.length}`);
    }
  });

  test('3-column grouped half/half renders in one row', () => {
    const block = createBlock({ mode: 'grid', columns: 3 });
    const fields = [
      createField('g-h1', { width: 'half', groupId: 'g-half' }),
      createField('g-h2', { width: 'half', groupId: 'g-half' }),
    ];

    const rows = buildBlockLayoutRows(block, fields);

    if (rows.length !== 1) {
      throw new Error(`expected 1 row, got ${rows.length}`);
    }
    if (rows[0].slots.length !== 2) {
      throw new Error(`expected 2 slots, got ${rows[0].slots.length}`);
    }
  });

  test('grouped rows do not mix half and third widths', () => {
    const block = createBlock({ mode: 'grid', columns: 2 });
    const fields = [
      createField('g-half', { width: 'half', groupId: 'g-mixed' }),
      createField('g-third-1', { width: 'third', groupId: 'g-mixed' }),
      createField('g-third-2', { width: 'third', groupId: 'g-mixed' }),
      createField('g-third-3', { width: 'third', groupId: 'g-mixed' }),
    ];

    const rows = buildBlockLayoutRows(block, fields);

    if (rows.length !== 2) {
      throw new Error(`expected 2 rows, got ${rows.length}`);
    }
    const row0Ids = rows[0].slots.flatMap((s) => s.fields.map((f) => f.id));
    if (row0Ids.length !== 1 || row0Ids[0] !== 'g-half') {
      throw new Error(`row 0 should contain only ['g-half'], got ${JSON.stringify(row0Ids)}`);
    }
    if (rows[1].gridColumns !== 3) {
      throw new Error(`row 1 should use 3-column override, got ${rows[1].gridColumns}`);
    }
  });
});

