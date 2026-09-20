/**
 * Live Zod resolver — schemaRef pattern so validation updates without remounting the form.
 * Applies hide/show membership: hidden fields are removed from values and errors;
 * newly visible fields are written and validated.
 */

import { useRef, useCallback, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import type { FieldValues, Resolver, UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import type { GlobalFormDescriptor, CaseContext, FormData } from '@/types/form-descriptor';
import { buildZodSchemaFromDescriptor } from '@/utils/form-descriptor-integration';
import {
  buildFormContextFromValues,
  buildSchemaFingerprint,
  collectValidationTargets,
  collectStatusHiddenFieldIds,
  diffValidationTargets,
  type ValidationScope,
  type ValidationTarget,
} from '@/utils/schema-fingerprint';

export interface UseLiveZodResolverOptions {
  descriptor: GlobalFormDescriptor | null;
  caseContext?: CaseContext;
  validationScope?: ValidationScope;
  /** Field id → default value for newly shown fields */
  defaultValuesByFieldId?: Record<string, unknown>;
}

export interface LiveZodResolverBundle {
  resolver: Resolver<FieldValues>;
  applyMembershipChanges: (
    form: UseFormReturn<FieldValues>,
    formValues: Partial<FormData>
  ) => void;
  refreshSchemaFromDescriptor: (
    form: UseFormReturn<FieldValues>
  ) => void;
}

function targetsEqual(a: ValidationTarget[], b: ValidationTarget[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const aMap = new Map(a.map((t) => [t.id, t.ruleFingerprint]));
  for (const target of b) {
    if (aMap.get(target.id) !== target.ruleFingerprint) {
      return false;
    }
  }
  return true;
}

export function useLiveZodResolver({
  descriptor,
  caseContext = {},
  validationScope = 'main',
  defaultValuesByFieldId = {},
}: UseLiveZodResolverOptions): LiveZodResolverBundle {
  const schemaRef = useRef<z.ZodObject<Record<string, z.ZodTypeAny>>>(z.object({}));
  const fingerprintRef = useRef('');
  const previousTargetsRef = useRef<ValidationTarget[]>([]);
  const hiddenValueStashRef = useRef<Map<string, unknown>>(new Map());
  const applyingRef = useRef(false);
  const initializedRef = useRef(false);
  const defaultValuesRef = useRef(defaultValuesByFieldId);
  defaultValuesRef.current = defaultValuesByFieldId;

  const resolver = useCallback<Resolver<FieldValues>>(
    async (values, resolverContext, options) => {
      const formContext = buildFormContextFromValues(
        values as Partial<FormData>,
        caseContext
      );
      const targets = collectValidationTargets(descriptor, formContext, validationScope);
      const fingerprint = buildSchemaFingerprint({ descriptor, caseContext, targets });

      if (fingerprint !== fingerprintRef.current) {
        schemaRef.current = buildZodSchemaFromDescriptor(
          descriptor,
          formContext,
          validationScope
        );
        fingerprintRef.current = fingerprint;
      }

      return zodResolver(schemaRef.current)(values, resolverContext, options);
    },
    [caseContext, descriptor, validationScope]
  );

  const applyMembershipChanges = useCallback(
    (form: UseFormReturn<FieldValues>, formValues: Partial<FormData>) => {
      if (!descriptor || applyingRef.current) {
        return;
      }

      const formContext = buildFormContextFromValues(formValues, caseContext);
      const nextTargets = collectValidationTargets(descriptor, formContext, validationScope);
      const statusHiddenIds = new Set(
        collectStatusHiddenFieldIds(descriptor, formContext, validationScope)
      );
      const presentHidden = Object.keys(formValues).filter((fieldId) =>
        statusHiddenIds.has(fieldId)
      );

      if (
        targetsEqual(previousTargetsRef.current, nextTargets) &&
        initializedRef.current &&
        presentHidden.length === 0
      ) {
        return;
      }

      const isInitial = !initializedRef.current;
      const { newlyVisible, newlyHidden } = diffValidationTargets(
        previousTargetsRef.current,
        nextTargets
      );

      // Status-hidden fields (including file/document) for value membership.
      // Do not use "absent from Zod targets" — visible file fields are not in the schema
      // but must keep their defaults. Also strip hidden keys restored by reset().
      const fieldsToHide = [...new Set([...newlyHidden, ...presentHidden])];
      // On first pass every visible field looks "newly visible" — restore values only,
      // do not trigger validation (would show errors as if the form were touched).
      const fieldsToShow = isInitial ? [] : newlyVisible;

      if (fieldsToHide.length === 0 && fieldsToShow.length === 0) {
        previousTargetsRef.current = nextTargets;
        initializedRef.current = true;
        return;
      }

      // Commit before RHF mutations so sync watch callbacks see a stable previous set.
      previousTargetsRef.current = nextTargets;
      initializedRef.current = true;
      applyingRef.current = true;

      try {
        for (const fieldId of fieldsToHide) {
          const currentValue = form.getValues(fieldId as never);
          if (currentValue !== undefined) {
            hiddenValueStashRef.current.set(fieldId, currentValue);
          }
          form.unregister(fieldId as never, { keepValue: false, keepDefaultValue: false });
          form.clearErrors(fieldId as never);
        }

        for (const fieldId of fieldsToShow) {
          const stashed = hiddenValueStashRef.current.get(fieldId);
          const defaultValue = defaultValuesRef.current[fieldId];
          const valueToSet = stashed !== undefined ? stashed : defaultValue;
          if (valueToSet !== undefined) {
            form.setValue(fieldId as never, valueToSet as never, {
              shouldDirty: false,
              shouldTouch: false,
              shouldValidate: false,
            });
          } else if (!(fieldId in form.getValues())) {
            form.setValue(fieldId as never, '' as never, {
              shouldDirty: false,
              shouldTouch: false,
              shouldValidate: false,
            });
          }
          // Hide→show: restore value only. Validation runs on user input or explicit submit.
        }
      } finally {
        applyingRef.current = false;
      }
    },
    [caseContext, descriptor, validationScope]
  );

  const refreshSchemaFromDescriptor = useCallback(
    (form: UseFormReturn<FieldValues>) => {
      if (!descriptor) {
        return;
      }

      const values = form.getValues() as Partial<FormData>;
      const formContext = buildFormContextFromValues(values, caseContext);
      const targets = collectValidationTargets(descriptor, formContext, validationScope);
      const fingerprint = buildSchemaFingerprint({ descriptor, caseContext, targets });

      schemaRef.current = buildZodSchemaFromDescriptor(
        descriptor,
        formContext,
        validationScope
      );
      fingerprintRef.current = fingerprint;
      previousTargetsRef.current = targets;
      initializedRef.current = true;
      // Rebuild schema only — do not trigger() the whole form (avoids mount-time errors).
    },
    [caseContext, descriptor, validationScope]
  );

  return {
    resolver,
    applyMembershipChanges,
    refreshSchemaFromDescriptor,
  };
}

export function useFormMembershipSync(
  form: UseFormReturn<FieldValues>,
  descriptor: GlobalFormDescriptor | null,
  applyMembershipChanges: LiveZodResolverBundle['applyMembershipChanges'],
  refreshSchemaFromDescriptor: LiveZodResolverBundle['refreshSchemaFromDescriptor']
): void {
  useEffect(() => {
    if (!descriptor) {
      return undefined;
    }

    const subscription = form.watch((watchedValues) => {
      // Defer membership mutations out of Controller's update/render path.
      queueMicrotask(() => {
        applyMembershipChanges(form, watchedValues as Partial<FormData>);
      });
    });

    // Initial pass: strip hidden defaults without waiting for a value change.
    applyMembershipChanges(form, form.getValues() as Partial<FormData>);

    return () => subscription.unsubscribe();
  }, [applyMembershipChanges, descriptor, form]);

  useEffect(() => {
    refreshSchemaFromDescriptor(form);
  }, [descriptor, form, refreshSchemaFromDescriptor]);
}
