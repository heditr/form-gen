/**
 * Form status context — per-id hidden/disabled/readonly map for render isolation.
 */

import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { GlobalFormDescriptor, CaseContext } from '@/types/form-descriptor';
import type { FormContext } from '@/utils/template-evaluator';
import {
  evaluateHiddenStatus,
  evaluateDisabledStatus,
  evaluateReadonlyStatus,
} from '@/utils/template-evaluator';
import { useDeferredFormValues } from '@/hooks/use-deferred-form-values';

export interface FieldStatus {
  hidden: boolean;
  disabled: boolean;
  readonly: boolean;
}

interface FormStatusContextValue {
  formContext: FormContext;
  getBlockStatus: (blockId: string) => FieldStatus;
  getFieldStatus: (fieldId: string) => FieldStatus;
}

const FormStatusContext = createContext<FormStatusContextValue | null>(null);

export { FormStatusContext };

export function useOptionalFormStatusContext(): FormStatusContextValue | null {
  return useContext(FormStatusContext);
}

const VISIBLE_STATUS: FieldStatus = { hidden: false, disabled: false, readonly: false };

function evaluateDescriptorStatus(
  descriptor: { status?: { hidden?: string; disabled?: string; readonly?: string } },
  formContext: FormContext
): FieldStatus {
  return {
    hidden: evaluateHiddenStatus(descriptor as Parameters<typeof evaluateHiddenStatus>[0], formContext),
    disabled: evaluateDisabledStatus(descriptor as Parameters<typeof evaluateDisabledStatus>[0], formContext),
    readonly: evaluateReadonlyStatus(descriptor as Parameters<typeof evaluateReadonlyStatus>[0], formContext),
  };
}

export interface FormStatusProviderProps {
  form: UseFormReturn<FieldValues>;
  caseContext: CaseContext;
  descriptor: GlobalFormDescriptor | null;
  children: ReactNode;
}

export function FormStatusProvider({
  form,
  caseContext,
  descriptor,
  children,
}: FormStatusProviderProps) {
  const watchedValues = useDeferredFormValues(form);
  const statusCacheRef = useRef<Map<string, FieldStatus>>(new Map());

  const formContext: FormContext = useMemo(
    () => ({
      ...(watchedValues ?? {}),
      caseContext,
      formData: (watchedValues ?? {}) as FormContext,
    }),
    [watchedValues, caseContext]
  );

  const statusMap = useMemo(() => {
    const nextMap = new Map<string, FieldStatus>();
    const cache = statusCacheRef.current;

    if (!descriptor) {
      statusCacheRef.current = nextMap;
      return nextMap;
    }

    for (const block of descriptor.blocks) {
      const blockStatus = evaluateDescriptorStatus(block, formContext);
      const cachedBlock = cache.get(`block:${block.id}`);
      if (
        cachedBlock &&
        cachedBlock.hidden === blockStatus.hidden &&
        cachedBlock.disabled === blockStatus.disabled &&
        cachedBlock.readonly === blockStatus.readonly
      ) {
        nextMap.set(`block:${block.id}`, cachedBlock);
      } else {
        nextMap.set(`block:${block.id}`, blockStatus);
      }

      for (const field of block.fields) {
        const fieldStatus = evaluateDescriptorStatus(field, formContext);
        const cacheKey = `field:${field.id}`;
        const cachedField = cache.get(cacheKey);
        if (
          cachedField &&
          cachedField.hidden === fieldStatus.hidden &&
          cachedField.disabled === fieldStatus.disabled &&
          cachedField.readonly === fieldStatus.readonly
        ) {
          nextMap.set(cacheKey, cachedField);
        } else {
          nextMap.set(cacheKey, fieldStatus);
        }
      }
    }

    statusCacheRef.current = nextMap;
    return nextMap;
  }, [descriptor, formContext]);

  const value = useMemo<FormStatusContextValue>(
    () => ({
      formContext,
      getBlockStatus: (blockId: string) =>
        statusMap.get(`block:${blockId}`) ?? VISIBLE_STATUS,
      getFieldStatus: (fieldId: string) =>
        statusMap.get(`field:${fieldId}`) ?? VISIBLE_STATUS,
    }),
    [formContext, statusMap]
  );

  return (
    <FormStatusContext.Provider value={value}>{children}</FormStatusContext.Provider>
  );
}

export function useFormStatusContext(): FormStatusContextValue {
  const context = useContext(FormStatusContext);
  if (!context) {
    throw new Error('useFormStatusContext must be used within FormStatusProvider');
  }
  return context;
}

export function useBlockStatus(blockId: string): FieldStatus {
  const { getBlockStatus } = useFormStatusContext();
  return getBlockStatus(blockId);
}

export function useFieldStatus(fieldId: string): FieldStatus {
  const { getFieldStatus } = useFormStatusContext();
  return getFieldStatus(fieldId);
}

export function useFormContextFromStatus(): FormContext {
  const { formContext } = useFormStatusContext();
  return formContext;
}
