/**
 * CSP-safe Handlebars interpreter.
 *
 * `Handlebars.compile` turns a template into JavaScript and runs it with
 * `new Function`. Integration CSP (`script-src` without `'unsafe-eval'`)
 * rejects that. `Handlebars.parse` only builds an AST. This module walks it.
 *
 * Call `evaluateTemplate` in `template-evaluator.ts`. That function parses,
 * caches the AST, and turns a throw into `''`. `renderTemplate` is the walk.
 *
 * The walk supports content, comments, mustaches, and the block helpers
 * `if`, `unless`, and `each`. Expressions are paths, literals, and
 * subexpressions for the helpers in this file (`eq`, `json`, `lookup`, and
 * the rest). Hash arguments and unknown nodes throw.
 *
 * A step-by-step fixture is in `docs/template-runtime.md`.
 */

import {
  andHelper,
  containsHelper,
  eqHelper,
  gtHelper,
  gteHelper,
  isEmptyHelper,
  isSafeHtml,
  jsonHelper,
  ltHelper,
  lteHelper,
  neHelper,
  notHelper,
  orHelper,
} from './handlebars-helpers';

type Comparable = string | number | boolean | null | undefined;

type StripFlags = {
  open?: boolean;
  close?: boolean;
};

/**
 * One node from `Handlebars.parse`.
 *
 * Only the fields this walker reads are listed. `program` is the block body.
 * `inverse` is the `{{else}}` body. `parts` is a path split on `.`.
 * `depth` is how many `../` segments the path has. `data` is true for `@index`.
 * `escaped` is false for `{{{raw}}}`. `strip` is the `~` whitespace flags.
 */
export type TemplateNode = {
  type: string;
  body?: TemplateNode[];
  value?: unknown;
  original?: string;
  parts?: string[];
  depth?: number;
  data?: boolean;
  path?: TemplateNode;
  params?: TemplateNode[];
  program?: TemplateNode;
  inverse?: TemplateNode;
  escaped?: boolean;
  strip?: StripFlags;
  openStrip?: StripFlags;
  inverseStrip?: StripFlags;
  closeStrip?: StripFlags;
  hash?: { pairs?: unknown[] };
};

type Helper = (...args: unknown[]) => unknown;

const helpers: Record<string, Helper> = {
  eq: (left, right) => eqHelper(left as Comparable, right as Comparable),
  ne: (left, right) => neHelper(left as Comparable, right as Comparable),
  gt: (left, right) => gtHelper(left as Comparable, right as Comparable),
  lt: (left, right) => ltHelper(left as Comparable, right as Comparable),
  gte: (left, right) => gteHelper(left as Comparable, right as Comparable),
  lte: (left, right) => lteHelper(left as Comparable, right as Comparable),
  and: (...args) => andHelper(...args),
  or: (...args) => orHelper(...args),
  not: (value) => notHelper(value),
  contains: (collection, value) => containsHelper(collection, value),
  isEmpty: (value) => isEmptyHelper(value),
  json: (value, fallback) => jsonHelper(value, fallback),
  lookup: (collection, key) => {
    if (collection == null || typeof collection !== 'object') {
      return undefined;
    }
    return (collection as Record<string, unknown>)[String(key)];
  },
};

const escapeMap: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * `#if` / `#unless` emptiness. `0` is present. An empty array is empty.
 * This is not the `isEmpty` helper.
 */
function isBlockEmpty(value: unknown): boolean {
  if (!value && value !== 0) {
    return true;
  }
  return Array.isArray(value) && value.length === 0;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"'`=]/g, (character) => escapeMap[character]);
}

function assertNoHash(node: TemplateNode): void {
  const pairs = node.hash?.pairs;
  if (pairs && pairs.length > 0) {
    throw new Error(`Unsupported hash arguments in ${node.type}`);
  }
}

function helperName(path: TemplateNode | undefined): string | undefined {
  if (!path || path.type !== 'PathExpression' || path.parts?.length !== 1) {
    return undefined;
  }
  return path.parts[0];
}

/**
 * Read a path from the context stack.
 *
 * The current frame is the last entry. `depth` 1 reads the parent (`../`).
 * An empty `parts` list is `{{this}}`. `@data` paths return `undefined`;
 * repeatable rows rewrite `@index` to `index` before parse.
 */
function lookupPath(stack: unknown[], path: TemplateNode): unknown {
  if (path.data) {
    return undefined;
  }
  const depth = path.depth ?? 0;
  let current = stack[stack.length - 1 - depth];
  const parts = path.parts ?? [];
  if (parts.length === 0) {
    return current;
  }
  for (const part of parts) {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Evaluate one expression to a raw value (not an escaped string).
 * Subexpression params are evaluated first, then the helper is called.
 */
function evalExpr(node: TemplateNode, stack: unknown[]): unknown {
  assertNoHash(node);
  switch (node.type) {
    case 'SubExpression': {
      const name = helperName(node.path);
      if (!name || !helpers[name]) {
        throw new Error(`Unsupported helper ${node.path?.original ?? name}`);
      }
      return helpers[name](...(node.params ?? []).map((param) => evalExpr(param, stack)));
    }
    case 'PathExpression':
      return lookupPath(stack, node);
    case 'StringLiteral':
    case 'NumberLiteral':
    case 'BooleanLiteral':
      return node.value;
    case 'NullLiteral':
      return null;
    case 'UndefinedLiteral':
      return undefined;
    default:
      throw new Error(`Unsupported expression ${node.type}`);
  }
}

function stringifyOutput(value: unknown, escaped: boolean): string {
  if (isSafeHtml(value)) {
    return value.value;
  }
  if (value == null) {
    return '';
  }
  const text = String(value);
  return escaped ? escapeHtml(text) : text;
}

/**
 * Render `{{...}}`. A single-part name that is a known helper is called.
 * Anything else is a path lookup. Output is HTML-escaped unless the value
 * is safe HTML (`json`) or the mustache is `{{{raw}}}`.
 */
function renderMustache(node: TemplateNode, stack: unknown[]): string {
  assertNoHash(node);
  const name = helperName(node.path);
  const params = node.params ?? [];
  if (name && helpers[name]) {
    const value = helpers[name](...params.map((param) => evalExpr(param, stack)));
    return stringifyOutput(value, node.escaped !== false);
  }
  if (params.length > 0 || !node.path) {
    throw new Error(`Unsupported helper ${name ?? 'unknown'}`);
  }
  return stringifyOutput(lookupPath(stack, node.path), node.escaped !== false);
}

/**
 * Render `{{#if}}`, `{{#unless}}`, or `{{#each}}`.
 * `each` pushes the current item onto the context stack for the inner program.
 */
function renderBlock(node: TemplateNode, stack: unknown[]): string {
  assertNoHash(node);
  const name = helperName(node.path);
  if (name === 'if' || name === 'unless') {
    const value = node.params?.[0] ? evalExpr(node.params[0], stack) : undefined;
    const empty = isBlockEmpty(value);
    const useInverse = name === 'if' ? empty : !empty;
    const branch = useInverse ? node.inverse : node.program;
    if (!branch) {
      return '';
    }
    const trimStart = useInverse ? node.inverseStrip?.close : node.openStrip?.close;
    const trimEnd = useInverse
      ? node.closeStrip?.open
      : (node.inverse ? node.inverseStrip?.open : node.closeStrip?.open);
    return renderProgram(branch, stack, Boolean(trimStart), Boolean(trimEnd));
  }
  if (name === 'each') {
    const value = node.params?.[0] ? evalExpr(node.params[0], stack) : undefined;
    const items = Array.isArray(value) ? value : null;
    if (!items || items.length === 0) {
      return node.inverse
        ? renderProgram(node.inverse, stack, Boolean(node.inverseStrip?.close), Boolean(node.closeStrip?.open))
        : '';
    }
    const rendered = items
      .map((item) => renderProgram(
        node.program ?? { type: 'Program', body: [] },
        [...stack, item],
        Boolean(node.openStrip?.close),
        false
      ))
      .join('');
    return node.closeStrip?.open ? rendered.replace(/\s+$/, '') : rendered;
  }
  throw new Error(`Unsupported block helper ${name ?? node.path?.original}`);
}

/**
 * Concatenate the statements in one program.
 * `~` on a mustache trims whitespace on the neighboring content.
 */
function renderProgram(
  program: TemplateNode,
  stack: unknown[],
  trimStart = false,
  trimEnd = false
): string {
  let output = '';
  let trimLeading = trimStart;
  for (const statement of program.body ?? []) {
    if (statement.type === 'ContentStatement') {
      let text = String(statement.value ?? '');
      if (trimLeading) {
        text = text.replace(/^\s+/, '');
      }
      trimLeading = false;
      output += text;
      continue;
    }
    if (statement.type === 'CommentStatement') {
      continue;
    }
    if (statement.type === 'MustacheStatement') {
      if (statement.strip?.open) {
        output = output.replace(/\s+$/, '');
      }
      output += renderMustache(statement, stack);
      trimLeading = Boolean(statement.strip?.close);
      continue;
    }
    if (statement.type === 'BlockStatement') {
      if (statement.openStrip?.open) {
        output = output.replace(/\s+$/, '');
      }
      output += renderBlock(statement, stack);
      trimLeading = Boolean(statement.closeStrip?.close);
      continue;
    }
    throw new Error(`Unsupported statement ${statement.type}`);
  }
  return trimEnd ? output.replace(/\s+$/, '') : output;
}

/**
 * Render a parsed program against one context object.
 *
 * The stack starts as `[context]`. Paths read that object. `{{#each}}`
 * pushes each item for the duration of that item's body.
 *
 * @param program - AST from `Handlebars.parse`
 * @param context - Root data (`formData`, `caseContext`, and field values)
 * @returns Rendered text. Normal mustaches are HTML-escaped.
 */
export function renderTemplate(program: TemplateNode, context: unknown): string {
  return renderProgram(program, [context]);
}
