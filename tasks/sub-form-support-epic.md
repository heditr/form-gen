# Sub-Form Support Epic

**Status**: 📋 PLANNED  
**Goal**: Enable scalable form composition by allowing large form descriptors to be split into reusable sub-forms resolved at runtime when descriptors are loaded, improving maintainability. Initial implementation uses hardcoded descriptors; database storage will be added in a future phase.

## Overview

Large form descriptors become difficult to maintain when they contain many blocks and fields, leading to monolithic files that are hard to navigate and update. Sub-form support allows form authors to split descriptors into logical, reusable components that are resolved dynamically at runtime when the global descriptor is loaded. This enables better organization and code reuse while maintaining full JSON serialization compatibility. The initial implementation uses hardcoded descriptors in API routes; a future phase will migrate to database storage for dynamic form updates without code deployments.

---

## Sub-Form Type Definitions

Add TypeScript types for sub-form descriptors and references in the form descriptor system.

**Requirements**:
- Given sub-form needs, should define SubFormDescriptor interface identical to GlobalFormDescriptor (including submission config)
- Given sub-form references, should add includes property to GlobalFormDescriptor containing array of sub-form IDs to resolve
- Given block composition needs, should add subFormRef property to BlockDescriptor to reference a sub-form by ID
- Given serialization needs, should ensure all types remain JSON-serializable (no functions, RegExp objects, or circular references)

---

## Sub-Form Resolver Utility

Create utility function to resolve and merge sub-forms into global descriptor at runtime.

**Requirements**:
- Given a GlobalFormDescriptor with includes array, should fetch all referenced sub-forms from hardcoded sources (API endpoints or in-memory map)
- Given sub-form blocks, should prefix block IDs with sub-form ID to prevent collisions (format: `${subFormId}_${blockId}`)
- Given sub-form fields, should preserve field IDs as-is (assuming global uniqueness or resolver handles namespacing)
- Given nested sub-forms, should recursively resolve sub-forms referenced within other sub-forms
- Given resolution errors, should throw descriptive errors for missing sub-forms or circular dependencies
- Given serialization needs, should return fully merged GlobalFormDescriptor that is JSON-serializable

---

## Sub-Form API Endpoints

Add API endpoints to serve form descriptors and sub-forms with hardcoded data, with runtime resolution.

**Requirements**:
- Given sub-form requests, should create GET /api/form/sub-form/:id endpoint returning hardcoded SubFormDescriptor JSON
- Given global descriptor requests, should update GET /api/form/global-descriptor to resolve sub-forms before returning
- Given resolution needs, should use sub-form resolver utility to merge sub-forms into global descriptor at runtime
- Given error cases, should return appropriate HTTP errors for missing descriptors or resolution failures
- Given future database needs, should structure code to allow easy migration to database-backed storage later

---

## Sub-Form Resolution in Thunk and Hook

Update fetchGlobalDescriptorThunk and useGlobalDescriptor hook to resolve sub-forms during descriptor loading.

**Requirements**:
- Given descriptor loading, should fetch global descriptor from API endpoint (which resolves sub-forms server-side)
- Given resolved descriptor, should store fully merged descriptor in Redux state
- Given resolution errors, should handle and propagate errors appropriately
- Given caching needs, should leverage TanStack Query cache for resolved descriptors
- Given client-side needs, should support optional client-side resolution if server-side resolution fails

## Sub-Form Resolution Tests

Add comprehensive tests for sub-form resolution logic and error handling.

**Requirements**:
- Given sub-form resolver, should test successful merging of single sub-form from hardcoded sources
- Given nested sub-forms, should test recursive resolution of sub-forms within sub-forms
- Given ID collisions, should test block ID prefixing prevents conflicts
- Given circular dependencies, should test detection and error reporting
- Given missing sub-forms, should test error handling for unresolved references
- Given serialization, should verify resolved descriptors are JSON-serializable
