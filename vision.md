# Vision: Multi‑Country KYC Form Engine (Form Descriptor)
 
## Why this exists
KYC onboarding flows become brittle and expensive when requirements vary by **country / jurisdiction / process type** and change frequently. Teams end up shipping “form variants” that drift over time, confuse applicants, and create compliance risk.
 
This project’s vision is a **metadata‑driven form engine** that can adapt in real time to jurisdictional changes while preserving a smooth user experience and enforcing backend authority.
 
## The problem we’re solving
- **Multi‑country KYC complexity**: The “right” questions, validations, and allowed values depend on where the applicant and entity operate.
- **Conflicting requirements**: A single case can involve multiple onboarding countries; rules may differ or directly conflict.
- **Operational churn**: Regulatory updates shouldn’t require constant frontend redeploys or risky hotfixes.
- **User experience failures**: Applicants abandon forms when fields appear/disappear unexpectedly, inputs get lost, or validations change without clarity.
- **Compliance risk**: Frontend-only validation can be bypassed; backend must remain the source of truth.
 
## Principles (non‑negotiables)
- **Backend authority**: The backend is the source of truth for validation outcomes and compliance decisions.
- **Compliance first, without sacrificing UX**: We enforce rules, but we keep the form responsive and understandable.
- **Hybrid reactivity**:
  - **Fast loop (<100ms)**: Inline validation + immediate UI state (hidden/disabled/readonly) evaluation on the client.
  - **Slow loop (<500ms p95)**: Backend “re-hydration” to apply jurisdiction-dependent compliance rules.
- **State preservation**: Users must not lose input when rules update.
- **Type safety + runtime safety**: TypeScript types and runtime validation (Zod) for correctness and maintainability.
- **Separation of concerns**: Container/Presentation pattern; pure utilities where possible; side-effects isolated.
- **Security by design**: Prevent bypass attacks by re-validating on backend; avoid insecure auth/token patterns.
 
## What “good” looks like (success criteria)
- **Flexibility**: Configure new KYC flows primarily by updating descriptors/rules rather than shipping UI code.
- **Consistency**: Frontend and backend execute aligned validation logic; backend remains authoritative.
- **Performance**:
  - Initial form load < 2s
  - Inline validation feedback < 100ms (p95)
  - Re-hydration < 500ms (p95) on discriminant changes
  - Data-source loading < 1s for dropdown/autocomplete population
- **UX**: Clear, stable, accessible form behavior; minimal “surprises”; no lost input during updates.
- **Security**: No critical OWASP Top 10 issues; backend re-validation on submission.
 
## Approach (how we deliver this)
### 1) Descriptor-driven UI
The UI is rendered from a **GlobalFormDescriptor** (blocks → fields) that defines structure, labels, field types, and baseline rules.
 
### 2) Conflict resolution via context + re-hydration
We treat “which rules apply” as a function of **CaseContext** (e.g., incorporation country, onboarding countries, process type, signature needs). When discriminant inputs change, we:
- Extract updated context
- Call the backend rules endpoint
- Receive a **RulesObject**
- Deep-merge rules into the descriptor to create a **mergedDescriptor**
 
This is how we handle multi-jurisdiction complexity without proliferating hard-coded flows.
 
### 3) Fast, user-friendly validation
We use **react-hook-form** for high-performance form state and **Zod** for schema-backed client validation derived from the merged descriptor.
 
### 4) Dynamic data sources
Fields can load options from APIs using templated URLs (Handlebars), with caching and transformation into UI-friendly items.
 
## Guardrails
- Re-hydration calls are **debounced** to avoid overfetching and flicker.
- Dynamic data sources must be safely handled (e.g., whitelisting / rate limiting on backend).
- Any backend validation errors are mapped back to fields for immediate correction.

