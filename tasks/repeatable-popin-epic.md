# Repeatable Popin Epic

**Status**: ✅ IN PROGRESS (implementation complete, pending validation)  
**Goal**: Repeatable blocks that display a clickable summary per element and open a popin to add/edit each element, instead of rendering all fields inline.

## Overview

KYC forms often collect collections of related data (addresses, contacts, beneficiaries). When these collections grow, inline rendering of all fields for every instance becomes overwhelming. Repeatable popin blocks solve this by showing a compact, clickable summary for each element; clicking opens a popin dialog to add or edit that element. The main form stays focused while still allowing full edit capability. This extends the existing repeatable fields and popin infrastructure.

---

## Repeatable Popin Block Type Extension

Extend BlockDescriptor to support repeatable blocks that edit each element via popin instead of inline.

**Requirements**:
- Given repeatable popin needs, should add optional `repeatablePopin?: boolean` to BlockDescriptor (when true with `repeatable: true`, use popin edit mode)
- Given summary display, should add optional `repeatableSummaryTemplate?: string` Handlebars template for summary text per instance (e.g. `"{{emergencyName}} ({{emergencyRelationship}}){{#unless emergencyName}}New contact{{/unless}}"`)
- Given no template, should fall back to generic summary (e.g. "Item {index + 1}" or first non-empty field value)
- Given serialization needs, should ensure new properties remain JSON-serializable

---

## Popin Manager Indexed Edit Support

Extend PopinManager to open popins bound to a specific repeatable group index for edit-in-place semantics.

**Requirements**:
- Given edit flow, should support `openPopin(blockId: string, options?: { groupId?: string; index?: number })` to open popin for a specific instance
- Given index provided, should seed popin form with `formData[groupId][index]` when opening (whether data is user-added or pre-populated from backend)
- Given pre-populated data, should correctly seed popin with backend-loaded instance values (from repeatableDefaultSource, casePrefill, popinLoad, or initial defaults)
- Given Validate in edit mode, should merge popin form values back into main form at `formData[groupId][index]`
- Given Add flow, should support opening popin for newly appended instance (index = array.length - 1 after append)
- Given cancel/close, should discard popin changes when in edit mode (no merge)

---

## Repeatable Popin Summary Component

Create UI that renders clickable summary rows for each repeatable instance, with Add button after the list.

**Requirements**:
- Given repeatable popin block, should render one clickable summary element per instance before the Add button
- Given pre-populated data from backend (repeatableDefaultSource, casePrefill, popinLoad), should display summaries for all existing elements using actual instance values
- Given summary click, should call `openPopin(blockId, { groupId, index })` to open popin pre-filled with that instance's data for editing
- Given summary template, should evaluate `repeatableSummaryTemplate` with instance-specific formContext (current instance values, @index)
- Given empty/new instance, should display sensible fallback (e.g. "New {blockTitle}" or "Item N")
- Given Add button click, should append new instance to array and display its summary before the Add button; summary is clickable to open popin
- Given Add UX preference, may optionally auto-open popin for newly appended instance (configurable or default)
- Given Remove, should support remove button per summary row (respecting minInstances) or within popin
- Given visual design, should style summaries as clear, tappable rows (card/chip) with edit affordance (e.g. pencil icon)

---

## Block Rendering Integration

Integrate repeatable popin mode into Block and RepeatableFieldGroup rendering pipeline.

**Requirements**:
- Given block with `repeatable: true` and `repeatablePopin: true`, should render RepeatablePopinSummary instead of inline RepeatableFieldGroup
- Given popin block with repeatable group, should support repeatablePopin for editing instances within the popin (nested case)
- Given block without repeatablePopin, should retain current inline RepeatableFieldGroup behavior
- Given popin content, should resolve block from mergedDescriptor for popin rendering (reuse existing popin block resolution)

---

## Usage Example

See [repeatable-popin-usage-example.md](../docs/repeatable-popin-usage-example.md) for full usage and descriptor configuration.

### Quick descriptor example

```typescript
{
  id: 'emergency-contacts-block',
  title: 'Emergency Contacts',
  description: 'Add emergency contacts. Click a contact to edit.',
  repeatable: true,
  repeatablePopin: true,
  repeatableSummaryTemplate: '{{#if emergencyName}}{{emergencyName}} ({{emergencyRelationship}}){{else}}New contact{{/if}}',
  minInstances: 0,
  maxInstances: 5,
  repeatableBlockRef: 'emergency-contact-block',
}
```

### Rendered UI behavior

1. **Empty state**: "No emergency contacts yet." + [Add Emergency Contact] button  
2. **After Add**: New instance appended; summary row appears (e.g. "New contact"); user clicks to open popin and edit  
3. **With data**: For each instance, clickable summary row (e.g. "Jane Doe (spouse)") — click opens popin  
4. **Add button**: At the end; adds new instance and displays its summary before the Add button
