/**
 * useRepeatableChildClear - clear policy for repeatable child lists.
 *
 * When the user changes the trigger field of a root row to a value that no longer
 * opens the child level, the row's child list is dropped from form state at once.
 * Only user edits (`type: 'change'`) trigger it. `setValue`, reset, prefill and
 * re-hydration never delete a child list.
 */

import { useEffect, useState } from 'react';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { RepeatableChildConfig } from '@/types/form-descriptor';
import { childArrayPath } from '@/utils/repeatable-child';

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function useRepeatableChildClear({
  form,
  groupId,
  config,
  announcement,
  flushDraftSave,
}: {
  form: UseFormReturn<FieldValues>;
  groupId: string;
  config: RepeatableChildConfig | undefined;
  /** Text announced politely when a non-empty list is dropped. */
  announcement: string;
  flushDraftSave: () => Promise<void>;
}): string {
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!config) {
      return undefined;
    }
    const triggerPath = new RegExp(`^${escapeRegExp(groupId)}\\.(\\d+)\\.${escapeRegExp(config.triggerField)}$`);

    const subscription = form.watch((values, { name, type }) => {
      const match = type === 'change' && name ? triggerPath.exec(name) : null;
      if (!match) {
        return;
      }
      const rootIndex = Number(match[1]);
      const value = (values[groupId] as Array<Record<string, unknown>> | undefined)?.[rootIndex]?.[
        config.triggerField
      ];
      if (typeof value === 'string' && config.triggerValues.includes(value)) {
        return;
      }

      const path = childArrayPath({ groupId, rootIndex, property: config.property });
      const list = form.getValues(path);
      if (list === undefined) {
        return;
      }
      form.setValue(path, undefined, { shouldDirty: true });
      void flushDraftSave();
      if (Array.isArray(list) && list.length > 0) {
        setMessage(announcement);
      }
    });

    return () => subscription.unsubscribe();
  }, [form, groupId, config, announcement, flushDraftSave]);

  return message;
}
