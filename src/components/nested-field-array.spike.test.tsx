/**
 * Spike: assumptions behind inline repeatable child rows.
 *
 * 1. A nested useFieldArray mounted per keyed parent row keeps its values and DOM
 *    when a sibling parent row is removed (the child `name` shifts down an index).
 * 2. `form.watch(callback)` reports `type: 'change'` for a user edit of a
 *    Controller-driven field, and never for `setValue`.
 * 3. Mounting `useFieldArray` on an absent key WRITES `[]` into the form values.
 *    So the child list component must mount only when the list already exists,
 *    and the first "Add" must create the list with `setValue`.
 */

import { describe, test, expect } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import type { UseFormReturn, FieldValues } from 'react-hook-form';

type WatchEvent = { name?: string; type?: string };

function ChildList({ form, name }: { form: UseFormReturn<FieldValues>; name: string }) {
  const { fields, append } = useFieldArray({ control: form.control, name });
  return (
    <div data-testid={`child-list-${name}`}>
      {fields.map((field, index) => (
        <input
          key={field.id}
          aria-label={`${name}.${index}`}
          {...form.register(`${name}.${index}.sector`)}
        />
      ))}
      <button type="button" onClick={() => append({ sector: 'new' })}>
        add-{name}
      </button>
    </div>
  );
}

function Harness({
  onReady,
  onWatch,
}: {
  onReady: (form: UseFormReturn<FieldValues>) => void;
  onWatch: (event: WatchEvent) => void;
}) {
  const form = useForm<FieldValues>({
    defaultValues: {
      sectors: [
        { sector: 'holding', subsectors: [{ sector: 'a0' }] },
        { sector: 'holding', subsectors: [{ sector: 'b0' }, { sector: 'b1' }] },
        { sector: 'retail' },
      ],
    },
  });
  onReady(form);
  const { fields, remove } = useFieldArray({ control: form.control, name: 'sectors' });

  form.watch((_value, info) => onWatch({ name: info.name, type: info.type }));
  form.watch('sectors');

  return (
    <div>
      {fields.map((field, index) => (
        <div key={field.id} data-testid={`row-${index}`}>
          <Controller
            control={form.control}
            name={`sectors.${index}.sector`}
            render={({ field: controlled }) => (
              <select
                aria-label={`sector-${index}`}
                value={controlled.value}
                onChange={(event) => controlled.onChange(event.target.value)}
              >
                <option value="holding">holding</option>
                <option value="retail">retail</option>
              </select>
            )}
          />
          {Array.isArray(form.getValues(`sectors.${index}.subsectors`)) ? (
            <ChildList form={form} name={`sectors.${index}.subsectors`} />
          ) : (
            <button
              type="button"
              onClick={() => form.setValue(`sectors.${index}.subsectors`, [{ sector: 'first' }])}
            >
              create-{index}
            </button>
          )}
          <button type="button" onClick={() => remove(index)}>
            remove-{index}
          </button>
        </div>
      ))}
    </div>
  );
}

const mount = () => {
  const events: WatchEvent[] = [];
  const holder: { form?: UseFormReturn<FieldValues> } = {};
  render(<Harness onReady={(form) => (holder.form = form)} onWatch={(event) => events.push(event)} />);
  return { events, holder };
};

describe('nested useFieldArray under keyed parent rows', () => {
  test('given a parent row is removed, should keep the sibling child lists, values and DOM node', () => {
    const { holder } = mount();
    const secondRow = screen.getByTestId('row-1');
    const secondList = screen.getByTestId('child-list-sectors.1.subsectors');

    fireEvent.click(screen.getByText('remove-0'));

    expect(holder.form?.getValues('sectors')).toEqual([
      { sector: 'holding', subsectors: [{ sector: 'b0' }, { sector: 'b1' }] },
      { sector: 'retail' },
    ]);
    expect(screen.getByTestId('row-0')).toBe(secondRow);
    expect(screen.getByTestId('child-list-sectors.0.subsectors')).toBe(secondList);
    expect(screen.getByLabelText('sectors.0.subsectors.1')).toHaveProperty('value', 'b1');
  });

  test('given a child is appended after a parent removal, should write to the shifted path', () => {
    const { holder } = mount();

    fireEvent.click(screen.getByText('remove-0'));
    fireEvent.click(screen.getByText('add-sectors.0.subsectors'));

    expect(holder.form?.getValues('sectors.0.subsectors')).toEqual([
      { sector: 'b0' },
      { sector: 'b1' },
      { sector: 'new' },
    ]);
  });

  test('given a parent row is removed, should leave the removed row\'s child list out of the values', () => {
    const { holder } = mount();

    fireEvent.click(screen.getByText('remove-1'));

    expect(JSON.stringify(holder.form?.getValues('sectors'))).not.toContain('b0');
  });
});

describe('child list creation', () => {
  test('given a row with no child list, should not write an empty list into the values', () => {
    const { holder } = mount();

    expect(holder.form?.getValues('sectors.2')).toEqual({ sector: 'retail' });
  });

  test('given the first child is created with setValue, should mount the list and keep the value', () => {
    const { holder } = mount();

    fireEvent.click(screen.getByText('create-2'));

    expect(holder.form?.getValues('sectors.2.subsectors')).toEqual([{ sector: 'first' }]);
    expect(screen.getByLabelText('sectors.2.subsectors.0')).toHaveProperty('value', 'first');
  });
});

describe('form.watch callback event types', () => {
  test('given a user changes a Controller-driven field, should report type "change" and its name', () => {
    const { events } = mount();

    fireEvent.change(screen.getByLabelText('sector-2'), { target: { value: 'holding' } });

    expect(events).toContainEqual({ name: 'sectors.2.sector', type: 'change' });
  });

  test('given setValue changes a field, should never report type "change"', () => {
    const { events, holder } = mount();

    act(() => holder.form?.setValue('sectors.2.sector', 'holding'));

    const forField = events.filter((event) => event.name === 'sectors.2.sector');
    expect(forField.length).toBeGreaterThan(0);
    expect(forField.every((event) => event.type === undefined)).toBe(true);
  });
});
