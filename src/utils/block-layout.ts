import type { BlockDescriptor, FieldDescriptor } from '@/types/form-descriptor';

export type LayoutSlotId = 'left' | 'right' | 'col1' | 'col2' | 'col3';

export interface LayoutSlot {
  id: LayoutSlotId;
  fields: FieldDescriptor[];
  colSpan?: number;
}

export interface LayoutRow {
  slots: LayoutSlot[];
}

const getColumns = (block: BlockDescriptor): 1 | 2 | 3 => {
  const columns = block.layout?.columns ?? 1;
  if (columns <= 1) return 1;
  if (columns === 2) return 2;
  return 3;
};

const getFieldWidth = (field: FieldDescriptor): 'full' | 'half' | 'third' => {
  return field.layout?.width ?? 'full';
};

const getGroupId = (field: FieldDescriptor): string | undefined => field.layout?.groupId;

const getGroupRole = (
  field: FieldDescriptor
): 'left' | 'right' | 'leftStack' | 'rightStack' | undefined => field.layout?.groupRole;

export const buildBlockLayoutRows = (block: BlockDescriptor, fields: FieldDescriptor[]): LayoutRow[] => {
  const mode = block.layout?.mode ?? 'default';

  if (mode !== 'grid') {
    // Default behavior: each field is its own full-width row
    return fields.map((field) => ({
      slots: [{ id: 'col1', fields: [field] }],
    }));
  }

  const columns = getColumns(block);

  // Pre-group fields by groupId so we can emit an entire group row on first encounter
  const groupedById = new Map<string, FieldDescriptor[]>();
  for (const field of fields) {
    const groupId = getGroupId(field);
    if (!groupId) continue;
    const existing = groupedById.get(groupId);
    if (existing) existing.push(field);
    else groupedById.set(groupId, [field]);
  }

  const rows: LayoutRow[] = [];
  const emittedGroups = new Set<string>();

  // Buffer for consecutive ungrouped half/third-width fields that pair into one row
  let pairBuffer: FieldDescriptor[] = [];
  const maxPairSize = columns === 3 ? 3 : 2;

  const flushPairBuffer = () => {
    if (pairBuffer.length === 0) return;
    if (columns === 2) {
      rows.push({
        slots: pairBuffer.length === 1
          ? [{ id: 'left', fields: [pairBuffer[0]] }]
          : [
              { id: 'left', fields: [pairBuffer[0]] },
              { id: 'right', fields: [pairBuffer[1]] },
            ],
      });
    } else {
      // columns === 3
      const slots: LayoutSlot[] = [];
      if (pairBuffer.length >= 1) slots.push({ id: 'col1', fields: [pairBuffer[0]] });
      if (pairBuffer.length >= 2) slots.push({ id: 'col2', fields: [pairBuffer[1]] });
      if (pairBuffer.length >= 3) slots.push({ id: 'col3', fields: [pairBuffer[2]] });
      rows.push({ slots });
    }
    pairBuffer = [];
  };

  const emitGroupRow = (groupFields: FieldDescriptor[]) => {
    if (columns === 1) {
      groupFields.forEach((field) => rows.push({ slots: [{ id: 'col1', fields: [field] }] }));
      return;
    }

    if (columns === 2) {
      const leftStack = groupFields.filter(
        (f) => getGroupRole(f) === 'leftStack' && getFieldWidth(f) === 'half'
      );
      const left = groupFields.filter(
        (f) => getGroupRole(f) === 'left' && getFieldWidth(f) === 'half'
      );
      const rightStack = groupFields.filter(
        (f) => getGroupRole(f) === 'rightStack' && getFieldWidth(f) === 'half'
      );
      const right = groupFields.filter(
        (f) => getGroupRole(f) === 'right' && getFieldWidth(f) === 'half'
      );

      if (leftStack.length > 0 && right.length === 1) {
        rows.push({ slots: [{ id: 'left', fields: leftStack }, { id: 'right', fields: [right[0]] }] });
        return;
      }

      if (left.length === 1 && rightStack.length > 0) {
        rows.push({ slots: [{ id: 'left', fields: [left[0]] }, { id: 'right', fields: rightStack }] });
        return;
      }

      if (groupFields.length === 2) {
        const [a, b] = groupFields;
        if (!getGroupRole(a) && !getGroupRole(b) && getFieldWidth(a) === 'half' && getFieldWidth(b) === 'half') {
          rows.push({ slots: [{ id: 'left', fields: [a] }, { id: 'right', fields: [b] }] });
          return;
        }
      }

      // Fallback: sequential full-width rows
      groupFields.forEach((field) => rows.push({ slots: [{ id: 'col1', fields: [field], colSpan: 2 }] }));
      return;
    }

    // columns === 3
    const thirdFields = groupFields.filter((f) => getFieldWidth(f) === 'third');
    if (thirdFields.length > 0) {
      let buffer: FieldDescriptor[] = [];
      const flushBuffer = () => {
        if (buffer.length === 0) return;
        const slots: LayoutSlot[] = [];
        if (buffer.length >= 1) slots.push({ id: 'col1', fields: [buffer[0]] });
        if (buffer.length >= 2) slots.push({ id: 'col2', fields: [buffer[1]] });
        if (buffer.length >= 3) slots.push({ id: 'col3', fields: [buffer[2]] });
        rows.push({ slots });
        buffer = [];
      };
      thirdFields.forEach((f) => { buffer.push(f); if (buffer.length === 3) flushBuffer(); });
      flushBuffer();
      groupFields
        .filter((f) => !thirdFields.includes(f))
        .forEach((field) => rows.push({ slots: [{ id: 'col1', fields: [field] }] }));
      return;
    }

    groupFields.forEach((field) => rows.push({ slots: [{ id: 'col1', fields: [field], colSpan: 3 }] }));
  };

  // Process fields in their natural descriptor order. Groups are emitted
  // the first time any of their members is encountered.
  for (const field of fields) {
    const groupId = getGroupId(field);

    if (groupId) {
      if (!emittedGroups.has(groupId)) {
        // Flush any buffered ungrouped pairable fields before starting the group row
        flushPairBuffer();
        emittedGroups.add(groupId);
        emitGroupRow(groupedById.get(groupId)!);
      }
      // Subsequent members of an already-emitted group are skipped
      continue;
    }

    // Ungrouped field — buffer half/third-width fields for pairing; flush on full-width
    const width = getFieldWidth(field);
    const isPairable =
      (columns === 2 && width === 'half') ||
      (columns === 3 && width === 'third');

    if (isPairable) {
      pairBuffer.push(field);
      if (pairBuffer.length === maxPairSize) flushPairBuffer();
    } else {
      flushPairBuffer();
      rows.push({
        slots: [{ id: 'col1', fields: [field], ...(columns > 1 ? { colSpan: columns } : {}) }],
      });
    }
  }

  flushPairBuffer();

  return rows;
};

