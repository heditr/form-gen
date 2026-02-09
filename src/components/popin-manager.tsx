/**
 * Popin Manager Component
 * 
 * Manages popin block state and provides context for opening/closing popins.
 * Renders Dialog component with block content when a popin is open.
 */

'use client';

import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import type { GlobalFormDescriptor } from '@/types/form-descriptor';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { FormContext } from '@/utils/template-evaluator';
import { resolveBlockById } from '@/utils/block-resolver';
import { loadPopinData } from '@/utils/popin-load-loader';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Block from './block';

/**
 * Popin Manager Context
 */
interface PopinManagerContextValue {
  openPopin: (blockId: string) => void;
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
  form,
  formContext: initialFormContext,
  onLoadDataSource,
  dataSourceCache,
}: PopinManagerProviderProps) {
  const [openBlockId, setOpenBlockId] = useState<string | null>(null);
  const [popinLoadData, setPopinLoadData] = useState<Record<string, unknown> | null>(null);
  const [isLoadingPopinData, setIsLoadingPopinData] = useState(false);
  
  // Build reactive form context from form values
  const formValues = form.watch();
  const formContext = useMemo(() => ({
    ...formValues,
    ...initialFormContext,
    ...popinLoadData, // Merge popinLoad data into formContext
    formData: formValues,
  }), [formValues, initialFormContext, popinLoadData]);

  // Resolve the currently open block (re-resolve when formContext changes)
  const resolvedBlock = useMemo(() => {
    if (!openBlockId || !mergedDescriptor) {
      return null;
    }
    return resolveBlockById(openBlockId, mergedDescriptor, formContext);
  }, [openBlockId, mergedDescriptor, formContext]);

  // Load popin data when popin opens (if popinLoad config exists)
  useEffect(() => {
    if (!resolvedBlock || !resolvedBlock.block.popinLoad) {
      // Clear popinLoad data when popin closes or has no popinLoad config
      setPopinLoadData(null);
      setIsLoadingPopinData(false);
      return;
    }

    const loadData = async () => {
      setIsLoadingPopinData(true);
      try {
        // Use formContext without popinLoadData to avoid circular dependency
        const contextForLoad: FormContext = {
          ...formValues,
          ...initialFormContext,
          formData: formValues,
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

  // Open popin by block ID
  const openPopin = useCallback((blockId: string) => {
    if (!mergedDescriptor) {
      console.error('Cannot open popin: mergedDescriptor is not available');
      return;
    }

    // Resolve block to check if it exists and is visible
    const resolved = resolveBlockById(blockId, mergedDescriptor, formContext);
    if (!resolved) {
      // Error already logged in resolveBlockById
      return;
    }

    // Check if block is hidden - don't open if hidden
    if (resolved.isHidden) {
      console.warn(`Cannot open popin: Block "${blockId}" is hidden`);
      return;
    }

    // Close any currently open popin and open the new one
    setOpenBlockId(blockId);
  }, [mergedDescriptor, formContext]);

  // Close popin (acts as cancel - discards changes)
  const closePopin = useCallback(() => {
    setOpenBlockId(null);
  }, []);

  // Handle validate button click
  const handleValidate = useCallback(() => {
    if (!resolvedBlock) {
      return;
    }

    const block = resolvedBlock.block;

    // If no popinSubmit config, just close
    if (!block.popinSubmit) {
      closePopin();
      return;
    }

    // TODO: Implement popinSubmit endpoint call
    // For now, just close
    closePopin();
  }, [resolvedBlock, closePopin]);

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
                  block={resolvedBlock.block}
                  isDisabled={resolvedBlock.isDisabled}
                  isHidden={false}
                  form={form}
                  formContext={formContext}
                  onLoadDataSource={onLoadDataSource}
                  dataSourceCache={dataSourceCache}
                />
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closePopin}>
                Cancel
              </Button>
              <Button type="button" onClick={handleValidate}>
                Validate
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </PopinManagerContext.Provider>
  );
}
