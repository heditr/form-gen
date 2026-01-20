# JSONLogic Integration Epic

**Status**: 📋 PLANNED  
**Goal**: Integrate JSONLogic alongside Handlebars for declarative evaluation logic, replacing function-based custom validation with serializable JSONLogic rules for better maintainability and backend compatibility.

## Overview

Handlebars templates for complex boolean logic become verbose and hard to maintain, while function-based custom validation rules cannot be serialized to JSON, preventing backend-driven rule updates. This epic introduces JSONLogic for all evaluation logic (status conditions and validation rules) while keeping Handlebars for string templating (URLs, messages, payloads), creating a hybrid approach that is fully serializable, more maintainable, and enables cross-field validation without sacrificing the existing string templating capabilities.

---

## Install JSONLogic Dependency

Install jsonlogic library and TypeScript types for JSONLogic rule evaluation.

**Requirements**:
- Given the project needs JSONLogic evaluation, should install jsonlogic package
- Given TypeScript support needs, should install @types/jsonlogic if available or create type definitions

---

## Update Type Definitions

Update ValidationRule and StatusTemplates types to support JSONLogic rules and remove custom validation type.

**Requirements**:
- Given validation rule needs, should add 'jsonlogic' to ValidationRuleType union
- Given custom validation removal, should remove 'custom' type from ValidationRuleType
- Given JSONLogic validation, should add ValidationRule variant with type 'jsonlogic', rule property (JsonLogicRule), and message property (string or Handlebars template)
- Given status template needs, should update StatusTemplates to support JsonLogicRule for hidden, disabled, and readonly properties
- Given backward compatibility during migration, should support both string (Handlebars) and object (JSONLogic) for status templates

---

## Create JSONLogic Evaluator Utility

Create utility functions for evaluating JSONLogic rules with form context.

**Requirements**:
- Given a JSONLogic rule and form context, should evaluate rule returning boolean result
- Given form context structure, should provide current field value as empty var ("") and full formData for cross-field validation
- Given evaluation errors, should catch and log errors returning false as fail-safe
- Given rule caching needs, should cache compiled rules for performance optimization

---

## Update Template Evaluator for JSONLogic Status

Enhance template evaluator to support JSONLogic rules for status evaluation alongside Handlebars.

**Requirements**:
- Given status template value, should detect if it's JSONLogic (object) or Handlebars (string)
- Given JSONLogic rule, should evaluate using JSONLogic evaluator returning boolean directly
- Given Handlebars template, should evaluate using existing Handlebars evaluation returning parsed boolean
- Given evaluateHiddenStatus function, should support both JSONLogic and Handlebars formats
- Given evaluateDisabledStatus function, should support both JSONLogic and Handlebars formats
- Given evaluateReadonlyStatus function, should support both JSONLogic and Handlebars formats

---

## Update Validation Rule Adapter for JSONLogic

Enhance validation rule adapter to convert JSONLogic validation rules to react-hook-form and Zod schemas.

**Requirements**:
- Given JSONLogic validation rule, should convert to react-hook-form validate function
- Given form data context, should pass full formData to JSONLogic evaluator for cross-field validation
- Given message template, should support Handlebars templating for dynamic error messages
- Given JSONLogic rule, should convert to Zod schema using refine with JSONLogic evaluation
- Given multiple validation rules, should combine JSONLogic rules with other rule types correctly

---

## Remove Custom Validation Support

Remove all custom validation rule handling from validation adapters and type definitions.

**Requirements**:
- Given validation rule adapter, should remove 'custom' case from convertToReactHookFormRules function
- Given validation rule adapter, should remove 'custom' case from convertToZodSchema function
- Given type definitions, should remove custom ValidationRule variant from discriminated union
- Given type definitions, should remove 'custom' from ValidationRuleType union

---

## Update Tests for JSONLogic Validation

Update existing tests and add new tests for JSONLogic validation rules.

**Requirements**:
- Given validation rule adapter tests, should remove tests for custom validation rules
- Given validation rule adapter tests, should add tests for JSONLogic validation rules
- Given template evaluator tests, should add tests for JSONLogic status evaluation
- Given JSONLogic evaluator tests, should test single field validation with JSONLogic rules
- Given JSONLogic evaluator tests, should test cross-field validation with JSONLogic rules
- Given JSONLogic evaluator tests, should test error handling and fail-safe behavior

---

## Update API Routes for JSONLogic Rules

Update API routes to return JSONLogic rules instead of custom validation functions.

**Requirements**:
- Given rules context API route, should return JSONLogic rules in RulesObject for validation
- Given rules context API route, should return JSONLogic rules in RulesObject for status templates
- Given API response format, should ensure JSONLogic rules are properly serialized as JSON objects

---

## Update Demo and Example Data

Update demo pages and example form descriptors to use JSONLogic rules.

**Requirements**:
- Given demo page examples, should replace Handlebars status templates with JSONLogic rules where appropriate
- Given demo page examples, should add examples of JSONLogic validation rules
- Given example descriptors, should demonstrate cross-field validation using JSONLogic

---

## Documentation Updates

Update documentation to reflect JSONLogic integration and hybrid approach.

**Requirements**:
- Given form descriptor documentation, should document JSONLogic rule syntax for status templates
- Given form descriptor documentation, should document JSONLogic rule syntax for validation rules
- Given integration guide, should explain when to use JSONLogic vs Handlebars (logic vs templating)
- Given examples documentation, should provide JSONLogic rule examples for common validation scenarios
