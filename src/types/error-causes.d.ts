/**
 * Type declarations for error-causes library
 */

declare module 'error-causes' {
  interface ErrorMetadata {
    name: string;
    message: string;
    code?: string;
    cause?: Error | unknown;
    [key: string]: unknown;
  }

  export function createError(metadata: ErrorMetadata): Error & { cause: ErrorMetadata };
  
  export function errorCauses<T extends Record<string, { code?: string | number; message?: string }>>(
    definitions: T
  ): [
    { [K in keyof T]: ErrorMetadata },
    (handlers: { [K in keyof T]?: (error: Error & { cause: T[K] }) => void }) => (error: Error) => void
  ];
}
