/**
 * MultiselectField Component
 *
 * Renders a popover-style multiselect field integrated with react-hook-form.
 * The field value is a `string[]` — each selected item's value as a string.
 *
 * Design mirrors AutocompleteField: no additional UI dependencies, uses an
 * absolutely-positioned dropdown with inline search and checkbox-style options.
 * The trigger area shows selected values as dismissible chips.
 *
 * Supports:
 *  - Static `items` arrays and dynamic `dataSource` configs
 *  - Loading states while the data source is fetching
 *  - Disabled state propagated from the descriptor status rules
 *  - Validation error display wired to react-hook-form's `formState.errors`
 *  - Keyboard navigation: Escape closes the dropdown
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller } from 'react-hook-form';
import type { FieldDescriptor, FieldItem } from '@/types/form-descriptor';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { FormContext } from '@/utils/template-evaluator';
import { getErrorByPath } from '@/utils/form-errors';
import { evaluateItemsArrayTemplate } from '@/utils/array-template-evaluator';
import { useDataSource } from '@/hooks/use-form-query';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface MultiselectFieldProps {
  field: FieldDescriptor;
  form: UseFormReturn<FieldValues>;
  formContext: FormContext;
  isDisabled: boolean;
  required?: boolean;
  onLoadDataSource?: (
    fieldPath: string,
    url: string,
    auth?: { type: 'bearer' | 'apikey'; token?: string; headerName?: string }
  ) => void;
  dataSourceCache?: Record<string, unknown>;
}

/**
 * MultiselectField Component
 *
 * Renders a multiselect with label, chips for selected values, a search-filtered
 * dropdown, and validation error display.
 */
export default function MultiselectField({
  field,
  form,
  formContext,
  isDisabled,
  required = false,
  onLoadDataSource,
  dataSourceCache = {},
}: MultiselectFieldProps) {
  const error = getErrorByPath(form.formState.errors, field.id) ?? form.formState.errors[field.id];
  const errorMessage = error?.message as string | undefined;

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Always call the hook (React rules), disabled when no dataSource
  const dataSourceQuery = useDataSource(
    {
      fieldPath: field.id,
      config: field.dataSource || { url: '', itemsTemplate: '' },
      formContext,
      enabled: !!field.dataSource,
    },
    {
      initialData: field.dataSource
        ? (dataSourceCache[field.id] as FieldItem[] | undefined)
        : undefined,
    }
  );

  /** Resolved list of all available options */
  const items = useMemo<FieldItem[]>(() => {
    if (field.items) {
      return evaluateItemsArrayTemplate(field.items, formContext);
    }
    if (field.dataSource) {
      const data = dataSourceQuery.data || dataSourceCache[field.id];
      if (data && Array.isArray(data)) {
        return data as FieldItem[];
      }
    }
    return [];
  }, [field.items, field.dataSource, field.id, dataSourceQuery.data, dataSourceCache, formContext]);

  /** Options filtered by the search term */
  const filteredItems = useMemo(
    () =>
      searchTerm
        ? items.filter((item) =>
            item.label.toLowerCase().includes(searchTerm.toLowerCase())
          )
        : items,
    [items, searchTerm]
  );

  /** True while a dynamic data source is being fetched */
  const isLoading = useMemo(() => {
    if (!field.dataSource) return false;
    if (dataSourceQuery.isLoading !== undefined) return dataSourceQuery.isLoading;
    // Fallback: loading if nothing is cached yet
    return !dataSourceCache[field.id];
  }, [field.dataSource, field.id, dataSourceQuery.isLoading, dataSourceCache]);

  // Backward-compat callback-based data source loading (mirrors DropdownField pattern)
  useEffect(() => {
    if (!field.dataSource || !onLoadDataSource) return;

    const data = dataSourceQuery.data || dataSourceCache[field.id];
    if (data && Array.isArray(data)) return;

    const auth = field.dataSource.auth;
    if (!auth) {
      onLoadDataSource(field.id, field.dataSource.url, undefined);
      return;
    }
    if (auth.type === 'bearer' || auth.type === 'apikey') {
      onLoadDataSource(field.id, field.dataSource.url, {
        type: auth.type,
        token: auth.token,
        headerName: auth.headerName,
      });
    } else {
      onLoadDataSource(field.id, field.dataSource.url, undefined);
    }
  }, [field.dataSource, field.id, dataSourceQuery.data, dataSourceCache, onLoadDataSource]);

  // Close dropdown when clicking outside the component
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-focus the search input when the dropdown opens
  useEffect(() => {
    if (isOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen]);

  const openDropdown = () => {
    if (!isDisabled && !isLoading) {
      setIsOpen(true);
    }
  };

  const triggerLabel = isLoading ? 'Loading...' : 'Select options';

  return (
    <div data-testid={`multiselect-field-${field.id}`} className="space-y-2">
      <Label htmlFor={field.id}>
        {field.label}
        {required && (
          <span className="ml-1 text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </Label>

      {field.description && (
        <p className="text-sm text-muted-foreground">{field.description}</p>
      )}

      <Controller
        name={field.id}
        control={form.control}
        render={({ field: controllerField }) => {
          const selectedValues: string[] = Array.isArray(controllerField.value)
            ? (controllerField.value as string[])
            : [];

          /** Items whose values are currently selected */
          const selectedItems = items.filter((item) =>
            selectedValues.includes(String(item.value))
          );

          /** Toggle an item's presence in the selected values array */
          const toggleValue = (itemValue: string) => {
            const next = selectedValues.includes(itemValue)
              ? selectedValues.filter((v) => v !== itemValue)
              : [...selectedValues, itemValue];
            controllerField.onChange(next);
          };

          /** Remove a specific value (from a chip's dismiss button) */
          const removeValue = (itemValue: string) => {
            controllerField.onChange(selectedValues.filter((v) => v !== itemValue));
          };

          return (
            <div ref={containerRef} className="relative">
              {/* ── Trigger: chip row + open button ── */}
              <div
                className={cn(
                  'flex flex-wrap items-center gap-1.5 min-h-10 px-3 py-2',
                  'rounded-md border border-input bg-background text-sm',
                  'transition-colors',
                  errorMessage && 'border-destructive',
                  (isDisabled || isLoading) && 'opacity-50 cursor-not-allowed'
                )}
              >
                {/* Dismissible chips for each selected value */}
                {selectedItems.map((item) => (
                  <span
                    key={String(item.value)}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 dark:bg-primary/20 text-primary text-xs font-medium px-2 py-0.5"
                  >
                    {item.label}
                    <button
                      type="button"
                      aria-label={`Remove ${item.label}`}
                      disabled={isDisabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeValue(String(item.value));
                      }}
                      className="ml-0.5 rounded-full hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      ×
                    </button>
                  </span>
                ))}

                {/* Open/close trigger button */}
                <button
                  id={field.id}
                  type="button"
                  aria-label={triggerLabel}
                  aria-haspopup="listbox"
                  aria-expanded={isOpen}
                  aria-invalid={errorMessage ? 'true' : 'false'}
                  aria-describedby={errorMessage ? `${field.id}-error` : undefined}
                  disabled={isDisabled || isLoading}
                  onClick={openDropdown}
                  className="flex-1 text-left text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  {/* Show placeholder text when nothing is selected */}
                  {selectedItems.length === 0 ? triggerLabel : null}
                </button>
              </div>

              {/* ── Dropdown panel ── */}
              {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-[var(--popover)] text-[var(--popover-foreground)] border border-border rounded-md shadow-lg">
                  {/* Search / filter input */}
                  <div className="p-2 border-b border-border">
                    <input
                      ref={searchRef}
                      type="search"
                      role="searchbox"
                      placeholder="Search..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          setIsOpen(false);
                          setSearchTerm('');
                        }
                      }}
                      className="w-full text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                    />
                  </div>

                  {/* Options list with multi-select semantics */}
                  <div
                    role="listbox"
                    aria-multiselectable="true"
                    aria-label={`${field.label} options`}
                    className="max-h-48 overflow-y-auto py-1"
                  >
                    {filteredItems.length > 0 ? (
                      filteredItems.map((item) => {
                        const itemValue = String(item.value);
                        const isSelected = selectedValues.includes(itemValue);
                        return (
                          <div
                            key={itemValue}
                            role="option"
                            aria-selected={isSelected}
                            // Prevent the search input from losing focus when clicking options
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => toggleValue(itemValue)}
                            className={cn(
                              'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer select-none',
                              'hover:bg-accent hover:text-accent-foreground',
                              isSelected && 'bg-primary/10 dark:bg-primary/20 text-primary'
                            )}
                          >
                            {/* Visual checkbox indicator */}
                            <span
                              className={cn(
                                'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                                isSelected
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-input'
                              )}
                              aria-hidden="true"
                            >
                              {isSelected && (
                                <svg
                                  className="h-3 w-3"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={3}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              )}
                            </span>
                            {item.label}
                          </div>
                        );
                      })
                    ) : (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No options found
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        }}
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
    </div>
  );
}
