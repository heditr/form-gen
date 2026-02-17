/**
 * Handlebars Helpers - Custom helpers for form logic evaluation
 * 
 * Registers custom Handlebars helpers for comparison, logic, and data operations
 */

import Handlebars from 'handlebars';

/**
 * Type for comparable values in comparison operations
 */
type Comparable = string | number | boolean | null | undefined;

/**
 * Type for values that can be checked for truthiness
 */
type TruthyValue = unknown;

/**
 * Register all custom Handlebars helpers
 */
export function registerHandlebarsHelpers(): void {
  // Comparison helpers
  // When used as subexpressions like (eq a b), Handlebars passes args directly without context
  Handlebars.registerHelper('eq', (a: Comparable, b: Comparable): boolean => a === b);
  Handlebars.registerHelper('ne', (a: Comparable, b: Comparable): boolean => a !== b);
  Handlebars.registerHelper('gt', (a: Comparable, b: Comparable): boolean => {
    if (typeof a === 'number' && typeof b === 'number') return a > b;
    if (typeof a === 'string' && typeof b === 'string') return a > b;
    return false;
  });
  Handlebars.registerHelper('lt', (a: Comparable, b: Comparable): boolean => {
    if (typeof a === 'number' && typeof b === 'number') return a < b;
    if (typeof a === 'string' && typeof b === 'string') return a < b;
    return false;
  });
  Handlebars.registerHelper('gte', (a: Comparable, b: Comparable): boolean => {
    if (typeof a === 'number' && typeof b === 'number') return a >= b;
    if (typeof a === 'string' && typeof b === 'string') return a >= b;
    return false;
  });
  Handlebars.registerHelper('lte', (a: Comparable, b: Comparable): boolean => {
    if (typeof a === 'number' && typeof b === 'number') return a <= b;
    if (typeof a === 'string' && typeof b === 'string') return a <= b;
    return false;
  });

  // Logic helpers
  Handlebars.registerHelper('and', (...args: unknown[]): boolean => {
    // Last argument is Handlebars HelperOptions object, exclude it
    const values = args.slice(0, -1) as TruthyValue[];
    return values.every((val) => Boolean(val));
  });

  Handlebars.registerHelper('or', (...args: unknown[]): boolean => {
    // Last argument is Handlebars HelperOptions object, exclude it
    const values = args.slice(0, -1) as TruthyValue[];
    return values.some((val) => Boolean(val));
  });

  Handlebars.registerHelper('not', (value: TruthyValue): boolean => !Boolean(value));

  // Data helpers
  Handlebars.registerHelper('contains', (collection: unknown, value: unknown): boolean => {
    if (Array.isArray(collection)) {
      return collection.includes(value);
    }
    if (typeof collection === 'string') {
      return collection.includes(String(value));
    }
    return false;
  });

  Handlebars.registerHelper('isEmpty', (value: unknown): boolean => {
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
  });

  // JSON helper - stringifies objects/arrays to JSON.
  //
  // Notes:
  // - Returns SafeString to prevent HTML escaping (quotes must remain quotes).
  // - JSON.stringify(undefined) returns undefined (not a string), so we explicitly handle null/undefined.
  // - Optional second argument lets callers provide a fallback JSON literal string, e.g. {{json value "[]"}}.
  Handlebars.registerHelper('json', (...args: unknown[]): Handlebars.SafeString => {
    const value = args[0];
    const fallback = typeof args[1] === 'string' ? args[1] : undefined;

    if (value === undefined || value === null) {
      return new Handlebars.SafeString(fallback ?? 'null');
    }

    try {
      const jsonString = JSON.stringify(value);
      return new Handlebars.SafeString(jsonString ?? (fallback ?? 'null'));
    } catch {
      const defaultFallback = Array.isArray(value) ? '[]' : '{}';
      return new Handlebars.SafeString(fallback ?? defaultFallback);
    }
  });

  // Nested data access is already supported by Handlebars via dot notation
  // No additional helper needed - Handlebars natively supports {{user.name}} syntax
}
