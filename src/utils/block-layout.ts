import type { BlockDescriptor, FieldDescriptor } from '@/types/form-descriptor';

export type LayoutSlotId = 'left' | 'right' | 'col1' | 'col2' | 'col3';

export interface LayoutSlot {
  id: LayoutSlotId;
  fields: FieldDescriptor[];
  colSpan?: number;
}

export interface LayoutRow {
  slots: LayoutSlot[];
  gridColumns?: 1 | 2 | 3;
}

const getPackSize = (columns: 1 | 2 | 3, width: 'full' | 'half' | 'third'): number | null => {
  if (width === 'half') return 2;
  if (width === 'third') return 3;
  if (columns <= 1) return null;
  return null;
};

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

const createHalfSlotsForTwoColumns = (buffer: FieldDescriptor[]): LayoutSlot[] =>
  buffer.length === 1
    ? [{ id: 'left', fields: [buffer[0]] }]
    : [
        { id: 'left', fields: [buffer[0]] },
        { id: 'right', fields: [buffer[1]] },
      ];

const createHalfSlotsForThreeColumns = (buffer: FieldDescriptor[]): LayoutSlot[] =>
  buffer.length === 1
    ? [{ id: 'col1', fields: [buffer[0]], colSpan: 2 }]
    : [
        { id: 'col1', fields: [buffer[0]] },
        { id: 'col2', fields: [buffer[1]] },
      ];

const createThirdSlots = (buffer: FieldDescriptor[]): LayoutSlot[] => {
  const slots: LayoutSlot[] = [];
  if (buffer.length >= 1) slots.push({ id: 'col1', fields: [buffer[0]] });
  if (buffer.length >= 2) slots.push({ id: 'col2', fields: [buffer[1]] });
  if (buffer.length >= 3) slots.push({ id: 'col3', fields: [buffer[2]] });
  return slots;
};

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

  // Buffer for consecutive ungrouped homogeneous width fields
  let pairBuffer: FieldDescriptor[] = [];
  let pairBufferWidth: 'half' | 'third' | null = null;

  const flushPairBuffer = () => {
    if (pairBuffer.length === 0 || !pairBufferWidth) return;
    if (pairBufferWidth === 'half' && columns === 2) {
      rows.push({
        slots: createHalfSlotsForTwoColumns(pairBuffer),
      });
    } else if (pairBufferWidth === 'third') {
      rows.push({
        slots: createThirdSlots(pairBuffer),
        ...(columns === 2 ? { gridColumns: 3 as const } : {}),
      });
    } else {
      // half-width in 3-column blocks
      rows.push({
        slots: createHalfSlotsForThreeColumns(pairBuffer),
      });
    }
    pairBuffer = [];
    pairBufferWidth = null;
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
      let groupBuffer: FieldDescriptor[] = [];
      let groupBufferWidth: 'half' | 'third' | null = null;
      const flushGroupBuffer = () => {
        if (groupBuffer.length === 0 || !groupBufferWidth) return;
        if (groupBufferWidth === 'half') {
          rows.push({ slots: createHalfSlotsForTwoColumns(groupBuffer) });
        } else {
          rows.push({
            slots: createThirdSlots(groupBuffer),
            gridColumns: 3,
          });
        }
        groupBuffer = [];
        groupBufferWidth = null;
      };
      for (const field of groupFields) {
        const width = getFieldWidth(field);
        const packSize = getPackSize(columns, width);
        const pairable = (width === 'half' || width === 'third') && packSize !== null;
        if (pairable) {
          if (groupBufferWidth && groupBufferWidth !== width) {
            flushGroupBuffer();
          }
          if (!groupBufferWidth && (width === 'half' || width === 'third')) {
            groupBufferWidth = width;
          }
          groupBuffer.push(field);
          if (groupBuffer.length === packSize) {
            flushGroupBuffer();
          }
          continue;
        }
        flushGroupBuffer();
        rows.push({ slots: [{ id: 'col1', fields: [field], colSpan: 2 }] });
      }
      flushGroupBuffer();
      return;
    }

    // columns === 3
    let groupBuffer: FieldDescriptor[] = [];
    let groupBufferWidth: 'half' | 'third' | null = null;
    const flushGroupBuffer = () => {
      if (groupBuffer.length === 0 || !groupBufferWidth) return;
      if (groupBufferWidth === 'half') {
        rows.push({ slots: createHalfSlotsForThreeColumns(groupBuffer) });
      } else {
        rows.push({ slots: createThirdSlots(groupBuffer) });
      }
      groupBuffer = [];
      groupBufferWidth = null;
    };
    for (const field of groupFields) {
      const width = getFieldWidth(field);
      const packSize = getPackSize(columns, width);
      const pairable = (width === 'half' || width === 'third') && packSize !== null;
      if (pairable) {
        if (groupBufferWidth && groupBufferWidth !== width) {
          flushGroupBuffer();
        }
        if (!groupBufferWidth && (width === 'half' || width === 'third')) {
          groupBufferWidth = width;
        }
        groupBuffer.push(field);
        if (groupBuffer.length === packSize) {
          flushGroupBuffer();
        }
        continue;
      }
      flushGroupBuffer();
      rows.push({ slots: [{ id: 'col1', fields: [field], colSpan: 3 }] });
    }
    flushGroupBuffer();
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

    // Ungrouped field — buffer only homogeneous widths; flush on width change or full-width
    const width = getFieldWidth(field);
    const packSize = getPackSize(columns, width);
    const isPairable = packSize !== null && columns > 1;

    if (isPairable) {
      if (pairBufferWidth && pairBufferWidth !== width) {
        flushPairBuffer();
      }
      if (!pairBufferWidth && (width === 'half' || width === 'third')) {
        pairBufferWidth = width;
      }
      pairBuffer.push(field);
      if (pairBuffer.length === packSize) flushPairBuffer();
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

