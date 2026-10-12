## CSP-safe template evaluation

Integration hosts send this Content Security Policy:

```
script-src * 'unsafe-inline'
```

That policy allows scripts from any host and inline scripts. It does not allow `eval` or `new Function`. Deploying the form there failed while the page evaluated descriptor templates:

```
Error evaluating template: EvalError: Evaluating a string as JavaScript violates the following Content Security Policy directive because 'unsafe-eval' is not an allowed source of script: script-src * 'unsafe-inline'
```

The log line comes from `evaluateTemplate` in `src/utils/template-evaluator.ts`. The throw came from `Handlebars.compile`. Handlebars turns a template string into a JavaScript function and runs that source with `new Function`. Chromium treats that as eval.

The same compile path also ran in `src/utils/response-transformer.ts` for `iteratorTemplate` and `itemsTemplate`.

### What changed

Evaluation no longer compiles templates.

1. `Handlebars.parse` turns the template string into an AST. Parsing does not call `Function`.
2. `src/utils/template-runtime.ts` walks that AST and calls the existing helpers as plain functions (`eq`, `and`, `json`, `lookup`, and the rest). A step-by-step fixture is in [template-runtime.md](./template-runtime.md).
3. Parsed ASTs are cached by template string, in place of the old compiled-function cache.
4. `evaluateTemplate` is still the only public entry. Hidden, disabled, readonly, defaults, payloads, and data-source item templates all go through it.
5. A failed template still logs and returns `''`. Status helpers treat that empty string as not hidden, so a CSP failure shows fields that should be hidden.

The template language for descriptor authors is unchanged.

### Why parse an AST instead of precompiling

Handlebars' own CSP advice is to precompile templates and ship the runtime. Precompile emits a JavaScript file whose `main` function is already a real function. The browser can load that file as a normal script under `script-src *`, without `unsafe-eval`.

That only works when every template is known at build time and can be emitted as a static script. This engine does not have that. Templates arrive at runtime inside the global descriptor, re-hydration rules, default values, URLs, payloads, and data-source `itemsTemplate` strings. A new jurisdiction rule is a descriptor change, not a frontend deploy.

Precompiling those strings on the server and sending the generated function source back does not remove the CSP problem. The browser would still have to turn that source into a function with `new Function`. It would also mean backend-authored template text becomes executable JavaScript.

Evaluating only on the server would keep `new Function` off the page, and it would drop the client fast loop. Hidden, disabled, and readonly updates are supposed to stay under 100ms without a round trip.

Walking the AST keeps the Handlebars syntax, accepts templates that show up only after the page loads, and never turns a template into JavaScript.

### Debug fixture

The check is the Jurisdiction block on `/demo`, from `src/app/api/form/global-descriptor-demo/route.ts`.

Country starts empty. State/Province uses:

```
hidden: '{{not (or (eq country "US") (eq country "CA"))}}'
```

While Country is empty, that template is `"true"`, so State/Province stays out of the DOM. If evaluation throws, `evaluateTemplate` returns `''`, `parseBooleanResult` is false, and State/Province is visible on load. That visible field is the bug.

Choosing United States makes the hidden template `"false"`. The field appears and loads `/api/data-sources/states` through:

```
itemsTemplate: '{"label":"{{item.name}}","value":"{{item.code}}"}'
```

California in that dropdown is the proof that the second former `Handlebars.compile` site still runs. The field also carries a validation template (`{{#if (eq country "US")}}...{{/if}}`) so the same page exercises a block helper, not only a mustache.

`e2e/csp-template-eval.spec.ts` applies the integration policy in Chromium. It does not change the app's headers. Playwright intercepts the document response, sets `Content-Security-Policy: script-src * 'unsafe-inline'`, and inserts this probe as a real inline script in `<head>`:

```html
<script>
  try {
    new Function("return 1")();
    window.__cspEval = "allowed";
  } catch (e) {
    window.__cspEval = String(e && e.message || e);
  }
</script>
```

The probe must be in the HTML the parser sees. `page.evaluate` runs as a DevTools script, and Chrome does not apply CSP to that script, so a `new Function` call inside `page.evaluate` succeeds even when the page policy forbids eval. The inline probe is subject to the policy. The test fails unless `window.__cspEval` contains `unsafe-eval`.

It then asserts:

- `dropdown-field-state` inside `block-jurisdiction` is absent on load
- after Country is `US`, that field is visible and has a California option
- the console has no `Error evaluating template` line

Run it against a production server:

```
npm run test:e2e:csp
```

`next dev` cannot reproduce this. The dev server compiles the framework with `eval`, so the page dies before any form template runs. `next start` does not. The script sets `CSP_E2E_BUILD=1` so that one production build can skip the existing unrelated typecheck failures (`next.config.ts`). A normal `npm run build` still typechecks.

Before this change, that same test failed with State/Province visible and a console full of the `EvalError` above. After it, `new Function` in the probe still throws, and the Jurisdiction field behaves as the template says.
