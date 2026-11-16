/**
 * Readonly progress bar for one repeatable list.
 *
 * The value is the sum of a row field. It is not registered with the form.
 */

import type { FieldDescriptor } from '@/types/form-descriptor';
import { progressFillPercent, sumRowField } from '@/utils/progress-sum';

export interface ProgressFieldProps {
  field: FieldDescriptor;
  rows: unknown[] | undefined;
}

export default function ProgressField({ field, rows }: ProgressFieldProps) {
  const max = field.progress?.max ?? 0;
  const sum = sumRowField(rows, field.progress?.sumField ?? '');
  const width = progressFillPercent(sum, max);
  const labelId = `${field.id}-label`;

  return (
    <div data-testid={`progress-field-${field.id}`} className="space-y-1">
      <div id={labelId} className="text-sm font-medium">
        {field.label}
      </div>
      <div
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuenow={sum}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-readonly="true"
        className="h-2 w-full overflow-hidden rounded bg-muted"
      >
        <div className="h-full rounded bg-primary" style={{ width: `${width}%` }} />
      </div>
      <p data-testid={`progress-value-${field.id}`} className="text-sm text-muted-foreground">
        {sum}
      </p>
    </div>
  );
}
