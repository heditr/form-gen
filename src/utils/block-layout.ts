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

  const groupedById = new Map<string, FieldDescriptor[]>();
  const ungrouped: FieldDescriptor[] = [];

  for (const field of fields) {
    const groupId = getGroupId(field);
    if (!groupId) {
      ungrouped.push(field);
      continue;
    }
    const existing = groupedById.get(groupId);
    if (existing) {
      existing.push(field);
    } else {
      groupedById.set(groupId, [field]);
    }
  }

  const rows: LayoutRow[] = [];

  const pushUngrouped = () => {
    if (ungrouped.length === 0) return;

    if (columns === 1) {
      ungrouped.forEach((field) => {
        rows.push({ slots: [{ id: 'col1', fields: [field] }] });
      });
      return;
    }

    if (columns === 2) {
      let buffer: FieldDescriptor[] = [];
      const flushBuffer = () => {
        if (buffer.length === 0) return;
        if (buffer.length === 1) {
          rows.push({ slots: [{ id: 'left', fields: [buffer[0]] }] });
        } else {
          rows.push({
            slots: [
              { id: 'left', fields: [buffer[0]] },
              { id: 'right', fields: [buffer[1]] },
            ],
          });
        }
        buffer = [];
      };

      for (const field of ungrouped) {
        const width = getFieldWidth(field);
        if (width === 'full') {
          flushBuffer();
          rows.push({ slots: [{ id: 'col1', fields: [field], colSpan: 2 }] });
          continue;
        }
        if (width === 'half') {
          buffer.push(field);
          if (buffer.length === 2) {
            flushBuffer();
          }
          continue;
        }
        // third in 2-column mode → treat as full row
        flushBuffer();
        rows.push({ slots: [{ id: 'col1', fields: [field], colSpan: 2 }] });
      }
      flushBuffer();
      return;
    }

    // columns === 3
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

    for (const field of ungrouped) {
      const width = getFieldWidth(field);
      if (width === 'full') {
        flushBuffer();
        rows.push({ slots: [{ id: 'col1', fields: [field], colSpan: 3 }] });
        continue;
      }
      if (width === 'third') {
        buffer.push(field);
        if (buffer.length === 3) {
          flushBuffer();
        }
        continue;
      }
      // half in 3-column mode → treat as full row
      flushBuffer();
      rows.push({ slots: [{ id: 'col1', fields: [field], colSpan: 3 }] });
    }
    flushBuffer();
  };

  pushUngrouped();

  for (const [, groupFields] of groupedById) {
    if (columns === 1) {
      groupFields.forEach((field) => {
        rows.push({ slots: [{ id: 'col1', fields: [field] }] });
      });
      continue;
    }

    if (columns === 2) {
      const leftStack = groupFields.filter(
        (f) => getGroupRole(f) === 'leftStack' && getFieldWidth(f) === 'half'
      );
      const right = groupFields.filter(
        (f) => getGroupRole(f) === 'right' && getFieldWidth(f) === 'half'
      );

      if (leftStack.length > 0 && right.length === 1) {
        rows.push({
          slots: [
            { id: 'left', fields: leftStack },
            { id: 'right', fields: [right[0]] },
          ],
        });
        continue;
      }

      if (groupFields.length === 2) {
        const [a, b] = groupFields;
        if (!getGroupRole(a) && !getGroupRole(b) && getFieldWidth(a) === 'half' && getFieldWidth(b) === 'half') {
          rows.push({
            slots: [
              { id: 'left', fields: [a] },
              { id: 'right', fields: [b] },
            ],
          });
          continue;
        }
      }

      // Fallback: sequential full-width rows
      groupFields.forEach((field) => {
        rows.push({ slots: [{ id: 'col1', fields: [field], colSpan: 2 }] });
      });
      continue;
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

      for (const field of thirdFields) {
        buffer.push(field);
        if (buffer.length === 3) {
          flushBuffer();
        }
      }
      flushBuffer();

      const remaining = groupFields.filter((f) => !thirdFields.includes(f));
      remaining.forEach((field) => {
        rows.push({ slots: [{ id: 'col1', fields: [field] }] });
      });
      continue;
    }

    groupFields.forEach((field) => {
      rows.push({ slots: [{ id: 'col1', fields: [field], colSpan: 3 }] });
    });
  }

  return rows;
};

