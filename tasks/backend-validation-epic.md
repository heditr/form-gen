# Backend Validation Epic

**Status**: 📋 PLANNED  
**Goal**: Create backend validation API endpoint that validates form values against rehydrated rules and data sources, returning field-level errors for UI display.

## Overview

Currently, validation only occurs on the frontend using react-hook-form and Zod schemas derived from the form descriptor. While this provides fast feedback, the backend must remain the authoritative source of truth for compliance and security. Additionally, data source API calls currently expose authentication secrets in the descriptor, which is a security risk. This epic adds a `/api/form/validate` endpoint that receives `caseId` and `formValues`, calculates rehydrated validation rules for every field based on case context, validates data source values, and returns structured errors that can be displayed in the UI. It also creates a secure backend proxy for data source API calls that keeps secrets server-side while maintaining declarative descriptors through dataSourceId identifiers. This ensures backend authority and security while maintaining a responsive user experience.

---

## Create Validate API Endpoint

Create POST `/api/form/validate` endpoint that accepts caseId and formValues, performs comprehensive validation, and returns field-level errors.

**Requirements**:
- Given a request with caseId and formValues, should fetch the global form descriptor for the case
- Given formValues, should extract case context from discriminant fields
- Given case context, should rehydrate validation rules using existing rules/context logic
- Given global descriptor and rules object, should merge to create merged descriptor with all validation rules
- Given merged descriptor and formValues, should validate each field's value against its validation rules
- Given a field with dataSource configuration, should check if the provided value exists in the data source items
- Given validation failures, should return errors in format compatible with react-hook-form field error mapping
- Given successful validation, should return empty errors array

---

## Implement Validation Logic Utilities

Create utility functions to validate form values against merged descriptor rules and data sources.

**Requirements**:
- Given a field descriptor with validation rules and a field value, should apply all validation rules and return validation errors
- Given a field with dataSource configuration and a field value, should fetch data source items and verify value exists in items
- Given validation rule type 'required', should check if value is present and non-empty
- Given validation rule type 'minLength', should check if string value meets minimum length
- Given validation rule type 'maxLength', should check if string value meets maximum length
- Given validation rule type 'pattern', should check if value matches regex pattern
- Given data source validation failure, should return error indicating value is not from valid data source options

---

## Secure Data Source API Calls

Create backend proxy for data source API calls to keep secrets secure and maintain declarative descriptors.

**Requirements**:
- Given a data source configuration in descriptor, should use dataSourceId identifier instead of auth secrets (auth config removed from descriptor)
- Given a frontend request for data source, should call backend proxy endpoint with fieldId, dataSourceId, urlTemplate, itemsTemplate, and formContext
- Given a backend proxy request, should look up authentication credentials for the data source based on dataSourceId from secure configuration
- Given authentication credentials, should make proxied API call to external data source with proper auth headers
- Given proxied API response, should transform response using itemsTemplate and return to frontend
- Given data source proxy endpoint, should handle URL template evaluation server-side using formContext
- Given data source errors, should return appropriate error responses to frontend
- Given missing dataSourceId in descriptor, should return error indicating data source configuration is incomplete

---

## Update Frontend to Use Data Source Proxy

Update frontend data source loading to use backend proxy instead of direct API calls.

**Requirements**:
- Given a field with dataSource configuration, should call /api/data-sources/proxy instead of direct external API
- Given data source proxy request, should pass fieldId, dataSourceId, urlTemplate, itemsTemplate, and formContext
- Given data source proxy response, should cache and use items as before (maintain existing caching behavior)
- Given data source proxy errors, should handle errors gracefully and display to user
- Given missing dataSourceId in dataSource config, should handle gracefully and show appropriate error

---

## Integrate Validate Endpoint with Frontend

Update frontend to call validate endpoint and display backend validation errors in UI.

**Requirements**:
- Given form submission or validation trigger, should call /api/form/validate with caseId and current formValues
- Given validation response with errors, should map errors to react-hook-form field errors using existing error mapping utilities
- Given field-level errors from backend, should display errors in field components using existing error display mechanisms
- Given backend validation errors, should preserve existing frontend validation errors and merge appropriately
