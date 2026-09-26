# Document Upload Popin Epic

**Status**: 📋 PLANNED  
**Goal**: Host a multi-file upload dialog outside the main form tree via `DocumentPopinProvider`, and centralize upload/metadata flows for document cards. *(The engine no longer uses `formKey` remounts — see [thin-center-form-engine.md](../docs/thin-center-form-engine.md). The provider still keeps upload session stable across descriptor updates.)*

## Overview

Rules rehydration and discriminant-driven documents refresh remount the main RHF tree; inline upload editing inside `DocumentCard` alone would lose in-flight uploads and staged metadata. This epic adds a provider mounted above `FormInner`, thin HTTP helpers for document endpoints, a hook for row-level card logic (including guards when files exist), and a Shadcn dialog that commits back into the existing `document` field slice on validate—matching the Document Card Block plan’s popin workflow.

### Popin UI reference (example)

Target rendering inside **`DocumentCardUploadPopin`** (Shadcn `Dialog`): one modal focused on the active **`fieldId` + `slotId`** (root vs prospect row). Copy uses placeholder labels; real strings come from `FieldDescriptor` / slot label.

```text
┌─────────────────────────────────────────────────────────────────┐
│  Upload documents — Proof of address                     [×]    │
│  Slot: Document · proof_of_address                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ bill-jan.pdf                    [Open ↗]  [Remove]       │   │
│  │ ☐ Request client confirmation   Front-office name: [___] │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ scan-back.png                   [Open ↗]  [Remove]       │   │
│  │ ☐ Request client confirmation   Front-office name: [___] │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [Choose files…]   (.pdf, .png · max __ MB — from descriptor)   │
│                                                                 │
│                              [ Cancel ]  [ Validate ]           │
└─────────────────────────────────────────────────────────────────┘
```

**Regions (implementation-facing)**

| Region | Purpose |
|--------|--------|
| **Header** | Title + subtitle (field label, `documentType`, slot label); close affordance respects read-only when descriptor forbids edits |
| **File rows** | One bordered row per `UploadedFileMeta` in session list; optional metadata rows gated by `allowClientConfirmation` / `allowFrontOfficeName` |
| **Picker** | `Input type="file"` multiple where uploads allowed; inline validation errors under picker |
| **Footer** | **Cancel** (drops pending session uploads via DELETE, closes); **Validate** (PATCH dirty metadata if needed, then `setValue` for slot files, closes). Validate disabled until at least one file in list when product requires it |

Use **`prefilledOnly`** / upload-disabled config to hide the picker and **Remove**, leaving view-only links where the backend requires it.

---

## Document popin provider shell

Add a `DocumentPopinProvider` (or equivalent) wrapping `FormPresentation` / siblings of `FormInner`, exposing `openDocumentPopin({ fieldId, slotId })` and session state that survives RHF remounts.

**Requirements**:
- Given `formKey` changes after opening the document popin, should preserve popin local state until validate or cancel completes
- Given no open popin, should not register duplicate listeners or leak timers

---

## Document card HTTP helpers

Add `src/utils/document-card-api.ts` with small `fetch` wrappers for upload, delete, and optional metadata PATCH using descriptor endpoint URLs.

**Requirements**:
- Given a multipart upload request, should POST using the card’s configured upload URL when present
- Given delete with `{id}` templated URL, should substitute the file reference safely before calling DELETE

---

## useDocumentCard hook

Add `src/hooks/use-document-card.ts` encapsulating per-slot counters, requested/optional setters, prospect reconciliation, and the rule that requested cannot be cleared while a slot still has files.

**Requirements**:
- Given a slot with one or more files, should block turning off requested for that slot until files are removed
- Given perProspect layout, should reconcile prospect ids when config changes without dropping data for ids still present

---

## DocumentCardUploadPopin UI and wiring

Implement `src/components/document-card-upload-popin.tsx` (Shadcn Dialog) with multi-file pick, immediate upload, per-file remove, optional metadata fields per descriptor flags, Validate committing into `form.setValue(fieldId, …)`, and Cancel deleting only session-pending uploads.

**Requirements**:
- Given Validate with pending uploads only, should persist file lists into the matching document field path for the active slot
- Given Cancel after uploads in the session, should DELETE backend ids recorded as pending for this session and discard unstaged metadata edits
- Given main form remount during an open session, should keep dialog open with consistent local file list state
