/**
 * Popin form session — isolated RHF instance mounted only while the popin dialog is open.
 * Live hide/show membership; Validate runs trigger() on submit.
 */

'use client';

import { useEffect, useMemo, useCallback, useRef, useState } from 'react';
import { useWatch } from 'react-hook-form';
import type { GlobalFormDescriptor, SubmissionConfig, FormData as DescriptorFormData, CaseContext } from '@/types/form-descriptor';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { FormContext } from '@/utils/template-evaluator';
import type { ResolvedBlock } from '@/utils/block-resolver';
import { evaluatePayloadTemplate, type BackendErrorResponse } from '@/utils/submission-orchestrator';
import { omitStatusHiddenFormValues } from '@/utils/schema-fingerprint';
import type { BackendError } from '@/utils/form-descriptor-integration';
import { useFormDescriptor } from '@/hooks/use-form-descriptor';
import { isRepeatableBlock, groupFieldsByRepeatableGroupId } from '@/utils/form-descriptor-integration';
import { evaluateDefaultValue } from '@/utils/default-value-evaluator';
import {
  buildPopinFormContext,
  getRepeatablePopinInstanceValues,
  getPopinLoadFieldValues,
} from '@/utils/popin-form-context';
import { Button } from '@/components/ui/button';
import Block from './block';

export interface PopinFormSessionProps {
  resolvedBlock: ResolvedBlock;
  popinDescriptor: GlobalFormDescriptor;
  mainForm: UseFormReturn<FieldValues>;
  initialFormContext: FormContext;
  caseContext: CaseContext;
  popinEditContext: { groupId: string; index: number } | null;
  popinLoadData: Record<string, unknown> | null;
  isLoadingPopinData: boolean;
  onLoadDataSource: (
    fieldPath: string,
    url: string,
    auth?: { type: 'bearer' | 'apikey'; token?: string; headerName?: string }
  ) => void;
  dataSourceCache: Record<string, unknown>;
  onClose: () => void;
  onValidated: (blockId: string, options?: { includeDefaultDataSource?: boolean }) => Promise<void>;
}

export default function PopinFormSession({
  resolvedBlock,
  popinDescriptor,
  mainForm,
  initialFormContext,
  caseContext,
  popinEditContext,
  popinLoadData,
  isLoadingPopinData,
  onLoadDataSource,
  dataSourceCache,
  onClose,
  onValidated,
}: PopinFormSessionProps) {
  const mainFormValues = useWatch({ control: mainForm.control }) as Record<string, unknown>;

  const [mountFormData] = useState(
    () =>
      ({
        ...(initialFormContext as Partial<DescriptorFormData>),
        ...(mainForm.getValues() as Partial<DescriptorFormData>),
      }) as Partial<DescriptorFormData>
  );

  const repeatableInstanceValues = useMemo(
    () =>
      getRepeatablePopinInstanceValues(
        mainForm.getValues() as Record<string, unknown>,
        popinEditContext
      ),
    [mainForm, popinEditContext]
  );

  const { form: popinForm } = useFormDescriptor(popinDescriptor, {
    caseContext,
    formData: mountFormData,
    savedFormData: repeatableInstanceValues as Partial<DescriptorFormData> | undefined,
    validationScope: 'popin',
    repeatableIndex: popinEditContext?.index,
    statusValues: mainFormValues ?? {},
  });

  const watchedPopinValues = useWatch({ control: popinForm.control }) as Record<string, unknown>;

  const popinFormContext = useMemo(
    () =>
      buildPopinFormContext({
        mainFormValues: mainFormValues ?? {},
        popinValues: {
          ...(repeatableInstanceValues ?? {}),
          ...(watchedPopinValues ?? {}),
        },
        initialFormContext,
        popinLoadData,
        caseContext,
      }),
    [
      mainFormValues,
      repeatableInstanceValues,
      watchedPopinValues,
      initialFormContext,
      popinLoadData,
      caseContext,
    ]
  );

  // Template defaults for a new repeatable row — exclude live popin values so reset
  // does not feed back into this context and re-trigger the init effect.
  const defaultEvalContext = useMemo(
    () =>
      ({
        ...(mainFormValues ?? {}),
        ...initialFormContext,
        ...(popinLoadData ?? {}),
        formData: mainFormValues ?? {},
      }) as FormContext,
    [mainFormValues, initialFormContext, popinLoadData]
  );

  const repeatableInitKeyRef = useRef<string | null>(null);
  const loadDataInitKeyRef = useRef<string | null>(null);

  useEffect(() => {
    repeatableInitKeyRef.current = null;
    loadDataInitKeyRef.current = null;
  }, [resolvedBlock.block.id]);

  useEffect(() => {
    if (!popinEditContext || !isRepeatableBlock(resolvedBlock.block)) {
      return;
    }

    const { groupId, index } = popinEditContext;
    const sessionKey = `${groupId}:${index}`;
    if (repeatableInitKeyRef.current === sessionKey) {
      return;
    }

    const fieldGroups = groupFieldsByRepeatableGroupId(resolvedBlock.block.fields);
    const groupFields = fieldGroups[groupId];
    if (!groupFields?.length) {
      return;
    }

    if (typeof index === 'number' && index >= 0) {
      const instanceData = getRepeatablePopinInstanceValues(
        mainForm.getValues() as Record<string, unknown>,
        popinEditContext
      );
      if (!instanceData) {
        return;
      }
      // The saved row is already merged under explicit defaults by useFormDescriptor.
      repeatableInitKeyRef.current = sessionKey;
      return;
    }

    repeatableInitKeyRef.current = sessionKey;

    const defaultInstance: Record<string, unknown> = {};
    for (const field of groupFields) {
      if (field.type === 'button') continue;
      const baseFieldId = field.id.startsWith(`${groupId}.`)
        ? field.id.slice(groupId.length + 1)
        : field.id;

      if (field.defaultValue !== undefined) {
        defaultInstance[baseFieldId] = evaluateDefaultValue(
          field.defaultValue,
          field.type,
          defaultEvalContext,
          typeof index === 'number' ? { index } : {}
        );
      } else {
        defaultInstance[baseFieldId] = field.type === 'checkbox' ? false : '';
      }
    }

    const loadedValues = getPopinLoadFieldValues({
      fields: groupFields,
      popinLoadData,
      groupId,
    });

    popinForm.reset({
      ...defaultInstance,
      ...loadedValues,
    });
  }, [popinEditContext, resolvedBlock.block, mainForm, popinForm, defaultEvalContext, popinLoadData]);

  useEffect(() => {
    if (!popinLoadData) {
      return;
    }

    const isRepeatableEdit = Boolean(popinEditContext && popinEditContext.index >= 0);
    if (isRepeatableEdit) {
      return;
    }

    const loadKey = resolvedBlock.block.id;
    if (loadDataInitKeyRef.current === loadKey) {
      return;
    }
    loadDataInitKeyRef.current = loadKey;

    const popinFieldValues = getPopinLoadFieldValues({
      fields: resolvedBlock.block.fields,
      popinLoadData,
      groupId: popinEditContext?.groupId,
    });

    if (Object.keys(popinFieldValues).length > 0) {
      popinForm.reset({
        ...popinForm.getValues(),
        ...popinFieldValues,
      });
    }
  }, [popinLoadData, resolvedBlock.block, popinForm, popinEditContext]);

  const handleValidate = useCallback(async () => {
    const isValid = await popinForm.trigger();
    if (!isValid) {
      return;
    }

    const block = resolvedBlock.block;

    if (popinEditContext && isRepeatableBlock(block)) {
      const values = omitStatusHiddenFormValues(
        popinDescriptor,
        popinForm.getValues() as Partial<DescriptorFormData>,
        caseContext,
        'popin'
      ) as Record<string, unknown>;
      const { groupId, index } = popinEditContext;

      const currentArrayRaw = mainForm.getValues(groupId as never) as unknown;
      const currentArray = Array.isArray(currentArrayRaw) ? currentArrayRaw : [];

      let nextArray: unknown[];
      if (typeof index === 'number' && index >= 0 && index < currentArray.length) {
        nextArray = currentArray.map((item, i) => (i === index ? values : item));
      } else {
        nextArray = [...currentArray, values];
      }

      mainForm.setValue(groupId as never, nextArray as never, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });

      await onValidated(block.id);
      onClose();
      return;
    }

    if (!block.popinSubmit) {
      onClose();
      return;
    }

    const popinSubmitConfig: SubmissionConfig = {
      url: block.popinSubmit.url,
      method: block.popinSubmit.method,
      payloadTemplate: block.popinSubmit.payloadTemplate,
      headers: {},
      auth: block.popinSubmit.auth,
    };

    const currentMainFormValues = mainForm.getValues();
    const allFormValues = omitStatusHiddenFormValues(
      popinDescriptor,
      {
        ...currentMainFormValues,
        ...popinForm.getValues(),
      } as Partial<DescriptorFormData>,
      caseContext,
      'popin'
    );

    const evaluatedPayload = evaluatePayloadTemplate(
      popinSubmitConfig.payloadTemplate,
      allFormValues
    );

    const hasBody = popinSubmitConfig.method !== 'GET';
    const body = hasBody
      ? typeof evaluatedPayload === 'string'
        ? evaluatedPayload
        : JSON.stringify(evaluatedPayload)
      : undefined;

    const headers: Record<string, string> = {};
    if (hasBody) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(popinSubmitConfig.url, {
        method: popinSubmitConfig.method,
        headers,
        body,
      });

      if (response.ok) {
        await onValidated(block.id, { includeDefaultDataSource: true });
        onClose();
        return;
      }

      let errorResponse: BackendErrorResponse;
      try {
        errorResponse = await response.json();
      } catch {
        errorResponse = { error: `Popin submit failed with status ${response.status}` };
      }

      if (errorResponse.errors && Array.isArray(errorResponse.errors)) {
        for (const backendError of errorResponse.errors as BackendError[]) {
          popinForm.setError(backendError.field, {
            type: 'server',
            message: backendError.message || 'Validation error',
          });
        }
      }
    } catch (error) {
      console.error('Popin submit failed:', error);
    }
  }, [
    popinForm,
    resolvedBlock,
    popinEditContext,
    mainForm,
    onValidated,
    onClose,
    popinDescriptor,
    caseContext,
  ]);

  return (
    <>
      <div className="py-4">
        {isLoadingPopinData ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        ) : (
          <Block
            block={popinDescriptor.blocks[0] ?? resolvedBlock.block}
            isDisabled={resolvedBlock.isDisabled}
            isHidden={false}
            form={popinForm}
            formContext={popinFormContext}
            onLoadDataSource={onLoadDataSource}
            dataSourceCache={dataSourceCache}
            renderRepeatablesAsSummary={false}
          />
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={() => void handleValidate()}>
          Validate
        </Button>
      </div>
    </>
  );
}
