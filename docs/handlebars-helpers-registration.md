## Why we call `ensureHandlebarsHelpersRegistered()` at evaluation time

### The “weirdness” you’re noticing

It can look odd that `evaluateTemplate()` calls `ensureHandlebarsHelpersRegistered()` every time:

- `ensureHandlebarsHelpersRegistered()` is invoked inside `src/utils/template-evaluator.ts`
- and it is (intentionally) **not** assumed that `providers.tsx` already ran

This is a deliberate architecture choice to make template evaluation **deterministic** across:

- server route handlers (backend/compliance utilities, proxies)
- the re-hydration slow loop (backend-driven rule updates)
- tests (where no app provider tree may exist)

---

### Core constraint: helpers are global, but initialization was React-effect based

Handlebars helpers are registered on the global Handlebars instance.

Historically, this project initialized helpers here:

- `src/components/providers.tsx` registers helpers in a `useEffect`

That implies:

- **Non-React entrypoints** (API routes, utilities): helpers may never be registered
- **Execution-order dependence**: helpers might be registered “sometimes” depending on what was imported/executed first
- **Tests**: may call template evaluation without ever mounting `ReduxProvider`

If we evaluate a template that uses helpers like `eq`, `and`, `json`, etc. before the effect runs, it can:

- fail or produce different output
- break backend/data-source transformations
- break re-hydration derived results (e.g., dynamic `validation` / `items`)
- break tests depending on execution order

---

### Why this matters specifically for this form engine

This engine evaluates templates in multiple places:

- status templates (`hidden/disabled/readonly`)
- default values
- data source URL and item transformation
- now also: `items` arrays and `validation` arrays (templates returning JSON)

Some of these evaluations can happen:

- during initial render
- during schema building (which can be invoked early and outside UI)
- during server route execution (proxy endpoints, popin load)
- during compliance re-hydration (slow loop) when rules change

So relying on a UI-only `useEffect` initializer is not robust enough.

---

### The chosen solution: “guarded registration”

We made helper registration:

- **idempotent** (via the `registered` flag in `src/utils/handlebars-helpers.ts`)
- **available in any runtime** (SSR or client)
- **triggered by the evaluation boundary**, not by React lifecycle

That is what `ensureHandlebarsHelpersRegistered()` is: a cheap “guard” that ensures the global Handlebars environment has the helpers before we compile/run templates.

Key property: **calling it “everywhere” is not actually re-registering everywhere**.
It’s one boolean check and returns immediately after the first registration in a given runtime.

---

### Why we put it in `evaluateTemplate()` (one place)

We want **a single, obvious boundary** where “Handlebars is about to run”.

Putting the guard in `evaluateTemplate()` means:

- any feature that uses Handlebars automatically gets correct helper availability
- we don’t need to remember to register helpers in each callsite
- we avoid subtle bugs from partial migrations

This is also why it might feel “everywhere”: lots of features call `evaluateTemplate()`.

---

### Why not “just register once at module import time”?

That’s a valid alternative, but it has trade-offs:

- some environments/test runners can import modules in unexpected order
- duplicate registration warnings/errors can happen without idempotency
- module side-effects can be harder to reason about across mixed entrypoints (UI + API routes)

We still effectively “register once”, but we do it via an explicit, idempotent guard.

---

### Note on SSR/hydration

In this repo, most template evaluation happens in **client components/hooks**, so classic SSR hydration mismatch is usually **not** the main problem.

The important issue is simpler: **templates are evaluated in places that don’t go through React providers at all**, and `useEffect` is not a reliable initialization mechanism for that.

---

### Summary

- **Problem**: helpers were registered via `useEffect`, which is too late / not universal.
- **Decision**: register helpers via an idempotent guard at the evaluation boundary.
- **Implementation**: `evaluateTemplate()` calls `ensureHandlebarsHelpersRegistered()`; the guard is constant-time after first call.
- **Benefit**: deterministic evaluation across server routes, re-hydration, and tests (no execution-order bugs).

