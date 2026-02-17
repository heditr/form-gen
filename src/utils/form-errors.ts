/**
 * Form error path resolution
 *
 * React-hook-form stores nested/array errors as nested objects (e.g. errors.addresses[0].street).
 * This helper resolves an error by dot path (e.g. "addresses.0.street") for display.
 */

export interface FieldErrorLike {
  message?: string;
  type?: string;
}

/**
 * Get validation error at a dot-notation path (e.g. "addresses.0.street").
 * Supports both flat (errors[fieldId]) and nested (errors.addresses[0].street) structures.
 */
export function getErrorByPath(
  errors: Record<string, unknown> | undefined,
  path: string
): FieldErrorLike | undefined {
  if (!errors || !path) {
    return undefined;
  }
  const parts = path.split('.');
  let current: unknown = errors;
  for (const part of parts) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    const num = Number(part);
    const key = !Number.isNaN(num) && String(num) === part ? num : part;
    current = (current as Record<string, unknown>)[key as string];
  }
  if (
    current &&
    typeof current === 'object' &&
    'message' in (current as object)
  ) {
    return current as FieldErrorLike;
  }
  return undefined;
}
