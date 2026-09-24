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
import { useFieldError } from '@/hooks/use-field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  buildAcceptAttributeFromFormats,
  fileMatchesAcceptedFormats,
} from '@/utils/accepted-file-formats';

export interface FileFieldProps {
  field: FieldDescriptor;
  form: UseFormReturn<FieldValues>;
  isDisabled: boolean;
  isReadonly?: boolean;
  required?: boolean;
}

const DEFAULT_UPLOAD_URL = '/api/upload';

function getAcceptedFormats(field: FieldDescriptor): string[] {
  return field.file?.acceptedFormats ?? [];
}

function getAcceptAttribute(field: FieldDescriptor): string | undefined {
  return buildAcceptAttributeFromFormats(getAcceptedFormats(field));
}

function validateSelectedFile(file: File, field: FieldDescriptor): string | null {
  const maxSizeBytes = field.file?.maxSizeBytes;
  if (maxSizeBytes !== undefined && file.size > maxSizeBytes) {
    return `File exceeds the maximum size of ${maxSizeBytes} bytes`;
  }

  const acceptedFormats = getAcceptedFormats(field);
  if (acceptedFormats.length > 0 && !fileMatchesAcceptedFormats(file, acceptedFormats)) {
    return `File format must be one of: ${acceptedFormats.join(', ')}`;
  }

  return null;
}

function resolveDeleteUrl(deleteUrl: string, fileReference: string): string {
  return deleteUrl.includes('{id}')
    ? deleteUrl.replace('{id}', encodeURIComponent(fileReference))
    : deleteUrl;
}

/**
 * Upload a file to the server and return the URL
 * 
 * @param file - File to upload
 * @param fieldId - Field ID for the upload
 * @returns Promise resolving to the file URL
 */
async function uploadFile(file: File, fieldId: string, uploadUrl = DEFAULT_UPLOAD_URL): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('fieldId', fieldId);

  const response = await fetch(uploadUrl, {
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

async function deleteFile(fileReference: string, deleteUrl?: string): Promise<void> {
  if (!deleteUrl) {
    return;
  }

  const response = await fetch(resolveDeleteUrl(deleteUrl, fileReference), {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Delete failed' }));
    throw new Error(error.error || `Delete failed with status ${response.status}`);
  }
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
  isReadonly = false,
  required = false,
}: FileFieldProps) {
  const error = useFieldError(form, field.id);
  const errorMessage = error?.message as string | undefined;

  // Get current field value
  const fieldValue = form.watch(field.id);
  
  // State for upload progress
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Check if current value is a URL string (existing file)
  const isUrlString = typeof fieldValue === 'string' && fieldValue.length > 0;
  const fileUrl = isUrlString ? fieldValue : null;
  const accept = getAcceptAttribute(field);
  const isMultiple = field.file?.multiple ?? false;

  const setUploadFailure = useCallback((message: string) => {
    setUploadError(message);
    form.setError(field.id, {
      type: 'upload',
      message,
    });
  }, [field.id, form]);

  // Handle file selection and upload
  const handleFileChange = useCallback(
    async (files: File[], onChange: (value: string | string[] | null) => void) => {
      if (files.length === 0) {
        onChange(null);
        setUploadError(null);
        return;
      }

      const validationError = files
        .map((file) => validateSelectedFile(file, field))
        .find((message): message is string => message !== null);
      if (validationError) {
        setUploadFailure(validationError);
        return;
      }

      setIsUploading(true);
      setUploadError(null);

      try {
        const uploadUrl = field.file?.uploadUrl ?? DEFAULT_UPLOAD_URL;
        const urls = await Promise.all(files.map((file) => uploadFile(file, field.id, uploadUrl)));
        onChange(isMultiple ? urls : urls[0]);

        if (!isMultiple && typeof fieldValue === 'string' && fieldValue.length > 0) {
          await deleteFile(fieldValue, field.file?.deleteUrl);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to upload file';
        setUploadFailure(errorMessage);
      } finally {
        setIsUploading(false);
      }
    },
    [field, fieldValue, isMultiple, setUploadFailure]
  );

  // Handle removing existing file
  const handleRemoveFile = useCallback(
    async (onChange: (value: string | string[] | null) => void) => {
      setIsUploading(true);
      setUploadError(null);

      try {
        if (typeof fieldValue === 'string' && fieldValue.length > 0) {
          await deleteFile(fieldValue, field.file?.deleteUrl);
        }
        onChange(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to delete file';
        setUploadFailure(errorMessage);
      } finally {
        setIsUploading(false);
      }
    },
    [field.file?.deleteUrl, fieldValue, setUploadFailure]
  );

  return (
    <div
      data-testid={`file-field-${field.id}`}
      data-readonly={isReadonly ? 'true' : undefined}
      aria-readonly={isReadonly}
      className="space-y-2"
    >
      <Label htmlFor={field.id}>
        {field.label}
        {required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
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
                  disabled={isDisabled || isReadonly || isUploading}
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
                const selectedFiles: File[] = Array.from(e.currentTarget.files ?? []);
                handleFileChange(selectedFiles, controllerField.onChange);
              }}
              onBlur={controllerField.onBlur}
              disabled={isDisabled || isReadonly || isUploading}
              aria-readonly={isReadonly}
              data-readonly={isReadonly ? 'true' : undefined}
              required={required}
              accept={accept}
              multiple={isMultiple}
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
