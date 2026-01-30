# Demo Talk Track: Multi‑Country KYC + Conflict Resolution (Form Descriptor Engine)

## Who this is for
This is a fluid talk track you can use in a live demo with a mixed audience: product, ops, compliance, engineering, and leadership.  
Read it as-is, or treat it like speaker notes.

---

## 1) Start with the problem (what hurts today)
Let’s start with a situation everyone here recognizes: **multi‑country KYC**.

When a customer or entity operates across multiple jurisdictions, the onboarding flow can’t be “one form fits all.” The required questions, allowed answers, validations, and even which documents we can accept can change depending on:
- where the company is incorporated,
- where it will onboard customers,
- what process type this is,
- whether we need signatures,
- and other case factors.

Now add the really hard part: **conflict resolution**.

Sometimes requirements don’t just differ — they collide. One jurisdiction might require a specific identifier format, while another requires a different format. Or one country might require an extra attestation, while another forbids collecting a certain data point at this stage.

In the real world, teams often solve this by creating “variants”:
- We duplicate forms per country.
- We hard-code if/else logic in the UI.
- We redeploy for every rule change.
- And when rules change mid-stream, we risk breaking the user experience.

The outcome is predictable:
- **Applicants get confused**, abandon, or enter the wrong data.
- **Ops and compliance spend time firefighting** inconsistencies.
- **Engineering gets stuck maintaining variants** and shipping hotfixes.
- And the biggest risk: **frontend-only validation is never enough** — the backend must remain authoritative.

So the question becomes:
How do we build a KYC experience that is **fast and friendly for applicants**, but also **strict and adaptable for compliance**—especially across countries?

---

## 2) The solution in one sentence
We built a **metadata-driven form engine** that renders from a global descriptor, then **re-hydrates rules from the backend** when jurisdictional context changes—so the UI stays responsive, inputs aren’t lost, and compliance logic is always up to date.

---

## 3) The key idea: two loops (fast UX + slow compliance)
There are two “loops” working together:

### The fast loop (instant UX)
As the user types or selects values, the form can immediately:
- show/hide fields,
- enable/disable sections,
- validate input inline,
- and load dependent dropdown data.

This is what makes the form feel modern and responsive.

### The slow loop (authoritative compliance)
When a “discriminant” value changes—like country or process type—the form does something more powerful:
- it builds a small **case context**,
- sends it to the backend rules endpoint,
- receives updated compliance rules,  
- and merges those rules into the current form definition.

This lets the backend remain the source of truth while the UI adapts in real time.

---

## 4) What you’re about to see in the demo
In the demo, I’ll do three things:

1) Start with a baseline KYC flow (the same global form structure for everyone).  
2) Change a country/jurisdiction selection and show the system **resolve conflicts by applying the right rules**.  
3) Prove we preserve user input—even when validation rules update.

---

## 5) Demo walkthrough (narrated)
### Step A — Start with a baseline form
We begin with a single “global” form definition—think of it as a blueprint:
- blocks like “Company Details” and “Beneficial Owners”
- fields like “Phone number”, “Address”, “Registration ID”
- baseline validation rules

The important point is: **we’re not shipping different forms per country**. We’re shipping one coherent structure.

### Step B — Show fast UX behavior
As I interact with the form, you’ll see instant behaviors:
- fields enabling/disabling based on selections,
- required indicators and inline errors,
- dependent dropdowns populating based on prior answers.

From the user’s perspective, it just feels like a well-built form.

### Step C — Trigger the compliance re-hydration (the discriminant change)
Now I’ll change a discriminant input—like the incorporation country or onboarding country.

At this moment, the system extracts a compact **CaseContext** and sends it to the backend.

What comes back is not a whole new form. It’s a targeted “rules update”:
- additional validations,
- updated patterns or constraints,
- new hidden/disabled/readonly conditions,
- jurisdiction-specific requirements.

### Step D — Conflict resolution (what “merge” actually means)
Here’s where conflict resolution becomes practical:
- We keep the same form structure and field IDs.
- We **merge the backend rules** into the existing descriptor.

So we get “the same form,” but with **the right rules for this jurisdictional context**.

If a rule becomes stricter, the UI immediately reflects it—without a redeploy.
If a field becomes irrelevant or prohibited, it can be hidden or made read-only.

### Step E — The most important UX promise: no lost input
Now for the part that usually breaks in dynamic KYC forms: when rules change, users often lose what they already entered.

In this system, users keep their inputs.

Even if validation becomes stricter after a jurisdiction change:
- the values are preserved,
- the new rules apply,
- and the user gets clear feedback on what needs to be corrected.

That’s how we reduce abandonment while increasing compliance accuracy.

---

## 6) Why this is a good solution (value, in plain language)
### For compliance and risk
- **Backend stays authoritative**: every submission is validated server-side.
- Rules can evolve without relying on frontend releases.
- We reduce the chance of “wrong rules applied” across jurisdictions.

### For operations and business
- Faster changes: update rule logic centrally instead of updating UI variants.
- Less firefighting: fewer edge cases where one country flow diverges from another.
- Better auditability: jurisdictional decisions are explainable via context + rules.

### For applicants (the experience)
- The form stays fast and responsive.
- They don’t lose progress when requirements change.
- Inline feedback makes it clear how to fix issues immediately.

### For engineering
- One global form structure, fewer forks.
- Clear separation: UI rendering, form state, and backend rules each do their job.
- Safer evolution over time: add fields or rules by updating metadata + rules, not rewriting screens.

---

## 7) The “why now” (why this architecture matters for multi-country KYC)
Multi-country KYC is never “done.” Regulations change, products expand, and onboarding requirements evolve.

This architecture is designed for that reality:
- It assumes change.
- It makes conflict resolution explicit (context → rules → merge).
- It keeps the user experience stable while letting compliance remain strict.

---

## 8) Close with a crisp summary
So in summary:
- We start from a single global form descriptor.
- We keep the UI responsive with instant template-driven behavior and inline validation.
- When jurisdiction changes, we re-hydrate from the backend and merge in the right rules.
- We preserve user input, avoid form variants, and keep backend authority.

That’s how we make multi-country KYC **scalable**, **auditable**, and **user-friendly**.

---

## Appendix (optional, technical audience)
If you want one minute of “how it works” for engineers:

- **Descriptor-driven rendering**: the form UI is generated from a hierarchical descriptor (blocks → fields).
- **Status templates**: hidden/disabled/readonly are evaluated from templates using current form values (fast loop).
- **Discriminants**: certain fields are marked as discriminants; changes rebuild a CaseContext.
- **Re-hydration**: the app POSTs CaseContext to the backend rules endpoint; backend returns a RulesObject.
- **Rule merge**: RulesObject is deep-merged into the descriptor to produce a mergedDescriptor.
- **Validation schema**: a Zod schema is built from merged rules and applied via react-hook-form resolver.
- **Value preservation**: user inputs are preserved across rule updates so the form can adapt without data loss.

