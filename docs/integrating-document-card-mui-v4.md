# Integrating the Document Card feature with Material UI v4

This guide explains how to bring the **document card** field (`FieldDescriptor.type === 'document'`) from this project into **another app** that already uses the same **descriptor-driven form engine**, **react-hook-form**, and **Zod**, but renders fields with **Material UI v4** (`@material-ui/core`).

The **business logic, data shape, and upload protocol** are UI-agnostic. Only the inline card, the upload dialog, and small presentation details need a MUI implementation.

---

## 1. What you are integrating

- **Form value**: `DocumentCardData` at `field.id` — see `DocumentCardData`, `DocumentCardSlotData`, and `DocumentCardConfig` in [`src/types/form-descriptor.ts`](../src/types/form-descriptor.ts).
- **Layouts**:
  - `layout: 'single'` → one logical slot with id `'document'` (root-level `requested`, `optional`, `files`, optional `comment`).
  - `layout: 'perProspect'` → one slot per prospect; file state lives under `value.prospects[prospectId]`.
- **Upload UX**: Inline checkboxes and file list on the card; **binary uploads happen in a modal** so in-flight work survives `FormInner` **key**-driven RHF remounts (see [`src/components/document-popin-provider.tsx`](../src/components/document-popin-provider.tsx)).
- **Validation**: Zod treats document fields as structured objects (see `convertToZodSchema` with `fieldType: 'document'` in [`src/utils/validation-rule-adapter.ts`](../src/utils/validation-rule-adapter.ts)). Custom rules (e.g. “files required when requested”) are often enforced via **descriptor `custom` rules** and/or `form.setError` with `type: 'document'` on the card ([`src/components/document-card.tsx`](../src/components/document-card.tsx)).

---

## 2. Dependencies (target project)

Install or align versions with your existing form stack; the document feature assumes:

- `react-hook-form` (with `Controller` where you bind the card value)
- `zod` and `@hookform/resolvers` (or your existing zodResolver wiring)
- `@material-ui/core` v4 (and `@material-ui/icons` if you want icons)
- Optional: duplicate or port [`src/utils/accepted-file-formats.ts`](../src/utils/accepted-file-formats.ts) for `accept` strings and client-side format checks.

You do **not** need Tailwind or Radix/Shadcn in the host app if you rewrite the two UI surfaces in MUI.

---

## 3. Copy or share these modules (logic-first)

Treat these as **portable** (adjust import paths to your package layout):

| Area | Files in this repo |
|------|---------------------|
| Slot model & normalization | [`src/utils/document-card-slots.ts`](../src/utils/document-card-slots.ts) |
| Upload / delete / metadata PATCH | [`src/utils/document-card-api.ts`](../src/utils/document-card-api.ts) |
| Resolve field from merged descriptor | [`src/utils/document-field-resolve.ts`](../src/utils/document-field-resolve.ts) |
| accepted formats helper | [`src/utils/accepted-file-formats.ts`](../src/utils/accepted-file-formats.ts) |
| Prospect reconciliation (pure) | [`src/hooks/use-document-card.ts`](../src/hooks/use-document-card.ts) — *despite the path, exports are pure functions* |
| Types | Relevant sections of [`src/types/form-descriptor.ts`](../src/types/form-descriptor.ts) (`UploadedFileMeta`, `DocumentCard*`, `FieldDescriptor.document`) |
| Optional: building descriptor fields from API | [`src/utils/document-card-builder.ts`](../src/utils/document-card-builder.ts) |

**Zod + defaults integration** (if your engine matches this one): [`src/utils/form-descriptor-integration.ts`](../src/utils/form-descriptor-integration.ts) already knows `document` for defaults and `isSubmitSkippedFieldType` (document/file are often excluded from submit payload shaping — verify your own submit pipeline).

---

## 4. Backend contract

Implement (or proxy) endpoints consistent with [`src/utils/document-card-api.ts`](../src/utils/document-card-api.ts):

- **POST** multipart upload (`FormData`: `file`, `fieldId`, `docType`) to `config.file.uploadUrl` or your default (this repo defaults to `/api/upload`).
- **JSON response** parsed into `UploadedFileMeta` (`id`, `url` / `fileUrl` / `path`, `filename`, optional metadata fields).
- **DELETE** when `config.file.deleteUrl` is set; `{id}` in the template is replaced with `encodeURIComponent(fileReference)`.
- **PATCH** JSON when `config.file.metadataPatchUrl` is set for optional `clientConfirmationRequested` / `frontOfficeName` deltas.

Client-side guards: `getAcceptAttribute`, `validateSelectedFiles` from `document-card-slots` + `accepted-file-formats`.

---

## 5. React wiring (same as this project)

This order is important:

1. **`DocumentPopinProvider`** wraps the subtree that renders document fields. Pass **`mergedDescriptor`** (or whatever holds the current merged global descriptor) so the modal can resolve `field.document` by id — see [`DocumentPopinProvider` props](../src/components/document-popin-provider.tsx).
2. **`DocumentMainFormBinder`** (or equivalent) runs **inside** the keyed `FormInner` and calls `assignMainForm(form)` so the modal always calls `setValue` on the **live** `useForm` instance after remount — see [`form-container.tsx`](../src/components/form-container.tsx) pattern.
3. In your field renderer (equivalent to [`src/components/field-wrapper.tsx`](../src/components/field-wrapper.tsx)), route `case 'document':` to your MUI document card.

Without steps 1–2, uploads will break or target a stale form when the parent changes `key` on the form tree.

---

## 6. Rewriting the UI in Material UI v4

Replace Shadcn/Radix usage in:

- [`src/components/document-card.tsx`](../src/components/document-card.tsx) — inline card
- [`src/components/document-card-upload-popin.tsx`](../src/components/document-card-upload-popin.tsx) — modal workflow

**Suggested MUI v4 mapping** (no `sx` in v4; use `makeStyles` / `withStyles`, `className`, or `style`):

| Current (this repo) | MUI v4 |
|---------------------|--------|
| Outer card container | `Paper` with `variant="outlined"` and padding |
| Title / description | `Typography` (`variant="subtitle1"`, `variant="body2"`, `color="textSecondary"`) |
| “Required” asterisk | `Typography` with `color="error"` or `*` in title |
| Native checkboxes | `Checkbox` + `FormControlLabel` |
| Native file list links | `Link` with `target="_blank"` / `Typography` |
| Primary / secondary buttons | `Button` (`variant="contained"`, `variant="outlined"`, `size="small"`) |
| Comment field | `TextField` `multiline` `minRows={3}` |
| Error text | `FormHelperText` `error` or `Typography` `color="error"` |
| Modal | `Dialog`, `DialogTitle`, `DialogContent`, `DialogActions` |
| Text inputs in modal | `TextField` |
| Hidden file input | `input type="file"` styled or `Button` triggering `input.click()` |

**Behavior to preserve** (not optional):

- Bind the card with **`Controller`** and use `normalizeDocumentCardData` before every read/update so root vs `perProspect` shapes stay consistent.
- **Requested checkbox**: use `applyRequestedToSlot`; on blocked clear (`null`), call `form.setError` / local error like the reference implementation.
- **`perProspect`**: `useEffect` keyed on `prospectConfigIdsKey` calling `reconcileDocumentProspectsForConfig` + `setValue` when the prospect list changes.
- **Open modal**: `useDocumentPopin().openDocumentPopin({ fieldId, slotId, requireFileForValidate })` where `slotId` is `' document'` for single layout or the prospect id for `perProspect`.
- **Modal Validate**: same sequence as reference — metadata PATCHs, DELETE removed baseline files when configured, then `setValue(..., updateSlotData(..., { files: mergedSnap }), { shouldDirty: true, shouldTouch: true, shouldValidate: true })`.
- **Modal dismiss / Cancel**: delete session uploads best-effort (`cancelSessionDeletesAndClose`) so orphans are not left on the server.

---

## 7. Zod and submit pipeline

- Ensure your schema builder passes **`fieldType: 'document'`** into `convertToZodSchema` (or equivalent) so the base shape includes `requested`, optional `optional`, `comment`, `files`, and `.passthrough()` for `prospects` — see [`validation-rule-adapter.ts`](../src/utils/validation-rule-adapter.ts).
- If you use `isSubmitSkippedFieldType` from [`form-descriptor-integration.ts`](../src/utils/form-descriptor-integration.ts), document values may be **omitted from the submit body** by design; confirm whether your product expects file metadata only via the upload API or also in the case payload.

---

## 8. Verification checklist

- [ ] `DocumentPopinProvider` wraps fields; **`mergedDescriptor` updates** when rules rehydrate (modal sees new `document` config).
- [ ] **`DocumentMainFormBinder`** runs inside the same component that creates `useForm`.
- [ ] Changing parent **`key`** on the form does **not** lose modal session state (working file list still there).
- [ ] **Single** layout: slot id `'document'` opens and patches root `files`.
- [ ] **Per-prospect** layout: rows match `config.prospects` / `prospectSource`; adding/removing prospect ids reconciles `value.prospects` without dropping unrelated fields.
- [ ] **Turn off “Requested”** while files exist shows error and does not mutate.
- [ ] Upload respects **`accept`**, **`maxSizeBytes`**, and **`multiple`**.
- [ ] **Validate** with `requireFileForValidate` (required fields) stays disabled until at least one file is present.
- [ ] **DELETE** / **PATCH** URLs behave when `{id}` appears in templates.

---

## 9. Reference entry points in this repository

- Form shell + provider: [`src/components/form-container.tsx`](../src/components/form-container.tsx)
- Demo pages: [`src/app/demo/page.tsx`](../src/app/demo/page.tsx)
- Example descriptor snippet: global descriptor demo route / blocks with `type: 'document'` (search the codebase for `type: 'document'`).

After porting, keep **one** source of truth for slot normalization (`document-card-slots`) so the card and modal never disagree on how `perProspect` paths are read and written.
