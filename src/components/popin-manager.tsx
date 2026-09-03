/**
 * Popin Manager Component
 *
 * Manages popin block state and provides context for opening/closing popins.
 * Popin RHF instance is lazy-mounted via PopinFormSession when the dialog opens.
 */

'use client';

import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { GlobalFormDescriptor, CaseContext } from '@/types/form-descriptor';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { FormContext } from '@/utils/template-evaluator';
import { resolveBlockById } from '@/utils/block-resolver';
import { loadPopinData } from '@/utils/popin-load-loader';
import { invalidateConfiguredQueryKeys, getQueryInvalidationKeys } from '@/utils/invalidate-query-keys';
import { isRepeatableBlock, groupFieldsByRepeatableGroupId } from '@/utils/form-descriptor-integration';
import { useOptionalFormStatusContext } from '@/context/form-status-context';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import PopinFormSession from './popin-form-session';

export interface OpenPopinOptions {
  groupId?: string;
  index?: number;
}

interface PopinManagerContextValue {
  openPopin: (blockId: string, options?: OpenPopinOptions) => void;
  invalidateQueriesForBlock: (blockId: string) => Promise<void>;
  flushDraftSave: () => Promise<void>;
}

const PopinManagerContext = createContext<PopinManagerContextValue | null>(null);

export function usePopinManager(): PopinManagerContextValue {
  const context = useContext(PopinManagerContext);
  if (!context) {
    throw new Error('usePopinManager must be used within PopinManagerProvider');
  }
  return context;
}

export function useInvalidateQueriesForBlock(): (blockId: string) => Promise<void> {
  const context = useContext(PopinManagerContext);
  return context?.invalidateQueriesForBlock ?? (async () => {});
}

export function useFlushDraftSave(): () => Promise<void> {
  const context = useContext(PopinManagerContext);
  return context?.flushDraftSave ?? (async () => {});
}

export interface PopinManagerProviderProps {
  children: React.ReactNode;
  mergedDescriptor: GlobalFormDescriptor | null;
  form: UseFormReturn<FieldValues>;
  caseContext: CaseContext;
  onLoadDataSource: (
    fieldPath: string,
    url: string,
    auth?: { type: 'bearer' | 'apikey'; token?: string; headerName?: string }
  ) => void;
  dataSourceCache: Record<string, unknown>;
  /** Fallback when not wrapped in FormStatusProvider (e.g. tests) */
  formContext?: FormContext;
  flushDraftSave?: () => Promise<void>;
}

export function PopinManagerProvider({
  children,
  mergedDescriptor,
  form: mainForm,
  caseContext,
  onLoadDataSource,
  dataSourceCache,
  formContext: formContextProp,
  flushDraftSave: flushDraftSaveProp,
}: PopinManagerProviderProps) {
  const queryClient = useQueryClient();
  const statusContext = useOptionalFormStatusContext();
  const initialFormContext = statusContext?.formContext ?? formContextProp ?? {};

  const flushDraftSave = useCallback(async () => {
    await flushDraftSaveProp?.();
  }, [flushDraftSaveProp]);

  const [openBlockId, setOpenBlockId] = useState<string | null>(null);
  const [popinEditContext, setPopinEditContext] = useState<{
    groupId: string;
    index: number;
  } | null>(null);
  const [popinLoadData, setPopinLoadData] = useState<Record<string, unknown> | null>(null);
  const [isLoadingPopinData, setIsLoadingPopinData] = useState(false);

  const resolvedBlock = useMemo(() => {
    if (!openBlockId || !mergedDescriptor) {
      return null;
    }
    return resolveBlockById(openBlockId, mergedDescriptor, initialFormContext);
  }, [openBlockId, mergedDescriptor, initialFormContext]);

  const popinDescriptor = useMemo(() => {
    if (!resolvedBlock || !mergedDescriptor) {
      return null;
    }
    const block = resolvedBlock.block;

    if (popinEditContext && isRepeatableBlock(block)) {
      const { groupId } = popinEditContext;
      const fieldGroups = groupFieldsByRepeatableGroupId(block.fields);
      const groupFields = fieldGroups[groupId];
      if (!groupFields?.length) {
        return null;
      }
      const instanceFields = groupFields
        .filter((f) => f.type !== 'button')
        .map((f) => {
          const baseId = f.id.startsWith(`${groupId}.`)
            ? f.id.slice(groupId.length + 1)
            : f.id;
          return { ...f, id: baseId, repeatableGroupId: undefined };
        });
      return {
        version: mergedDescriptor.version,
        blocks: [
          {
            id: `${block.id}-instance`,
            title: block.title,
            layout: block.layout,
            fields: instanceFields,
          },
        ],
        submission: mergedDescriptor.submission,
      } as GlobalFormDescriptor;
    }

    return {
      version: mergedDescriptor.version,
      blocks: [block],
      submission: mergedDescriptor.submission,
    } as GlobalFormDescriptor;
  }, [resolvedBlock, mergedDescriptor, popinEditContext]);

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
        console.error('Failed to load popin data:', error);
        setPopinLoadData(null);
      } finally {
        setIsLoadingPopinData(false);
      }
    };

    void loadData();
  }, [resolvedBlock, popinEditContext, mainForm, initialFormContext]);

  const openPopin = useCallback(
    (blockId: string, options?: OpenPopinOptions) => {
      if (!mergedDescriptor) {
        console.error('Cannot open popin: mergedDescriptor is not available');
        return;
      }

      const resolved = resolveBlockById(blockId, mergedDescriptor, initialFormContext);
      if (!resolved) return;
      if (resolved.isHidden) {
        console.warn(`Cannot open popin: Block "${blockId}" is hidden`);
        return;
      }

      setOpenBlockId(blockId);
      if (options?.groupId !== undefined) {
        setPopinEditContext({
          groupId: options.groupId,
          index: options.index ?? -1,
        });
      } else {
        setPopinEditContext(null);
      }
    },
    [mergedDescriptor, initialFormContext]
  );

  const closePopin = useCallback(() => {
    if (resolvedBlock?.block.fields) {
      for (const field of resolvedBlock.block.fields) {
        mainForm.clearErrors(field.id as never);
      }
    }
    setOpenBlockId(null);
    setPopinEditContext(null);
    setPopinLoadData(null);
  }, [resolvedBlock, mainForm]);

  const invalidateQueriesForBlock = useCallback(
    async (blockId: string) => {
      const queryKeys = getQueryInvalidationKeys(mergedDescriptor, blockId);
      if (!queryKeys?.length) {
        return;
      }

      const currentMainFormValues = mainForm.getValues();
      const formContextForInvalidation: FormContext = {
        ...currentMainFormValues,
        ...initialFormContext,
        caseContext: caseContext as unknown as FormContext,
        formData: currentMainFormValues,
      };

      await invalidateConfiguredQueryKeys({
        queryClient,
        queryKeys,
        formContext: formContextForInvalidation,
      });
    },
    [mergedDescriptor, mainForm, initialFormContext, caseContext, queryClient]
  );

  const flushDraftThenInvalidate = useCallback(
    async (blockId: string, options?: { includeDefaultDataSource?: boolean }) => {
      await flushDraftSave();
      const configuredKeys = getQueryInvalidationKeys(mergedDescriptor, blockId) ?? [];
      const defaultDataSourceKey: Array<string> = ['form', 'data-source'];
      const hasDefaultDataSource = configuredKeys.some(
        (key) => JSON.stringify(key) === JSON.stringify(defaultDataSourceKey)
      );
      const queryKeys =
        options?.includeDefaultDataSource && !hasDefaultDataSource
          ? [...configuredKeys, defaultDataSourceKey]
          : configuredKeys;

      if (queryKeys.length === 0) {
        return;
      }

      const currentMainFormValues = mainForm.getValues();
      const formContextForInvalidation: FormContext = {
        ...currentMainFormValues,
        ...initialFormContext,
        caseContext: caseContext as unknown as FormContext,
        formData: currentMainFormValues,
      };

      await invalidateConfiguredQueryKeys({
        queryClient,
        queryKeys,
        formContext: formContextForInvalidation,
      });
    },
    [flushDraftSave, mergedDescriptor, mainForm, initialFormContext, caseContext, queryClient]
  );

  const contextValue = useMemo(
    () => ({
      openPopin,
      invalidateQueriesForBlock,
      flushDraftSave,
    }),
    [openPopin, invalidateQueriesForBlock, flushDraftSave]
  );

  const isDialogOpen = openBlockId !== null && resolvedBlock !== null && popinDescriptor !== null;

  return (
    <PopinManagerContext.Provider value={contextValue}>
      {children}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closePopin();
          }
        }}
      >
        {isDialogOpen && resolvedBlock && popinDescriptor && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{resolvedBlock.block.title}</DialogTitle>
            </DialogHeader>
            <PopinFormSession
              resolvedBlock={resolvedBlock}
              popinDescriptor={popinDescriptor}
              mainForm={mainForm}
              initialFormContext={initialFormContext}
              caseContext={caseContext}
              popinEditContext={popinEditContext}
              popinLoadData={popinLoadData}
              isLoadingPopinData={isLoadingPopinData}
              onLoadDataSource={onLoadDataSource}
              dataSourceCache={dataSourceCache}
              onClose={closePopin}
              onValidated={flushDraftThenInvalidate}
            />
          </DialogContent>
        )}
      </Dialog>
    </PopinManagerContext.Provider>
  );
}
