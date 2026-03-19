/**
 * Popin Manager Component
 * 
 * Manages popin block state and provides context for opening/closing popins.
 * Renders Dialog component with block content when a popin is open.
 */

'use client';

import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { GlobalFormDescriptor, SubmissionConfig, FormData as DescriptorFormData, CaseContext } from '@/types/form-descriptor';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { FormContext } from '@/utils/template-evaluator';
import { resolveBlockById } from '@/utils/block-resolver';
import { loadPopinData } from '@/utils/popin-load-loader';
import { evaluatePayloadTemplate, type BackendErrorResponse } from '@/utils/submission-orchestrator';
import type { BackendError } from '@/utils/form-descriptor-integration';
import { useFormDescriptor } from '@/hooks/use-form-descriptor';
import { isRepeatableBlock, groupFieldsByRepeatableGroupId } from '@/utils/form-descriptor-integration';
import { evaluateDefaultValue } from '@/utils/default-value-evaluator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Block from './block';

/** Options for opening popin in repeatable instance edit mode */
export interface OpenPopinOptions {
  groupId?: string;
  index?: number;
}

/**
 * Popin Manager Context
 */
interface PopinManagerContextValue {
  openPopin: (blockId: string, options?: OpenPopinOptions) => void;
}

const PopinManagerContext = createContext<PopinManagerContextValue | null>(null);

/**
 * Hook to access popin manager context
 */
export function usePopinManager(): PopinManagerContextValue {
  const context = useContext(PopinManagerContext);
  if (!context) {
    throw new Error('usePopinManager must be used within PopinManagerProvider');
  }
  return context;
}

/**
 * Props for PopinManagerProvider
 */
export interface PopinManagerProviderProps {
  children: React.ReactNode;
  mergedDescriptor: GlobalFormDescriptor | null;
  form: UseFormReturn<FieldValues>;
  formContext: FormContext;
  caseContext: CaseContext;
  onLoadDataSource: (fieldPath: string, url: string, auth?: { type: 'bearer' | 'apikey'; token?: string; headerName?: string }) => void;
  dataSourceCache: Record<string, unknown>;
}

/**
 * Popin Manager Provider Component
 * 
 * Wraps form to provide popin management functionality.
 * Manages popin state and renders Dialog when popin is open.
 */
export function PopinManagerProvider({
  children,
  mergedDescriptor,
  form: mainForm,
  formContext: initialFormContext,
  caseContext,
  onLoadDataSource,
  dataSourceCache,
}: PopinManagerProviderProps) {
  const queryClient = useQueryClient();
  const [openBlockId, setOpenBlockId] = useState<string | null>(null);
  const [popinEditContext, setPopinEditContext] = useState<{ groupId: string; index: number } | null>(null);
  const [popinLoadData, setPopinLoadData] = useState<Record<string, unknown> | null>(null);
  const [isLoadingPopinData, setIsLoadingPopinData] = useState(false);
  const [isSubmittingPopin, setIsSubmittingPopin] = useState(false);
  
  // Build form context - get fresh values when needed but don't create reactive subscriptions
  // Use useMemo with stable dependencies to prevent infinite loops
  // Note: We call getValues() inside the memo to get fresh values, but don't include
  // form values in dependencies to avoid infinite loops
  const formContext = useMemo(() => {
    // Get current form values without creating a subscription
    const currentFormValues = mainForm.getValues();
    return {
      ...currentFormValues,
      ...initialFormContext,
      ...popinLoadData, // Merge popinLoad data into formContext
      formData: currentFormValues,
    } as FormContext;
    // mainForm is stable (from useForm hook), so including it is safe
    // This prevents infinite loops while still allowing formContext to be re-evaluated
    // when popinLoadData or initialFormContext changes
  }, [mainForm, initialFormContext, popinLoadData]);

  // Resolve the currently open block (re-resolve when formContext changes)
  const resolvedBlock = useMemo(() => {
    if (!openBlockId || !mergedDescriptor) {
      return null;
    }
    return resolveBlockById(openBlockId, mergedDescriptor, formContext);
  }, [openBlockId, mergedDescriptor, formContext]);

  // For repeatable popin edit: build instance block (flat fields for one row) and seed from main form
  const popinDescriptor = useMemo(() => {
    if (!resolvedBlock || !mergedDescriptor) {
      return null;
    }
    const block = resolvedBlock.block;

    // Repeatable popin edit mode: derive single-instance block from repeatable group fields
    if (popinEditContext && isRepeatableBlock(block)) {
      const { groupId } = popinEditContext;
      const fieldGroups = groupFieldsByRepeatableGroupId(block.fields);
      const groupFields = fieldGroups[groupId];
      if (!groupFields?.length) {
        return null;
      }
      const instanceFields = groupFields
        .filter(f => f.type !== 'button')
        .map(f => {
          const baseId = f.id.startsWith(`${groupId}.`) ? f.id.slice(groupId.length + 1) : f.id;
          return { ...f, id: baseId, repeatableGroupId: undefined };
        });
      const instanceBlock = {
        id: `${block.id}-instance`,
        title: block.title,
        layout: block.layout,
        fields: instanceFields,
      };
      return {
        version: mergedDescriptor.version,
        blocks: [instanceBlock],
        submission: mergedDescriptor.submission,
      } as GlobalFormDescriptor;
    }

    return {
      version: mergedDescriptor.version,
      blocks: [block],
      submission: mergedDescriptor.submission,
    } as GlobalFormDescriptor;
  }, [resolvedBlock, mergedDescriptor, popinEditContext]);

  // Create isolated form instance for popin using useFormDescriptor
  // This form only contains fields from the popin block
  // Don't pass onDiscriminantChange to prevent syncing popin form values to Redux
  const { form: popinForm } = useFormDescriptor(popinDescriptor, {
    caseContext,
    formData: mainForm.getValues(), // Pass main form values for template evaluation
    // No onDiscriminantChange - popin form values should not sync to Redux
  });

  // Seed popin form when in repeatable edit/create mode
  useEffect(() => {
    if (!popinEditContext || !resolvedBlock || !isRepeatableBlock(resolvedBlock.block)) {
      return;
    }

    const { groupId, index } = popinEditContext;
    const fieldGroups = groupFieldsByRepeatableGroupId(resolvedBlock.block.fields);
    const groupFields = fieldGroups[groupId];
    if (!groupFields?.length) {
      return;
    }

    // Edit existing instance: seed from main form array
    if (typeof index === 'number' && index >= 0) {
      const mainValues = mainForm.getValues() as Record<string, unknown>;
      const groupArray = mainValues[groupId] as unknown[] | undefined;
      const instanceData = Array.isArray(groupArray) ? groupArray[index] : undefined;
      if (instanceData && typeof instanceData === 'object') {
        popinForm.reset(instanceData as Record<string, unknown>);
      }
      return;
    }

    // Create mode: reset to clean defaults for this instance
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
          formContext
        );
      } else {
        switch (field.type) {
          case 'text':
          case 'dropdown':
          case 'autocomplete':
          case 'date':
          case 'radio':
            defaultInstance[baseFieldId] = '';
            break;
          case 'checkbox':
            defaultInstance[baseFieldId] = false;
            break;
          case 'number':
            defaultInstance[baseFieldId] = 0;
            break;
          case 'file':
            defaultInstance[baseFieldId] = null;
            break;
          default:
            defaultInstance[baseFieldId] = '';
        }
      }
    }

    popinForm.reset(defaultInstance);
  }, [popinEditContext, resolvedBlock, mainForm, popinForm, formContext]);

  // Reset popin form with popinLoadData when it's loaded (standalone popin, not edit mode)
  useEffect(() => {
    if (popinEditContext || !popinLoadData || !resolvedBlock) {
      return;
    }

    // Extract values for popin block fields from popinLoadData
    const popinFieldValues: Record<string, unknown> = {};
    
    if (isRepeatableBlock(resolvedBlock.block)) {
      const fieldGroups = groupFieldsByRepeatableGroupId(resolvedBlock.block.fields);
      for (const [groupId] of Object.entries(fieldGroups)) {
        if (popinLoadData[groupId] !== undefined && Array.isArray(popinLoadData[groupId])) {
          popinFieldValues[groupId] = popinLoadData[groupId];
        }
      }
    }
    
    for (const field of resolvedBlock.block.fields) {
      if (field.repeatableGroupId) continue;
      if (popinLoadData[field.id] !== undefined) {
        popinFieldValues[field.id] = popinLoadData[field.id];
      }
    }

    if (Object.keys(popinFieldValues).length > 0) {
      popinForm.reset(popinFieldValues);
    }
  }, [popinLoadData, resolvedBlock, popinForm, popinEditContext]);

  // Load popin data when popin opens (if popinLoad config exists; skip in edit mode)
  useEffect(() => {
    if (!resolvedBlock || popinEditContext) {
      if (!resolvedBlock) {
        setPopinLoadData(null);
        setIsLoadingPopinData(false);
      }
      return;
    }
    if (!resolvedBlock.block.popinLoad) {
      setPopinLoadData(null);
      setIsLoadingPopinData(false);
      return;
    }

    const loadData = async () => {
      setIsLoadingPopinData(true);
      try {
        // Use formContext without popinLoadData to avoid circular dependency
        // Get fresh values to ensure we have the latest form data
        const currentMainFormValues = mainForm.getValues();
        const contextForLoad: FormContext = {
          ...currentMainFormValues,
          ...initialFormContext,
          formData: currentMainFormValues,
        };
        
        const data = await loadPopinData(
          resolvedBlock.block.id,
          resolvedBlock.block.popinLoad!,
          contextForLoad
        );
        
        setPopinLoadData(data);
      } catch (error) {
        // Handle errors gracefully - log but don't break popin functionality
        console.error('Failed to load popin data:', error);
        // Continue without popinLoad data
        setPopinLoadData(null);
      } finally {
        setIsLoadingPopinData(false);
      }
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedBlock?.block.id, resolvedBlock?.block.popinLoad]);

  // Open popin by block ID, optionally for a specific repeatable instance (groupId, index)
  const openPopin = useCallback((blockId: string, options?: OpenPopinOptions) => {
    if (!mergedDescriptor) {
      console.error('Cannot open popin: mergedDescriptor is not available');
      return;
    }

    const resolved = resolveBlockById(blockId, mergedDescriptor, formContext);
    if (!resolved) return;
    if (resolved.isHidden) {
      console.warn(`Cannot open popin: Block "${blockId}" is hidden`);
      return;
    }

    setOpenBlockId(blockId);
    if (options?.groupId !== undefined) {
      // When index is omitted, treat this as "create" mode for the repeatable group.
      // We use index -1 as a sentinel to indicate a new instance that does not yet
      // exist in the main form array.
      setPopinEditContext({
        groupId: options.groupId,
        index: options.index ?? -1,
      });
    } else {
      setPopinEditContext(null);
    }
  }, [mergedDescriptor, formContext]);

  // Close popin (acts as cancel - discards changes)
  const closePopin = useCallback(() => {
    if (resolvedBlock && resolvedBlock.block.fields) {
      const blockToClear = popinDescriptor?.blocks[0] ?? resolvedBlock.block;
      blockToClear.fields.forEach((field) => {
        popinForm.clearErrors(field.id);
        // Clear any main-form errors for the same field ids (e.g. server errors
        // that were surfaced on the main form or persisted between openings).
        mainForm.clearErrors(field.id as never);
      });
    }
    popinForm.reset();
    setOpenBlockId(null);
    setPopinEditContext(null);
  }, [resolvedBlock, popinForm, popinDescriptor, mainForm]);

  // Handle validate button click
  const handleValidate = useCallback(async () => {
    if (!resolvedBlock) return;

    const block = resolvedBlock.block;

    // Repeatable popin edit/create mode: merge popin values back into the main form array
    if (popinEditContext && isRepeatableBlock(block)) {
      const values = popinForm.getValues() as Record<string, unknown>;
      const { groupId, index } = popinEditContext;

      const currentArrayRaw = mainForm.getValues(groupId as never) as unknown;
      const currentArray = Array.isArray(currentArrayRaw) ? currentArrayRaw : [];

      let nextArray: unknown[];
      if (typeof index === 'number' && index >= 0 && index < currentArray.length) {
        // Edit existing instance
        nextArray = currentArray.map((item, i) => (i === index ? values : item));
      } else {
        // Create new instance (only happens after user validates)
        nextArray = [...currentArray, values];
      }

      mainForm.setValue(groupId as never, nextArray as never, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });

      closePopin();
      return;
    }

    if (!block.popinSubmit) {
      closePopin();
      return;
    }

    // Build submission config from popinSubmit
    const popinSubmitConfig: SubmissionConfig = {
      url: block.popinSubmit.url,
      method: block.popinSubmit.method,
      payloadTemplate: block.popinSubmit.payloadTemplate,
      headers: {},
      auth: block.popinSubmit.auth,
    };

    setIsSubmittingPopin(true);

    try {
      // Get current popin form values for payload evaluation
      // Merge with main form values for template evaluation (popin can reference main form)
      const currentMainFormValues = mainForm.getValues();
      const currentPopinFormValues = popinForm.getValues();
      const allFormValues = {
        ...currentMainFormValues,
        ...currentPopinFormValues,
      } as Partial<DescriptorFormData>;

      // Evaluate payload template with form values
      const evaluatedPayload = evaluatePayloadTemplate(
        popinSubmitConfig.payloadTemplate,
        allFormValues
      );

      // Determine request body (JSON only for popinSubmit)
      const hasBody = popinSubmitConfig.method !== 'GET';
      let body: string | undefined;
      if (hasBody) {
        body = typeof evaluatedPayload === 'string'
          ? evaluatedPayload
          : JSON.stringify(evaluatedPayload);
      }

      // Build headers with authentication
      const headers: Record<string, string> = {};

      if (popinSubmitConfig.auth) {
        const auth = popinSubmitConfig.auth;
        if (auth.type === 'bearer' && auth.token) {
          headers['Authorization'] = `Bearer ${auth.token}`;
        } else if (auth.type === 'apikey' && auth.token && auth.headerName) {
          headers[auth.headerName] = auth.token;
        } else if (auth.type === 'basic' && auth.username && auth.password) {
          const credentials = typeof btoa !== 'undefined'
            ? btoa(`${auth.username}:${auth.password}`)
            : Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
        }
      }

      if (hasBody) {
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(popinSubmitConfig.url, {
        method: popinSubmitConfig.method,
        headers,
        body,
      });

      if (response.ok) {
        // On success, invalidate queries to refresh original form values
        queryClient.invalidateQueries({ queryKey: ['form', 'data-source'] });
        // Close popin
        closePopin();
        return;
      }

      // Handle error response from backend
      let errorResponse: BackendErrorResponse;
      try {
        errorResponse = await response.json();
      } catch {
        errorResponse = {
          error: `Popin submit failed with status ${response.status}`,
        };
      }

      // Map backend errors to popin form so fields display dedicated errors
      if (errorResponse.errors && Array.isArray(errorResponse.errors)) {
        for (const backendError of errorResponse.errors as BackendError[]) {
          popinForm.setError(backendError.field, {
            type: 'server',
            message: backendError.message || 'Validation error',
          });
        }
      }

      // Keep dialog open on error; optional: log generic error
      if (errorResponse.error) {
        console.error('Popin submit error:', errorResponse.error);
      }
    } catch (error) {
      // Network or unexpected errors - log and keep dialog open
      console.error('Popin submit failed:', error);
      } finally {
        setIsSubmittingPopin(false);
      }
    }, [resolvedBlock, popinForm, mainForm, closePopin, queryClient, popinEditContext]);

  // Context value
  const contextValue = useMemo(() => ({
    openPopin,
  }), [openPopin]);

  // Determine if dialog should be open
  const isDialogOpen = openBlockId !== null && resolvedBlock !== null;

  return (
    <PopinManagerContext.Provider value={contextValue}>
      {children}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        if (!open) {
          closePopin();
        }
      }}>
        {resolvedBlock && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{resolvedBlock.block.title}</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              {isLoadingPopinData ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
              ) : (
                <Block
                  block={popinDescriptor?.blocks[0] ?? resolvedBlock.block}
                  isDisabled={resolvedBlock.isDisabled}
                  isHidden={false}
                  form={popinForm}
                  formContext={formContext}
                  onLoadDataSource={onLoadDataSource}
                  dataSourceCache={dataSourceCache}
                  // In popin we always want inline fields, never summary rows
                  renderRepeatablesAsSummary={false}
                />
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closePopin}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleValidate}
                disabled={isSubmittingPopin}
              >
                {isSubmittingPopin ? 'Validating...' : 'Validate'}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </PopinManagerContext.Provider>
  );
}
