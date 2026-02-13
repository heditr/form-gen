/**
 * AutocompleteField Component
 * 
 * Renders an autocomplete/combobox field using react-hook-form with Shadcn UI Input component.
 * Supports static items and dynamic data sources with search/filter functionality.
 */

import { useEffect, useState, useRef, useMemo } from 'react';
import { Controller } from 'react-hook-form';
import type { FieldDescriptor, FieldItem } from '@/types/form-descriptor';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { FormContext } from '@/utils/template-evaluator';
import { useDataSource } from '@/hooks/use-form-query';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface AutocompleteFieldProps {
  field: FieldDescriptor;
  form: UseFormReturn<FieldValues>;
  formContext: FormContext;
  isDisabled: boolean;
  onLoadDataSource?: (fieldPath: string, url: string, auth?: { type: 'bearer' | 'apikey'; token?: string; headerName?: string }) => void;
  dataSourceCache?: Record<string, unknown>;
}

/**
 * AutocompleteField Component
 * 
 * Renders an autocomplete input with label, description, and validation error display.
 * Uses Controller from react-hook-form with Shadcn UI Input component.
 * Supports both static items and dynamic data sources with search filtering.
 */
export default function AutocompleteField({
  field,
  form,
  formContext,
  isDisabled,
  onLoadDataSource,
  dataSourceCache = {},
}: AutocompleteFieldProps) {
  // Get validation error for this field
  const error = form.formState.errors[field.id];
  const errorMessage = error?.message as string | undefined;

  // Use useDataSource hook - always call it (React hooks rule), but disable when no dataSource
  const dataSourceQuery = useDataSource(
    {
      fieldPath: field.id,
      config: field.dataSource || { url: '', itemsTemplate: '' }, // Minimal config when disabled
      formContext,
      enabled: !!field.dataSource,
    },
    {
      // Fallback to dataSourceCache for backward compatibility during migration
      initialData: field.dataSource ? (dataSourceCache[field.id] as FieldItem[] | undefined) : undefined,
    }
  );

  // Get items from field.items or data source query result
  const items = useMemo<FieldItem[]>(() => {
    if (field.dataSource) {
      // Use hook data if available, otherwise fallback to cache (for backward compatibility)
      const data = dataSourceQuery.data || dataSourceCache[field.id];
      if (data && Array.isArray(data)) {
        return data as FieldItem[];
      }
      // Fallback to callback pattern if hook hasn't loaded yet (backward compatibility)
      if (!data && onLoadDataSource && field.dataSource.auth) {
        // Only call callback if auth is compatible (bearer or apikey, not basic)
        const auth = field.dataSource.auth;
        if (auth.type === 'bearer' || auth.type === 'apikey') {
          onLoadDataSource(field.id, field.dataSource.url, {
            type: auth.type,
            token: auth.token,
            headerName: auth.headerName,
          });
        }
      }
    }
    return field.items || [];
  }, [field.items, field.dataSource, field.id, dataSourceQuery.data, dataSourceCache, onLoadDataSource]);

  // Derive loading state from hook or cache
  const isLoading = useMemo(() => {
    if (!field.dataSource) {
      return false;
    }
    // Use hook loading state if available
    if (dataSourceQuery.isLoading !== undefined) {
      return dataSourceQuery.isLoading;
    }
    // Fallback to cache check (backward compatibility)
    const cachedData = dataSourceCache[field.id];
    return !cachedData || !Array.isArray(cachedData);
  }, [field.dataSource, field.id, dataSourceQuery.isLoading, dataSourceCache]);

  // Track search term
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter items based on search term (derived state)
  const filteredItems = useMemo(() => {
    if (!searchTerm) {
      return items;
    }
    return items.filter((item) =>
      item.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, items]);

  // Derive isOpen state: open if there are filtered items and user is searching, or if focused
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  
  // Update isOpen based on filtered items and focus state
  const shouldBeOpen = useMemo(() => {
    if (isFocused && filteredItems.length > 0) {
      return true;
    }
    if (!searchTerm && items.length > 0 && isFocused) {
      return true;
    }
    return false;
  }, [filteredItems.length, searchTerm, items.length, isFocused]);

  // Sync isOpen with shouldBeOpen
  useEffect(() => {
    setIsOpen(shouldBeOpen);
  }, [shouldBeOpen]);

  const [selectedItem, setSelectedItem] = useState<FieldItem | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleInputChange = (value: string) => {
    setSearchTerm(value);
    setIsFocused(true);
    setFocusedIndex(-1); // Reset focused index when typing
  };

  const handleSelectItem = (item: FieldItem, onChange: (value: string) => void) => {
    setSelectedItem(item);
    setSearchTerm(item.label);
    setIsFocused(false);
    setFocusedIndex(-1);
    onChange(item.value as string);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, onChange: (value: string) => void) => {
    if (!isOpen || filteredItems.length === 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setIsFocused(true);
        if (filteredItems.length > 0) {
          setFocusedIndex(e.key === 'ArrowDown' ? 0 : filteredItems.length - 1);
        }
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < filteredItems.length) {
          handleSelectItem(filteredItems[focusedIndex], onChange);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsFocused(false);
        setFocusedIndex(-1);
        break;
    }
  };

  // Scroll focused option into view
  useEffect(() => {
    if (focusedIndex >= 0 && optionsRef.current) {
      const optionElement = optionsRef.current.children[focusedIndex] as HTMLElement;
      if (optionElement && typeof optionElement.scrollIntoView === 'function') {
        optionElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [focusedIndex]);

  return (
    <div data-testid={`autocomplete-field-${field.id}`} className="space-y-2" ref={containerRef}>
      <Label htmlFor={field.id}>
        {field.label}
      </Label>
      {field.description && (
        <p className="text-sm text-muted-foreground">
          {field.description}
        </p>
      )}
      <div className="relative">
        <Controller
          name={field.id}
          control={form.control}
          render={({ field: controllerField }) => (
            <>
              <Input
                id={field.id}
                name={controllerField.name}
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  handleInputChange(e.target.value);
                  controllerField.onChange(e);
                }}
                onKeyDown={(e) => handleKeyDown(e, controllerField.onChange)}
                onBlur={controllerField.onBlur}
                onFocus={() => setIsFocused(true)}
                disabled={isDisabled || isLoading}
                className={cn(
                  errorMessage && 'border-destructive focus-visible:ring-destructive'
                )}
                aria-invalid={errorMessage ? 'true' : 'false'}
                aria-describedby={errorMessage ? `${field.id}-error` : undefined}
                aria-autocomplete="list"
                aria-expanded={isOpen}
                aria-controls={`${field.id}-options`}
                aria-activedescendant={focusedIndex >= 0 ? `${field.id}-option-${focusedIndex}` : undefined}
              />
              {(isOpen || isLoading) && (
                <div
                  id={`${field.id}-options`}
                  ref={optionsRef}
                  className="absolute z-50 w-full mt-1 bg-[var(--popover)] text-[var(--popover-foreground)] border border-border rounded-md shadow-lg max-h-60 overflow-auto"
                  role="listbox"
                >
                  {isLoading ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Loading...
                    </div>
                  ) : filteredItems.length > 0 ? (
                    filteredItems.map((item, index) => {
                      const isSelected = selectedItem?.value === item.value;
                      const isFocused = focusedIndex === index;
                      return (
                        <div
                          key={String(item.value)}
                          id={`${field.id}-option-${index}`}
                          role="option"
                          aria-selected={isSelected}
                          className={cn(
                            'px-4 py-2.5 text-sm font-medium cursor-pointer transition-colors duration-150',
                            'hover:bg-accent hover:text-accent-foreground',
                            'focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none',
                            isFocused && 'bg-accent text-accent-foreground',
                            isSelected && 'bg-primary/10 dark:bg-primary/20 text-primary'
                          )}
                          onClick={() => handleSelectItem(item, controllerField.onChange)}
                          onMouseDown={(e) => e.preventDefault()} // Prevent input blur
                          onMouseEnter={() => setFocusedIndex(index)}
                          tabIndex={-1}
                        >
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
              )}
            </>
          )}
        />
      </div>
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
