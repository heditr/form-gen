## How the template runtime walks a fixture

`evaluateTemplate` in `src/utils/template-evaluator.ts` parses a template once with `Handlebars.parse` and caches the AST. `renderTemplate` in `src/utils/template-runtime.ts` walks that AST. It does not call `new Function`.

The walk keeps a stack of context objects. It starts as `[context]`. A path reads the top object. `{{#each}}` pushes the current item, renders the inner program, then that frame is gone.

Two fixtures below are the Jurisdiction block on `/demo` (`src/app/api/form/global-descriptor-demo/route.ts`). The browser check that drives them is `e2e/csp-template-eval.spec.ts`.

### Simple fixture: a path

State names are filled from this template, one API row at a time:

```
{{item.name}}
```

Context for the California row, after `transformItem` spreads the row onto the context:

```js
{
  item: { name: 'California', code: 'CA' },
  name: 'California',
  code: 'CA',
}
```

`Handlebars.parse` produces one mustache. The path parts are `['item', 'name']`. There are no helper arguments.

1. `renderTemplate` calls `renderProgram` with stack `[{ item, name, code }]`.
2. The only statement is a `MustacheStatement`.
3. `item` is not a helper name, and the path has two parts, so this is a lookup, not a helper call.
4. `lookupPath` starts at the top of the stack, reads `.item`, then `.name`.
5. The value is the string `California`.
6. The mustache is escaped. The string has no `& < > " ' ` =` characters, so the output stays `California`.

That string becomes the option label. The same walk on `{{item.code}}` yields `CA`, the option value.

If `name` were `A & B`, step 6 would emit `A &amp; B`. The `json` helper is the exception: it returns safe HTML, and quotes stay quotes.

### Complex fixture: hidden State/Province

The same block hides State/Province with:

```
{{not (or (eq country "US") (eq country "CA"))}}
```

On first paint the form context has no `country`. The stack is `[{}]`.

The AST is one mustache whose name is the helper `not`. Its only argument is a subexpression `or`, and that `or` has two `eq` subexpressions.

1. `renderMustache` sees the helper `not` and evaluates its argument before calling it.
2. `or` evaluates its arguments left to right.
3. First `eq`: `lookupPath` of `country` is `undefined`. The other argument is the literal `"US"`. `eq(undefined, "US")` is `false`.
4. Second `eq`: `eq(undefined, "CA")` is `false`.
5. `or(false, false)` is `false`.
6. `not(false)` is `true`.
7. The mustache stringifies that boolean. Output is `"true"`.

`evaluateHiddenStatus` treats `"true"` as hidden, so `dropdown-field-state` is not in the DOM.

Choose United States. The stack is now `[{ country: 'US' }]`. The same nodes run again:

1. `eq('US', 'US')` is `true`.
2. `eq('US', 'CA')` is `false`.
3. `or(true, false)` is `true`.
4. `not(true)` is `false`.
5. Output is `"false"`.

The field is shown. Its options then use the simple fixture above, against `/api/data-sources/states`.

`#if` uses a different emptiness rule than the `isEmpty` helper. `0` is present, so `{{#if count}}` with `count: 0` takes the main branch. An empty array is empty, so `{{#if items}}` with `items: []` takes `{{else}}`.

### What the browser check is looking at

`npm run test:e2e:csp` loads `/demo` under `script-src * 'unsafe-inline'`.

- Before Country is set, the complex fixture must keep State/Province out of `block-jurisdiction`. A thrown walk returns `''`, and `''` is not hidden, so the field showing up on load means the walk failed.
- After Country is `US`, the simple fixture must produce a California option. That option is missing when `itemsTemplate` does not render.
- An inline `new Function` probe in the document must still throw. The walk is not allowed to depend on `unsafe-eval`.
