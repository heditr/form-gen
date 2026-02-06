# Popin Block Component Epic

**Status**: 📋 PLANNED  
**Goal**: Enable blocks to be opened in modal overlays instead of rendering inline, improving form UX by reducing clutter and allowing users to focus on specific sections when needed.

## Overview

Large forms can become overwhelming when all blocks are displayed inline, especially for optional or supplementary information. Popin blocks allow form authors to designate certain blocks to open in modal dialogs, triggered by buttons or other UI elements. This improves the user experience by keeping the main form focused while still providing access to additional fields or information when needed.

**Architecture**: Blocks can be marked as popin-only via a `popin: true` property in BlockDescriptor. Popin blocks are **standalone** - they never render inline and can only be opened via button field triggers. Button fields reference blocks by ID using `popinBlockId` to open them in Shadcn Dialog modals. All popins share the same behavior: they open in a dialog, share the same form instance, and can be closed via standard dialog actions. Button fields support single buttons and menu/dropdown buttons where different options trigger different popins. Form state is shared between the main form and popin blocks, ensuring seamless data flow and validation.

**Benefits**:
- Reduced visual clutter: Optional blocks don't take up space until needed
- Better focus: Users can concentrate on the main form flow
- Flexible UX: Form authors can choose which blocks should be popins
- Consistent form state: Popin blocks share the same form instance and validation

---

## Shadcn Dialog Component Integration

Add Shadcn UI Dialog component to the project's UI component library.

**Requirements**:
- Given Shadcn UI setup, should install dialog component using Shadcn CLI or manual installation
- Given component structure, should add dialog.tsx to src/components/ui directory following Shadcn patterns
- Given accessibility needs, should ensure dialog component supports keyboard navigation and focus management
- Given styling needs, should match existing Shadcn UI component styles and theme

---

## Popin Block Type Definition

Extend BlockDescriptor type to mark blocks as popin-only (standalone, never rendered inline), support data loading on open, and submit URL endpoint on validate.

**Requirements**:
- Given popin needs, should add optional `popin: boolean` property to BlockDescriptor interface
- Given popin blocks, should mark blocks with `popin: true` to indicate they are standalone popin blocks
- Given data loading needs, should add optional `popinLoad` property with URL and auth configuration (url, dataSourceId, auth) - response is object, not array
- Given submit validation needs, should add optional `popinSubmit` property with URL endpoint configuration (url, method, payloadTemplate, auth)
- Given popin load, should load object data when popin opens and merge directly into formContext (response is object like CaseContext shape, not array of items)
- Given serialization needs, should ensure popin, popinLoad, and popinSubmit properties remain JSON-serializable
- Given form rendering, should skip blocks with `popin: true` during normal block rendering (they only appear via button triggers)

---

## Button Field Type with Popin Support

Add button field type that can trigger popin blocks by reference, supporting single buttons and menu/dropdown buttons.

**Requirements**:
- Given button field needs, should add 'button' to FieldType union type
- Given button configuration, should add optional `button` property to FieldDescriptor with variant ('single' | 'menu' | 'link') and popin reference
- Given single button variant, should support button.popinBlockId to reference a block by ID
- Given menu button variant, should support button.items array with each item having label and popinBlockId
- Given menu items, should allow items to have optional status templates for conditional visibility
- Given button rendering, should render Shadcn Button component for single variant and DropdownMenu for menu variant
- Given button click, should trigger popin opening via popin manager (see Block Reference Resolution task)

---

## Block Reference Resolution

Create utility to resolve blocks by ID from mergedDescriptor for popin triggers.

**Requirements**:
- Given block ID reference, should lookup block in mergedDescriptor.blocks array by ID
- Given block not found, should log error and return null (popin won't open)
- Given block found, should return BlockDescriptor with evaluated status templates
- Given block visibility, should respect block's status.hidden template before allowing popin open
- Given block disabled state, should respect block's status.disabled template (can still open but fields disabled)
- Given performance needs, should cache block lookup map for O(1) access

---

## Popin Manager Component

Create PopinManager component to coordinate opening/closing popins from anywhere in the form. All popins share the same behavior.

**Requirements**:
- Given popin management needs, should create PopinManager component that maintains open popin state
- Given block reference, should provide openPopin(blockId: string) function to open popin by block ID
- Given popin state, should track currently open popin block ID and dialog open state
- Given multiple triggers, should ensure only one popin open at a time (close previous when opening new)
- Given form context, should provide mergedDescriptor and formContext to PopinManager via context
- Given component tree, should wrap form in PopinManagerProvider to make openPopin available to all fields
- Given dialog rendering, should render Dialog component with currently open block's content
- Given popin behavior, should display block.title in dialog header for all popins
- Given popin behavior, should render Cancel and Validate buttons in dialog footer
- Given cancel button, should close popin immediately without side effects (discards any changes in popin fields)
- Given validate button, should call popinSubmit endpoint if configured, or close popin if no popinSubmit config
- Given popin behavior, should support closing via close button (X), escape key, and backdrop click (acts as cancel)
- Given popin behavior, should pass same form instance and formContext to Block component inside dialog for all popins
- Given accessibility needs, should ensure all popins have proper ARIA labels, focus management, and keyboard navigation
- Given popin load config, should evaluate popinLoad.url template with formContext when popin opens
- Given popin load config, should fetch data from popinLoad.url using dataSourceId or auth configuration
- Given popin load config, should expect response to be an object (like CaseContext shape) not an array
- Given popin load config, should merge response object directly into formContext (no transformation needed)
- Given popin load config, should cache loaded data to prevent duplicate requests
- Given popin load errors, should handle load errors gracefully without breaking popin functionality (log error, continue)
- Given validate button click, should evaluate popinSubmit.url template with formContext
- Given validate button click, should call popinSubmit.url endpoint with method (POST/PUT/PATCH) and optional payloadTemplate-transformed form data
- Given validate button click, should use popinSubmit.auth configuration for authentication (bearer/apikey/basic)
- Given validate success, should close popin after successful submit endpoint call (2xx status) and keep form field changes
- Given validate error, should prevent popin from closing if submit endpoint returns error (4xx/5xx status)
- Given validate error, should display error message to user when submit endpoint fails
- Given validate blocking, should keep dialog open and show error state when submit endpoint fails
- Given validate without config, should close popin immediately when validate button clicked (no submit endpoint)
- Given validate loading state, should show loading indicator on validate button while submit endpoint is being called
- Given cancel button click, should close popin immediately without calling any endpoint and discard form field changes in popin
- Given cancel behavior, should not persist any field values entered in popin when cancel is clicked
- Given escape key or backdrop click, should act as cancel (close without side effects, discard changes)

---


## Button Field Component Integration

Create ButtonField component and integrate with popin system.

**Requirements**:
- Given button field type, should create ButtonField component in src/components/button-field.tsx
- Given single button variant, should render button that calls openPopin(button.popinBlockId) on click
- Given menu button variant, should render dropdown menu with items that call openPopin(item.popinBlockId) on selection
- Given menu item visibility, should respect item.status.hidden template to conditionally show/hide menu items
- Given field wrapper integration, should add 'button' case to FieldWrapper switch statement
- Given form integration, should use PopinManager context to access openPopin function

---

## PopinManager Tests

Add comprehensive tests for PopinManager component following TDD process.

**Requirements**:
- Given openPopin call, should open dialog with referenced block's content
- Given block not found, should handle error gracefully without opening popin
- Given multiple openPopin calls, should close previous popin when opening new one
- Given cancel button, should close dialog immediately without side effects
- Given validate button, should call popinSubmit endpoint if configured
- Given validate success, should close dialog after successful submit
- Given validate error, should keep dialog open and show error
- Given escape key, should act as cancel (close without side effects)
- Given backdrop click, should act as cancel (close without side effects)
- Given close button (X), should act as cancel (close without side effects)
- Given dialog open, should render Block component inside dialog with correct props
- Given form state changes, should sync form data between main form and popin block
- Given validation errors, should display errors in popin block fields
- Given block visibility, should respect block's status.hidden template before opening
- Given block disabled state, should respect block's status.disabled template (fields disabled in popin)
- Given popinLoad config, should load object data from popinLoad.url when popin opens
- Given popinLoad config, should merge response object directly into formContext (like CaseContext shape)
- Given popinLoad config, should cache loaded data to prevent duplicate requests
- Given popinLoad response, should expect object shape (not array) and merge properties into formContext
- Given popinLoad errors, should handle load errors gracefully without breaking popin (log error, continue)
- Given popinLoad with dataSourceId, should use backend proxy endpoint for secure authentication
- Given popinLoad with auth, should use direct API call with provided auth credentials
- Given popinSubmit config, should call submit endpoint when validate button clicked
- Given popinSubmit config, should prevent popin from closing if submit endpoint returns error
- Given popinSubmit config, should allow popin to close if submit endpoint succeeds
- Given popinSubmit errors, should display error message to user and keep dialog open
- Given popinSubmit loading, should show loading state on validate button while submit endpoint is being called
- Given popinSubmit without config, should close popin immediately when validate button clicked
- Given cancel button, should close popin immediately without calling any endpoint
- Given cancel behavior, should discard form field changes in popin when cancel clicked

---

## Button Field and Popin Integration Tests

Add comprehensive tests for button field triggering popins.

**Requirements**:
- Given button field with single variant, should render button that opens popin on click
- Given button field with menu variant, should render dropdown menu with items
- Given menu item click, should open corresponding popin block
- Given menu item with hidden status, should not show item in menu
- Given block not found, should handle error gracefully without opening popin
- Given multiple button triggers, should close previous popin when opening new one
- Given form state, should sync form data between button-triggered popins and main form
