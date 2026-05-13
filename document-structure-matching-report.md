# Document structure matching report

This report compares the **backend API shapes you described** with the **document feature currently implemented in this repo** (descriptor-driven `document` fields, `DocumentCard`, documents rehydration merge, and `CaseDocumentsEntry` / `buildDocumentCardFields`).

**Short verdict:** The **conceptual model largely aligns** (document types, the same four category buckets, per–doc-type cards, per-prospect slots, files + requested/optional flags). Several **naming and transport details differ**, and a few **API fields have no first-class equivalent** in the UI model today—those gaps are bridgeable with a thin **normalization / adapter** layer and small extensions if you need full fidelity (comments history, `editable` / `displayed`, file list fields).

---

## 1. What the app builds today (reference)

### 1.1 Categories

`DocumentCategory` in the type system matches your grouped **documents** response keys:

- `agnostic`
- `nominativeUploadableByProspect`
- `prefilledOnly`
- `uploadableByProspect`

(See `src/types/form-descriptor.ts`.)

### 1.2 Documents list → form engine

The pipeline expects a **flat array** of `CaseDocumentsEntry`, not an object grouped by category. Each entry carries:

- `documentType` (string; becomes `FieldDescriptor.id` and `DocumentCardConfig.docType`)
- `category: DocumentCategory`
- `slots: Record<string, CaseDocumentsSlotPayload>` with optional `label`, `requested`, `optional`, `files`
- Optional layout, prospect config, file constraints, validation, etc.

Pure builder: `buildDocumentCardFields` in `src/utils/document-card-builder.ts` turns that list into `document` fields with `DocumentCardData` defaults (requested/optional/files per slot, optional `comment`).

Rehydration dispatches `applyDocumentsUpdate` with that array after `POST /api/cases/:caseId/documents` (`src/hooks/use-debounced-documents-rehydration.ts`). The stub route returns `{ documents: [] }` (`src/app/api/cases/[caseId]/documents/route.ts`).

### 1.3 Runtime form value (`DocumentCardData`)

Per card:

- Root slot: `requested`, `optional?`, `files[]`, optional `comment`
- `perProspect`: `prospects[prospectId]` with the same slot shape

File metadata type: `UploadedFileMeta` (`id`, `url`, `filename`, `uploadedAt`, plus optional size, content type, confirmation flag, display name).

---

## 2. Endpoint-by-endpoint comparison

### 2.1 `GET /api/cases/:id/documents`

**Your shape (conceptual):**

```text
{
  agnostic: [{ displayed, docType, editable, requested, … }],
  nominativeUploadableByProspect: [ … ],
  prefilledOnly: [ … ],
  uploadableByProspect: [ … ]
}
```

**App shape:** `CaseDocumentsEntry[]` (after any adapter), each with `documentType` + `category` + richer slot-based seeding.

| Aspect | Match? | Notes |
|--------|--------|--------|
| Category buckets | **Yes** | Same four names as `DocumentCategory`. |
| Grouped vs flat | **Transport mismatch, model OK** | API is grouped by key; the engine wants a flat list. **Flatten** by iterating each array and setting `category` from the parent key. |
| `docType` vs `documentType` | **Naming only** | Map `docType` → `documentType` in the adapter. |
| `requested` | **Mostly yes** | Maps to `requestedDefault` and/or slot-level `requested` (depending on whether the backend means “card default” or per-slot). You may need rules for multi-slot / per-prospect rows. |
| `displayed` | **No dedicated field** | Today, presence in the documents list effectively means “render a card.” **Options:** filter out `displayed: false` before building fields; or add something like `status` / hidden flag on `FieldDescriptor` later. |
| `editable` | **No dedicated field** | `DocumentCard` / `FieldWrapper` use a single `isDisabled` from the container. You can **derive** disabled state from `editable === false` when building the descriptor or pass through a new optional field on `CaseDocumentsEntry` if you extend the type. |
| Extra shape (slots, files in response) | **Extension** | Your snippet only shows flags; `CaseDocumentsEntry` also supports `slots` with `files` for seeding. If GET returns only metadata, **file seeding** likely comes from `documentFiles` (see below). |

**HTTP method:** The client currently calls **`POST`** `/api/cases/:id/documents` with `{ caseContext }`, not `GET`. Aligning with a real **GET** would mean changing `postCaseDocuments` to a GET (and deciding how `caseContext` is sent—query string, separate POST, or server-side session).

**Conclusion:** Semantically **compatible** with an adapter: flatten + rename + map `requested`; handle `displayed` / `editable` explicitly in that layer or small type extensions.

---

### 2.2 `GET /api/cases/:id/documentIFiles` (file inventory)

**Your shape (conceptual):**

```text
{
  items: [{
    id, documentType, extension, hasThubnail, date, mimeType,
    prefilled, status, title
  }]
}
```

**App shape:** `UploadedFileMeta` inside `DocumentCardSlotData.files`.

| Field | Match? | Notes |
|-------|--------|--------|
| `id` | **Yes** | Maps to `UploadedFileMeta.id`. |
| `documentType` | **Routing key** | Not on `UploadedFileMeta`; belongs to the card. Adapter assigns each item to the correct field’s slot (and prospect, if applicable—**not in your snippet**; may need `prospectId` or similar from backend). |
| `date` | **Yes** | Map to `uploadedAt` (ISO string). |
| `mimeType` | **Yes** | Map to `contentType`. |
| `title` | **Partial** | Can map to `frontOfficeName` or `filename` depending on UX; `filename` often needs an extension—`extension` helps. |
| `extension` | **Extra** | Not on `UploadedFileMeta`; can append to filename or store only in display logic. |
| `hasThubnail` | **Not used** | UI does not render thumbnails today; safe to ignore or future feature. |
| `prefilled` | **Partial** | Could drive read-only / `isDisabled` for that row or inform `clientConfirmationRequested`-style UX if product-defined. |
| `status` | **Partial** | Not modeled on `UploadedFileMeta`; could affect labels or disable remove/upload if you add rules. |
| **Download URL** | **Gap in snippet** | `DocumentCard` links with `file.url`. If the API only returns `id`, you need a **download URL convention** (separate field from backend, or client-built path). |

**Conclusion:** **Mappable** with a dedicated mapper from `items[]` → updates to each `CaseDocumentsEntry`’s `slots[*].files` (or post-merge form data). You must define **prospect association** if files are per person and **how to obtain `url`**.

---

### 2.3 `GET /api/cases/:id/document/comments`

**Your shape (conceptual):**

```text
{
  items: [{
    content, date, documentType,
    id, username, lastname
  }]
}
```

**App shape:** `DocumentCardData` has a single optional string `comment`, not a list of threaded comments with author and timestamp.

| Aspect | Match? |
|--------|--------|
| One active comment per card | **Rough partial** | You could show the latest comment or concatenate for display only—loses history. |
| Full comment history / audit | **No** | Would require extending `DocumentCardData`, a separate Redux slice, or a read-only “activity” UI not tied to the single `comment` field. |

**Conclusion:** **Not structurally matched** for multi-comment / multi-user history. **Matched** only if product accepts a single editable note per document card mapped from one item or a merged string.

---

### 2.4 `GET /api/cases/:id/document/eligiblePersons`

**Your shape (conceptual):**

```text
{
  DOC_GENERAL_TERMS_OF_USE: ["person-1", "person-2"],
  ANOTHER_DOC_TYPE: ["person-uid"]
}
```

**App shape:** `perProspect` layout uses `DocumentCardProspectConfig[]` (`id`, `name`, defaults) or `prospectSource` resolved from case context; slots are keyed by prospect id in `DocumentCardData.prospects`.

| Aspect | Match? | Notes |
|--------|--------|--------|
| Doc type → list of person ids | **Yes, as input to adapter** | Keys are `documentType`; values are prospect ids—same as slot keys / `prospects[].id`. |
| Display names | **Gap** | Your API only lists ids. Names may come from **case context** (`prospectSource`) or another endpoint; the builder can use id as label fallback (already possible via `slots[id].label`). |

**Conclusion:** **Good fit** for building `slots` or `prospects` for `perProspect` cards after merging with a person directory from context.

---

## 3. Conceptual technical steps

These are **implementation-ordered dependencies**, not a sprint plan. Several steps can overlap once the wire contract is stable.

### Phase A — Freeze the wire contract

1. **Confirm real paths and verbs** for each resource (`/documents`, file inventory, comments, `eligiblePersons`). Fix typos in specs early (`documentIFiles`, singular `document` vs plural `documents`).
2. **Decide how case context reaches the server** when using GET (query params, headers, session-only reload) vs POST body (current hook shape).
3. **List authoritative fields** per endpoint: which source wins when rules merge vs documents merge (`globalDescriptor` + `lastRulesObject` in `form-dux` already defines replay order).

### Phase B — Normalization layer (backend response → `CaseDocumentsEntry[]`)

4. **Implement a pure adapter** (e.g. `normalizeGroupedDocumentsResponse`) that:
   - Iterates each category key (`agnostic`, …) and **flattens** rows into one array.
   - Maps `docType` → `documentType` and sets `category` from the parent key.
   - Drops or hides rows with `displayed: false` (or maps them to descriptor `status` / omit from list—product decision).
   - Maps `requested` → `requestedDefault` and/or per-slot `slots[…].requested` (clarify with backend when a doc has multiple slots).
5. **Optional type extensions** on `CaseDocumentsEntry` (or parallel DTO) for `editable`, `displayed`, and raw API fields you want to preserve for debugging or future UI.

### Phase C — Eligible persons and layout

6. **Fetch `eligiblePersons`** (on load and/or with documents refresh).
7. **Merge with person directory** from `CaseContext` (or a dedicated data source) to fill `name` / labels for each prospect id.
8. **Derive layout**:
   - Multiple ids for one `documentType` → `perProspect` with `prospects` (or `slots` keys) aligned to those ids.
   - Single slot → `single` layout; rely on existing `resolveLayout` in `document-card-builder.ts`.

### Phase D — File inventory → seeded `UploadedFileMeta`

9. **Fetch file `items[]`** alongside or after documents metadata.
10. **Define routing rules**: group by `documentType`; if backend adds `prospectId` (or equivalent), route into `slots[prospectId].files`; otherwise single-slot docs use `main` / `document` / first slot conventions already used by `pickMainSlot`.
11. **Map each item → `UploadedFileMeta`**: `date` → `uploadedAt`, `mimeType` → `contentType`, `title` + `extension` → `filename` / `frontOfficeName`.
12. **Resolve `url`**: add `downloadUrl` from API, or a templated client URL (`/api/cases/:id/files/:fileId`) documented and shared with upload/delete.
13. **Merge file lists into** either:
    - `CaseDocumentsEntry.slots[…].files` before `buildDocumentCardFields`, or
    - `formData` after merge (if files must not alter descriptor identity)—product/security choice.

### Phase E — Editable / read-only behavior

14. **Map `editable` and category** (`prefilledOnly`, etc.) to UI:
    - Container-level `isDisabled` vs field-level: today `FieldWrapper` passes one flag; you may need per-field disabled derived from descriptor metadata or a small extension to `DocumentCardProps`.
15. **Map `prefilled` / `status` from file items** to disable remove, hide upload, or show badges (optional; may stay out of MVP).

### Phase F — Comments

16. **If only one note per doc card is enough**: pick one `items[]` row (e.g. latest by `date`) and set `DocumentCardData.comment` during bootstrap or after fetch.
17. **If full history is required**: extend the form model or add a read-only panel (new component + Redux slice or RHF-external state) keyed by `documentType`; do not overload `comment` without a migration story.

### Phase G — Client integration with existing pipeline

18. **Replace or extend** `useDebouncedDocumentsRehydration` / `postCaseDocuments` so the client either GETs or POSTs per real API, then parses JSON through the normalizer.
19. **Orchestrate parallel fetches** if documents, files, eligible persons, and comments are separate: consider one BFF route that returns a bundle, or Promise.all in the hook with a single `applyDocumentsUpdate` payload assembled on the client.
20. **Keep `applyDocumentsRehydrationMerge`** as the single write path into `globalDescriptor` / `formData` so rules replay (`mergeDescriptorWithRules`) stays consistent.

### Phase H — Verification

21. **Contract tests**: fixture JSON from backend → expected `CaseDocumentsEntry[]` and expected `DocumentCardData` seeds.
22. **Regression tests** for `mergeDocumentsIntoDescriptor` / builder when `displayed` filtering or file merge order changes.

### Phase I — Submission and backend parity

23. **Define the submit contract**: whether `DocumentCardData` (per slot: `requested`, `optional`, `files`, `comment`) maps 1:1 to backend DTOs or needs a serializer. Today the engine stores rich file metadata; the API may expect only file ids or version tokens.
24. **Reconcile optimistic UI**: uploads already hit `/api/upload` (or configured URL); ensure final case payload references the same ids the case file inventory API returns.
25. **Handle stale rehydration**: if documents/files refresh while the user is editing, decide whether `mergeDocumentsIntoFormData` overwrites in-flight changes for affected fields or merges surgically (today seeded defaults come from `defaultValue` on built fields—confirm this matches product).

### Phase J — Operational concerns

26. **Loading and errors**: combine documents + files + eligible persons into one user-visible “documents” loading state (demo pages already OR documents pending with rules pending—mirror that pattern).
27. **Auth and CORS**: if calls go to an external API instead of Next route handlers, centralize base URL and credentials; `createError` from `useDebouncedDocumentsRehydration` already carries HTTP metadata for logging.
28. **Optional BFF**: a single Next route that aggregates the four GETs reduces round-trips and hides auth; the client then keeps one fetch in `postCaseDocuments` / `fetchCaseDocumentsBundle`.

---

## 4. Summary table (elaborated)

### 4.1 Endpoints × engine (single view)

| API resource (as specified) | Fit (summary) | What already aligns in-repo | Gaps / product–backend decisions | Main failure modes if unspecified | Typical code touchpoints |
|-----------------------------|---------------|-----------------------------|----------------------------------|-----------------------------------|---------------------------|
| **Grouped `documents`** (four category arrays) | **High** | Same four keys as `DocumentCategory`; cards are keyed by `documentType` like your `docType` | Flatten + rename; `displayed` / `editable`; GET vs POST + how context is sent | Wrong cards shown after discriminant change; duplicate types across categories; hidden docs still in formData | Normalizer util; `use-debounced-documents-rehydration.ts`; `applyDocumentsUpdate` in `form-dux.ts`; optional proxy `route.ts` |
| **Document files** (`items[]` inventory) | **Medium–high** | `UploadedFileMeta` + `slots[*].files` seeding in `document-card-builder` | Per-prospect file routing; download **URL**; conflicting list vs upload response shape | Broken links; files attached to wrong person; double-submit or orphan files | Mapper merging into `CaseDocumentsEntry` or post-merge `formData`; `UploadedFileMeta` in `form-descriptor.ts` |
| **Document comments** (`items[]`, authors) | **Low** (history) / **Medium** (one note) | `DocumentCardData.comment` string | Full thread vs one editable note; who can edit; ordering | Lost audit trail; user thinks comment saved but only one field exists | `document-card.tsx`; optional new module or Redux slice |
| **Eligible persons** (map doc type → ids[]) | **High** (as adapter input) | `perProspect` layout; `prospects` / slot ids match person ids | Labels: need case context or lookup | Unlabeled rows; wrong row count vs backend | Same normalizer as documents or a join step before `buildDocumentCardFields` |

**How to read “Fit”:** **High** means mostly mechanical mapping; **Medium** means a few explicit rules (URL, routing, permissions); **Low** means the current UI model does not represent the feature without new surfaces or types.

### 4.2 Row-by-row elaboration

- **Grouped documents**  
  The engine never sees the grouped object: it only needs a **stable ordered list** of `CaseDocumentsEntry` after your adapter runs. The meaningful match is **category == bucket** and **one field per `documentType`**. The risky part is **behavioral**: `displayed` and `editable` are not modeled yet, so they must become **filter rules** and **disabled logic** before `DocumentCard` renders, or you will show cards the backend considers hidden or allow edits the backend rejects.

- **File inventory**  
  Structural match is good for **metadata** (id, dates, mime, title). The **graph** match (which file belongs to which slot) is **not** in your sample payload: if the backend adds `prospectId` / `personUid`, mapping is straightforward; if not, you need a **convention** (e.g. only single-slot docs, or infer from eligible list order). **URLs** are mandatory for the current `DocumentCard` link UX.

- **Comments**  
  Match is **intentional scope**, not automatic structure. Either you **shrink** the API story to “one working note” mapped into `comment`, or you **grow** the frontend with a list UI and possibly **exclude** extras from the payload sent on main form submit.

- **Eligible persons**  
  This endpoint is the **bridge** between a flat “list of doc types” from `documents` and the **perProspect** card the builder can already emit. Without display names, UX still works with raw ids as labels until case context supplies better titles.

### 4.3 Readiness by concern

| Concern | Ready today? | What's left |
|---------|----------------|-------------|
| Dynamic document cards from backend list | **Yes**, given `CaseDocumentsEntry[]` | Wire real API + normalizer |
| Category-driven UX (upload vs prefilled) | **Partially** — `canUpload` uses category; `prefilledOnly` may need stricter UI rules | Product rules + optional `isDisabled` per card |
| Seeded files on load | **Yes**, via `slots[*].files` | File API + URL policy |
| Per-prospect documents | **Yes**, descriptor + `DocumentCard` | `eligiblePersons` + names join |
| Comments as conversation history | **No** | New UX/model or scope to one string |
| Submit payload matches backend expectations | **TBD** | Serializer + contract tests against real DTO |

---

## 5. Closing verdict

**The architecture in this repo can match these APIs** once you add a **normalization and enrichment pipeline** (grouped documents → `CaseDocumentsEntry[]`, plus optional joins for files, eligible persons, and comments), **align HTTP verbs and URLs**, and resolve **download URLs**, **per-prospect file routing**, and **comment depth** with the backend team.
