/**
 * TextField Component
 * 
 * Renders a text input field using react-hook-form with Shadcn UI Input component.
 * Handles validation errors, disabled states, and discriminant field blur events.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controller } from 'react-hook-form';
import type { FieldDescriptor } from '@/types/form-descriptor';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import { getErrorByPath } from '@/utils/form-errors';
import type { FormContext } from '@/utils/template-evaluator';
import { evaluateTemplate } from '@/utils/template-evaluator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Loader2, Search, X } from 'lucide-react';

export interface TextFieldProps {
  field: FieldDescriptor;
  form: UseFormReturn<FieldValues>;
  isDisabled: boolean;
}

/**
 * TextField Component
 * 
 * Renders a text input with label, description, and validation error display.
 * Uses Controller from react-hook-form with Shadcn UI Input component.
 * Note: For discriminant fields, the watch() subscription in useFormDescriptor
 * will automatically sync changes to Redux and trigger re-hydration.
 */
export default function TextField({
  field,
  form,
  isDisabled,
}: TextFieldProps) {
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [isLookupLocked, setIsLookupLocked] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [autoFilledUpdateError, setAutoFilledUpdateError] = useState<string | null>(null);
  const hasInitializedPrefilledLockRef = useRef(false);
  const hasInitializedPrefillLookupRef = useRef(false);
  const hasUserClearedSourceRef = useRef(false);

  const error = getErrorByPath(form.formState.errors, field.id) ?? form.formState.errors[field.id];
  const errorMessage = error?.message as string | undefined;
  const hasManualLookup = Boolean(field.manualLookup);
  const currentFieldValue = form.watch(field.id);
  const isLookupTargetUnlocked = Boolean(
    form.watch(`__lookupUnlocked.${field.id}`)
  );
  const isAutoFilledTargetEmpty = Boolean(field.autoFilledUpdate) && (
    currentFieldValue === '' ||
    currentFieldValue === null ||
    currentFieldValue === undefined
  );
  const isEmptyAutoFilledTargetDisabled = isAutoFilledTargetEmpty && !isLookupTargetUnlocked;
  const isFieldDisabled = useMemo(
    () => isDisabled || (hasManualLookup && isLookupLocked) || isEmptyAutoFilledTargetDisabled,
    [hasManualLookup, isDisabled, isEmptyAutoFilledTargetDisabled, isLookupLocked]
  );

  useEffect(() => {
    if (
      !field.manualLookup ||
      hasUserClearedSourceRef.current ||
      hasInitializedPrefilledLockRef.current ||
      !(
        currentFieldValue === '' ||
        currentFieldValue === null ||
        currentFieldValue === undefined
      )
    ) {
      return;
    }

    if (
      typeof field.defaultValue === 'string' &&
      !field.defaultValue.includes('{{') &&
      field.defaultValue.trim() !== ''
    ) {
      form.setValue(field.id, field.defaultValue, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
    }
  }, [currentFieldValue, field.defaultValue, field.id, field.manualLookup, form]);

  useEffect(() => {
    if (
      hasInitializedPrefilledLockRef.current ||
      !field.manualLookup ||
      !isDisabled ||
      currentFieldValue === '' ||
      currentFieldValue === null ||
      currentFieldValue === undefined
    ) {
      return;
    }

    hasInitializedPrefilledLockRef.current = true;
    setIsLookupLocked(true);

    for (const target of field.manualLookup.autoFillTargets) {
      form.setValue(`__lookupUnlocked.${target.fieldId}`, true, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
    }
  }, [currentFieldValue, field.manualLookup, form, isDisabled]);

  const applyLookupTargets = useCallback((
    result: Record<string, unknown>,
    { shouldDirty = true }: { shouldDirty?: boolean } = {}
  ) => {
    for (const target of field.manualLookup?.autoFillTargets ?? []) {
      const currentValues = form.getValues() as Record<string, unknown>;
      const autoFillContext = {
        formData: currentValues,
        result,
        ...currentValues,
      } as FormContext;
      const resolvedValue = evaluateTemplate(target.valueTemplate, autoFillContext);

      form.setValue(target.fieldId, resolvedValue, {
        shouldDirty,
        shouldTouch: true,
        shouldValidate: true,
      });
      form.setValue(`__lookupUnlocked.${target.fieldId}`, true, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
    }
  }, [field.manualLookup?.autoFillTargets, form]);

  const handleManualLookup = useCallback(async () => {
    if (!field.manualLookup || isLookupLoading) {
      return;
    }

    const formValues = form.getValues() as Record<string, unknown>;
    const templateContext = {
      formData: formValues,
      ...formValues,
    } as FormContext;

    const resolvedUrl = evaluateTemplate(field.manualLookup.request.url, templateContext);
    if (!resolvedUrl) {
      setLookupError('Lookup request URL could not be resolved.');
      return;
    }

    const requestInit: RequestInit = {
      method: field.manualLookup.request.method,
      headers: {},
    };

    if (field.manualLookup.request.payloadTemplate && field.manualLookup.request.method !== 'GET') {
      const payload = evaluateTemplate(field.manualLookup.request.payloadTemplate, templateContext);
      requestInit.headers = {
        'Content-Type': 'application/json',
      };
      requestInit.body = payload;
    }

    setIsLookupLoading(true);
    setLookupError(null);

    try {
      const response = await fetch(resolvedUrl, requestInit);
      if (!response.ok) {
        let responseBody: Record<string, unknown> = {};
        try {
          responseBody = await response.json();
        } catch {
          responseBody = {};
        }

        const hasResilientMatch = (field.manualLookup.resilientErrors ?? []).some((rule) => {
          const hasStatusMatch = typeof rule.status === 'number' ? rule.status === response.status : true;
          const hasCodeMatch = typeof rule.code === 'string' ? rule.code === responseBody.code : true;
          return hasStatusMatch && hasCodeMatch;
        });

        if (hasResilientMatch) {
          applyLookupTargets({});
          const shouldLock = field.manualLookup.lockOnSuccess ?? true;
          setIsLookupLocked(shouldLock);
          return;
        }

        setLookupError(`Lookup failed with status ${response.status}.`);
        return;
      }

      const result = await response.json();
      applyLookupTargets(result as Record<string, unknown>);

      const shouldLock = field.manualLookup.lockOnSuccess ?? true;
      setIsLookupLocked(shouldLock);
    } catch {
      setLookupError('Lookup request failed. Please try again.');
    } finally {
      setIsLookupLoading(false);
    }
  }, [field.manualLookup, isLookupLoading, form, applyLookupTargets]);

  const handleClearLookup = () => {
    hasUserClearedSourceRef.current = true;

    form.setValue(field.id, '', {
      shouldDirty: false,
      shouldTouch: true,
      shouldValidate: true,
    });

    for (const target of field.manualLookup?.autoFillTargets ?? []) {
      form.setValue(target.fieldId, '', {
        shouldDirty: false,
        shouldTouch: true,
        shouldValidate: true,
      });
      form.setValue(`__lookupUnlocked.${target.fieldId}`, false, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
      form.resetField(target.fieldId, {
        defaultValue: '',
      });
    }

    setIsLookupLocked(false);
    setLookupError(null);
  };

  const handleAutoFilledUpdate = async () => {
    if (!field.autoFilledUpdate) {
      return;
    }

    const currentValues = form.getValues() as Record<string, unknown>;
    const templateContext = {
      formData: currentValues,
      ...currentValues,
    } as FormContext;

    const resolvedUrl = evaluateTemplate(field.autoFilledUpdate.url, templateContext);
    if (!resolvedUrl) {
      setAutoFilledUpdateError('Update request URL could not be resolved.');
      return;
    }

    const payload = evaluateTemplate(field.autoFilledUpdate.payloadTemplate, templateContext);

    try {
      setAutoFilledUpdateError(null);
      const response = await fetch(resolvedUrl, {
        method: field.autoFilledUpdate.method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: payload,
      });

      if (!response.ok) {
        setAutoFilledUpdateError(`Update failed with status ${response.status}.`);
      }
    } catch {
      setAutoFilledUpdateError('Update request failed. Please retry.');
    }
  };

  useEffect(() => {
    if (
      hasInitializedPrefillLookupRef.current ||
      !field.manualLookup?.prefillOnMount ||
      currentFieldValue === '' ||
      currentFieldValue === null ||
      currentFieldValue === undefined
    ) {
      return;
    }

    hasInitializedPrefillLookupRef.current = true;
    void handleManualLookup();
  }, [currentFieldValue, field.manualLookup?.prefillOnMount, handleManualLookup]);

  return (
    <div data-testid={`text-field-${field.id}`} className="space-y-2">
      <Label htmlFor={field.id}>
        {field.label}
      </Label>
      {field.description && (
        <p className="text-sm text-muted-foreground">
          {field.description}
        </p>
      )}
      <Controller
        name={field.id}
        control={form.control}
        render={({ field: controllerField }) => (
          <div className="flex items-start gap-2">
            <Input
              id={field.id}
              type="text"
              {...controllerField}
              value={controllerField.value ?? ''}
              onBlur={async () => {
                controllerField.onBlur();
                await handleAutoFilledUpdate();
              }}
              disabled={isFieldDisabled}
              className={cn(
                errorMessage && 'border-destructive focus-visible:ring-destructive'
              )}
              aria-invalid={errorMessage ? 'true' : 'false'}
              aria-describedby={errorMessage ? `${field.id}-error` : undefined}
            />
            {hasManualLookup && (
              isLookupLocked ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={`Clear lookup ${field.id}`}
                  onClick={handleClearLookup}
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={`Lookup ${field.id}`}
                  onClick={handleManualLookup}
                  disabled={isLookupLoading}
                >
                  {isLookupLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              )
            )}
          </div>
        )}
      />
      {errorMessage && (
        <div
          id={`${field.id}-error`}
          className="text-sm text-destructive"
          role="alert"
        >
          {errorMessage}
        </div>
      )}
      {lookupError && (
        <div
          id={`${field.id}-lookup-error`}
          className="text-sm text-destructive"
          role="alert"
        >
          {lookupError}
        </div>
      )}
      {autoFilledUpdateError && (
        <div
          id={`${field.id}-update-error`}
          className="text-sm text-destructive"
          role="alert"
        >
          {autoFilledUpdateError}
        </div>
      )}
    </div>
  );
}
