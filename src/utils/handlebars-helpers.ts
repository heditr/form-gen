/**
 * Handlebars Helpers - Custom helpers for form logic evaluation
 *
 * Registers custom Handlebars helpers for comparison, logic, and data operations.
 * The CSP-safe template runtime calls the same functions without compiling templates.
 */

import Handlebars from 'handlebars';

let registered = false;

/**
 * Type for comparable values in comparison operations
 */
type Comparable = string | number | boolean | null | undefined;

const safeHtmlBrand = Symbol('safeHtml');

export type SafeHtml = {
  [safeHtmlBrand]: true;
  value: string;
};

export function safeHtml(value: string): SafeHtml {
  return { [safeHtmlBrand]: true, value };
}

export function isSafeHtml(value: unknown): value is SafeHtml {
  return typeof value === 'object' && value !== null && safeHtmlBrand in value;
}

export function eqHelper(a: Comparable, b: Comparable): boolean {
  return a === b;
}

export function neHelper(a: Comparable, b: Comparable): boolean {
  return a !== b;
}

export function gtHelper(a: Comparable, b: Comparable): boolean {
  if (typeof a === 'number' && typeof b === 'number') return a > b;
  if (typeof a === 'string' && typeof b === 'string') return a > b;
  return false;
}

export function ltHelper(a: Comparable, b: Comparable): boolean {
  if (typeof a === 'number' && typeof b === 'number') return a < b;
  if (typeof a === 'string' && typeof b === 'string') return a < b;
  return false;
}

export function gteHelper(a: Comparable, b: Comparable): boolean {
  if (typeof a === 'number' && typeof b === 'number') return a >= b;
  if (typeof a === 'string' && typeof b === 'string') return a >= b;
  return false;
}

export function lteHelper(a: Comparable, b: Comparable): boolean {
  if (typeof a === 'number' && typeof b === 'number') return a <= b;
  if (typeof a === 'string' && typeof b === 'string') return a <= b;
  return false;
}

export function andHelper(...values: unknown[]): boolean {
  return values.every((value) => Boolean(value));
}

export function orHelper(...values: unknown[]): boolean {
  return values.some((value) => Boolean(value));
}

export function notHelper(value: unknown): boolean {
  return !value;
}

export function containsHelper(collection: unknown, value: unknown): boolean {
  if (Array.isArray(collection)) {
    return collection.includes(value);
  }
  if (typeof collection === 'string') {
    return collection.includes(String(value));
  }
  return false;
}

export function isEmptyHelper(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (Array.isArray(value) || typeof value === 'string') {
    return value.length === 0;
  }
  if (typeof value === 'object') {
    return Object.keys(value).length === 0;
  }
  return false;
}

/**
 * Stringify a value for the json helper.
 * Returns safe HTML so quotes survive mustache escaping.
 */
export function jsonHelper(value: unknown, fallback?: unknown): SafeHtml {
  const fallbackString = typeof fallback === 'string' ? fallback : undefined;

  if (value === undefined || value === null) {
    return safeHtml(fallbackString ?? 'null');
  }

  try {
    const jsonString = JSON.stringify(value);
    return safeHtml(jsonString ?? (fallbackString ?? 'null'));
  } catch {
    const defaultFallback = Array.isArray(value) ? '[]' : '{}';
    return safeHtml(fallbackString ?? defaultFallback);
  }
}

/**
 * Register all custom Handlebars helpers.
 * Kept for callers that still compile templates in tests.
 */
export function registerHandlebarsHelpers(): void {
  if (registered) {
    return;
  }
  registered = true;

  Handlebars.registerHelper('eq', eqHelper);
  Handlebars.registerHelper('ne', neHelper);
  Handlebars.registerHelper('gt', gtHelper);
  Handlebars.registerHelper('lt', ltHelper);
  Handlebars.registerHelper('gte', gteHelper);
  Handlebars.registerHelper('lte', lteHelper);
  Handlebars.registerHelper('and', (...args: unknown[]) => andHelper(...args.slice(0, -1)));
  Handlebars.registerHelper('or', (...args: unknown[]) => orHelper(...args.slice(0, -1)));
  Handlebars.registerHelper('not', notHelper);
  Handlebars.registerHelper('contains', containsHelper);
  Handlebars.registerHelper('isEmpty', isEmptyHelper);
  Handlebars.registerHelper('json', (...args: unknown[]) => {
    const values = args.slice(0, -1);
    return new Handlebars.SafeString(jsonHelper(values[0], values[1]).value);
  });
}

/**
 * Ensure helpers are registered for any Handlebars evaluation path.
 *
 * This is safe to call in both SSR and client runtimes and prevents hydration
 * mismatches when templates are evaluated before `useEffect` runs.
 */
export function ensureHandlebarsHelpersRegistered(): void {
  registerHandlebarsHelpers();
}
