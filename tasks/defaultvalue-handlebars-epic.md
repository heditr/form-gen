# DefaultValue Handlebars Evaluation Epic

**Status**: 📋 PLANNED  
**Goal**: Enable defaultValue in field descriptors to be evaluated as Handlebars expressions, support file uploads with multipart/form-data, and allow file default values as URL strings

## Overview

Currently, field descriptors support static default values only, and form submissions use JSON only. To enable dynamic default values based on form context (such as case context or other field values) and support file uploads, we need to: (1) evaluate defaultValue as Handlebars templates, (2) support multipart/form-data submission when files are present, and (3) allow file default values to be URL strings (from templates or static values). File fields store URL strings (not File objects) - when users upload files, they are uploaded to the server which returns a URL. This allows form builders to set default values that adapt based on discriminant fields, prefill data, or other contextual information, and properly handle binary file uploads, improving form flexibility and user experience.

---

## Update Type Definitions

Update FieldDescriptor and FormData types to reflect that file fields store URL strings (not File objects).

**Requirements**:
- Given a field descriptor with defaultValue as a string, should accept it as a potential Handlebars template
- Given a field descriptor with defaultValue as a non-string, should preserve backward compatibility with static values
- Given file field type, should allow defaultValue as string (URL) or null
- Given FormData type for file fields, should be string | null (URL) not File | File[]

---

## Create DefaultValue Evaluation Function

Create a utility function to evaluate defaultValue templates with form context, converting the result to the appropriate type based on field type.

**Requirements**:
- Given a defaultValue string and form context, should evaluate as Handlebars template
- Given a non-string defaultValue, should return the value unchanged
- Given a template result for text/dropdown/autocomplete/date field, should return string
- Given a template result for checkbox field, should parse "true"/"false" to boolean
- Given a template result for number field, should parse to number
- Given a template result for radio field, should return string or number
- Given a template result for file field, should return URL string (no conversion needed)
- Given a template result for file field evaluating to "null" or empty, should return null or empty string
- Given evaluation error, should return fallback value based on field type

---

## Update Default Value Extraction

Modify extractDefaultValues to evaluate Handlebars templates when defaultValue is a string, using form context.

**Requirements**:
- Given a descriptor with template defaultValue and context, should evaluate template before setting default
- Given a descriptor with static defaultValue, should use value directly
- Given a descriptor without defaultValue, should use type-appropriate fallback
- Given context with formData and caseContext, should make both available to templates

---

## Update Form Initialization

Update useFormDescriptor and form container to pass context when extracting default values.

**Requirements**:
- Given form initialization, should pass caseContext and formData to defaultValue evaluation
- Given context changes, should re-evaluate defaultValues for fields that need updates
- Given form remount, should re-evaluate defaultValues with current context

---

## Update File Field Component

Update file field component to handle file uploads and display existing files from URLs.

**Requirements**:
- Given file field with URL string default value, should display link to view file in browser
- Given user selects file in file field, should upload file to server and receive URL
- Given file upload success, should store URL string in form data
- Given file upload error, should handle error appropriately
- Given file field with URL value, should allow user to replace with new upload

---

## Support File Upload and Multipart Form Data Submission

Update submission orchestrator and thunks to detect file uploads and use multipart/form-data when files are present.

**Requirements**:
- Given form data with pending file uploads (File objects), should use multipart/form-data content type
- Given form data with only URL strings (no File objects), should use application/json content type
- Given multipart submission, should construct FormData with all fields including files
- Given multipart submission, should preserve non-file fields as form data entries
- Given multipart submission, should include files with correct field names
- Given submission config with payloadTemplate, should evaluate template before constructing multipart data
- Given multipart submission, should not set Content-Type header (browser sets boundary)

---

## Add Tests

Write comprehensive tests for defaultValue template evaluation covering all field types and edge cases.

**Requirements**:
- Given text field with template defaultValue, should evaluate and set string value
- Given checkbox field with template defaultValue, should evaluate and parse boolean
- Given number field with template defaultValue, should evaluate and parse number
- Given file field with template evaluating to URL string, should use URL as default value
- Given file field with template evaluating to "null" or empty, should return null or empty string
- Given file field with static URL string defaultValue, should use URL directly
- Given template referencing caseContext, should evaluate with context values
- Given template referencing formData, should evaluate with form values
- Given invalid template, should fallback to type-appropriate default
- Given static defaultValue, should preserve existing behavior
- Given file field with URL string default value, should display file link
- Given file field with user-selected file, should upload file and store returned URL
- Given form submission with File objects (pending uploads), should use multipart/form-data
- Given form submission with only URL strings, should use application/json
- Given multipart submission, should include all fields and files correctly
