/**
 * FileField Component
 * 
 * Renders a file upload field using react-hook-form with Shadcn UI Input component.
 * Handles file uploads, displays existing files from URLs, and stores URL strings in form data.
 */

import { useState, useCallback } from 'react';
import { Controller } from 'react-hook-form';
import type { FieldDescriptor } from '@/types/form-descriptor';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface FileFieldProps {
  field: FieldDescriptor;
  form: UseFormReturn<FieldValues>;
  isDisabled: boolean;
}

/**
 * Upload a file to the server and return the URL
 * 
 * @param file - File to upload
 * @param fieldId - Field ID for the upload
 * @returns Promise resolving to the file URL
 */
async function uploadFile(file: File, fieldId: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('fieldId', fieldId);

  // Use a standard upload endpoint - can be configured via field descriptor in the future
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(error.error || `Upload failed with status ${response.status}`);
  }

  const result = await response.json();
  return result.url || result.fileUrl || result.path || '';
}

/**
 * FileField Component
 * 
 * Renders a file input with label, description, and validation error display.
 * Handles file uploads to get URLs and displays existing files from URLs.
 * Uses Controller from react-hook-form with Shadcn UI Input component.
 */
export default function FileField({
  field,
  form,
  isDisabled,
}: FileFieldProps) {
  // Get validation error for this field
  const error = form.formState.errors[field.id];
  const errorMessage = error?.message as string | undefined;

  // Get current field value
  const fieldValue = form.watch(field.id);
  
  // State for upload progress
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Check if current value is a URL string (existing file)
  const isUrlString = typeof fieldValue === 'string' && fieldValue.length > 0;
  const fileUrl = isUrlString ? fieldValue : null;

  // Handle file selection and upload
  const handleFileChange = useCallback(
    async (file: File | null, onChange: (value: string | null) => void) => {
      if (!file) {
        onChange(null);
        setUploadError(null);
        return;
      }

      setIsUploading(true);
      setUploadError(null);

      try {
        const url = await uploadFile(file, field.id);
        onChange(url);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to upload file';
        setUploadError(errorMessage);
        form.setError(field.id, {
          type: 'upload',
          message: errorMessage,
        });
      } finally {
        setIsUploading(false);
      }
    },
    [field.id, form]
  );

  // Handle removing existing file
  const handleRemoveFile = useCallback(
    (onChange: (value: string | null) => void) => {
      onChange(null);
      setUploadError(null);
    },
    []
  );

  return (
    <div data-testid={`file-field-${field.id}`} className="space-y-2">
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
          <div className="space-y-2">
            {/* Display existing file if URL is present */}
            {fileUrl && (
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex-1"
                >
                  View file
                </a>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleRemoveFile(controllerField.onChange)}
                  disabled={isDisabled || isUploading}
                >
                  Remove
                </Button>
              </div>
            )}

            {/* File input */}
            <Input
              id={field.id}
              name={controllerField.name}
              type="file"
              onChange={(e) => {
                const files = e.target.files;
                if (!files || files.length === 0) {
                  handleFileChange(null, controllerField.onChange);
                  return;
                }
                // Handle single file upload (for now, support single file only)
                const file = files[0];
                handleFileChange(file, controllerField.onChange);
              }}
              onBlur={controllerField.onBlur}
              disabled={isDisabled || isUploading}
              className={cn(
                errorMessage && 'border-destructive focus-visible:ring-destructive'
              )}
              aria-invalid={errorMessage ? 'true' : 'false'}
              aria-describedby={errorMessage ? `${field.id}-error` : undefined}
            />

            {/* Upload status */}
            {isUploading && (
              <p className="text-sm text-muted-foreground">Uploading...</p>
            )}
          </div>
        )}
      />
      {(errorMessage || uploadError) && (
        <div
          id={`${field.id}-error`}
          className="text-sm text-destructive"
          role="alert"
        >
          {uploadError || errorMessage}
        </div>
      )}
    </div>
  );
}
