# Sub-Form Support Epic

**Status**: 📋 PLANNED  
**Goal**: Enable scalable form composition by allowing large form descriptors to be split into reusable sub-forms resolved at runtime when descriptors are loaded, improving maintainability. Initial implementation uses hardcoded descriptors; database storage will be added in a future phase.

## Overview

Large form descriptors become difficult to maintain when they contain many blocks and fields, leading to monolithic files that are hard to navigate and update. Sub-form support allows form authors to split descriptors into logical, reusable components that are resolved dynamically at runtime when the global descriptor is loaded. 

**Architecture**: Sub-form resolution happens entirely on the backend. The API endpoint `/api/form/global-descriptor` receives a descriptor with `subFormRef` properties, resolves all referenced sub-forms server-side, merges them into a fully flattened `GlobalFormDescriptor`, and returns it to the frontend. The frontend remains completely agnostic to sub-form complexity - it just receives and uses a fully merged descriptor as if sub-forms never existed.

**Benefits**:
- Frontend simplicity: No sub-form resolution logic in client code
- Better performance: Server-side caching and efficient resolution
- Single source of truth: Backend handles all complexity
- Easier migration: When moving to database storage, only backend changes

The initial implementation uses hardcoded descriptors in API routes; a future phase will migrate to database storage for dynamic form updates without code deployments.

---

## Sub-Form Type Definitions

Add TypeScript types for sub-form descriptors and references in the form descriptor system.

**Requirements**:
- Given sub-form needs, should define SubFormDescriptor interface with blocks and optional submission config (submission not required since sub-forms are reusable blocks)
- Given block composition needs, should add subFormRef property to BlockDescriptor to reference a sub-form by ID
- Given sub-form reuse needs, should add subFormInstanceId property to BlockDescriptor to distinguish multiple uses of the same sub-form template
- Given database storage needs, should add id and title properties to both GlobalFormDescriptor and SubFormDescriptor
- Given serialization needs, should ensure all types remain JSON-serializable (no functions, RegExp objects, or circular references)

---

## Sub-Form Resolver Utility (Backend Only)

Create server-side utility function to resolve and merge sub-forms into global descriptor. This keeps the frontend completely agnostic to sub-form complexity.

**Requirements**:
- Given a GlobalFormDescriptor, should traverse blocks to find all subFormRef values and fetch referenced sub-forms from hardcoded sources (API endpoints or in-memory map)
- Given sub-form blocks, should prefix block IDs with sub-form ID and instance ID to prevent collisions (format: `${subFormId}_${instanceId}_${blockId}` or `${subFormId}_${blockId}` if no instance ID)
- Given sub-form fields, should prefix field IDs with instance ID when subFormInstanceId is provided (format: `${instanceId}.${fieldId}` or `${instanceId}_${fieldId}`)
- Given nested sub-forms, should recursively resolve sub-forms referenced within other sub-forms
- Given resolution errors, should throw descriptive errors for missing sub-forms or circular dependencies
- Given serialization needs, should return fully merged GlobalFormDescriptor that is JSON-serializable
- Given performance needs, should cache resolved descriptors server-side to avoid redundant resolution

---

## Sub-Form API Endpoints (Backend Resolution)

Add API endpoints to serve form descriptors with server-side sub-form resolution. Frontend receives fully merged descriptors and remains agnostic to sub-form complexity.

**Requirements**:
- Given sub-form requests, should create GET /api/form/sub-form/:id endpoint returning hardcoded SubFormDescriptor JSON (for internal backend use only)
- Given global descriptor requests, should update GET /api/form/global-descriptor to resolve sub-forms server-side before returning fully merged GlobalFormDescriptor
- Given resolution needs, should use sub-form resolver utility to merge sub-forms into global descriptor at runtime on the server
- Given frontend needs, should return fully resolved GlobalFormDescriptor with no subFormRef properties visible (all sub-forms already merged)
- Given error cases, should return appropriate HTTP errors for missing descriptors or resolution failures
- Given caching needs, should implement server-side caching for resolved descriptors to improve performance
- Given future database needs, should structure code to allow easy migration to database-backed storage later

---

## Frontend Integration (No Changes Needed)

Frontend remains completely agnostic to sub-form complexity. No changes needed to thunks or hooks.

**Requirements**:
- Given descriptor loading, should fetch global descriptor from API endpoint (backend handles all sub-form resolution)
- Given resolved descriptor, should store fully merged descriptor in Redux state (same as before)
- Given resolution errors, should handle HTTP errors from backend appropriately (no client-side resolution logic)
- Given caching needs, should leverage TanStack Query cache for resolved descriptors (works as-is since backend returns fully merged descriptor)
- Given frontend simplicity, should never see subFormRef properties or sub-form resolution logic (all handled server-side)

## Sub-Form Resolution Tests

Add comprehensive tests for sub-form resolution logic and error handling.

**Requirements**:
- Given sub-form resolver, should test successful merging of single sub-form from hardcoded sources
- Given nested sub-forms, should test recursive resolution of sub-forms within sub-forms
- Given ID collisions, should test block ID prefixing prevents conflicts
- Given circular dependencies, should test detection and error reporting
- Given missing sub-forms, should test error handling for unresolved references
- Given serialization, should verify resolved descriptors are JSON-serializable
