# Technical Requirements: KYC Form Engine v3.1

## 1. Architecture Requirements

### 1.1 Technology Stack
- **Framework**: Next.js 16.1.1 (App Router)
- **UI Library**: React 19.2.3
- **State Management**: Redux with Autodux pattern (NO Redux Toolkit)
- **Side Effects**: Redux-saga for async operations
- **Template Engine**: Handlebars.js
- **UI Components**: Shadcn UI
- **Type Safety**: TypeScript 5
- **Runtime Validation**: Zod
- **ID Generation**: @paralleldrive/cuid2
- **Deployment**: Vercel

### 1.2 Code Architecture Patterns
- **Container/Presentation Pattern**: Containers connect Redux, presentation components are pure
- **Functional Programming**: Pure functions, immutability, composition over inheritance
- **Separation of Concerns**: State management, UI, and side-effects in separate modules
- **TDD Process**: All code changes must follow test-driven development

### 1.3 Data Flow Architecture
- **Hierarchical Structure**: GlobalFormDescriptor → Blocks → Fields
- **Hybrid Reactivity**: 
  - Fast Loop: Handlebars templates for immediate UI updates
  - Slow Loop: Backend re-hydration for compliance rule updates
- **Shared Validation**: Frontend and backend execute identical validation logic
- **Backend Authority**: Backend is source of truth for all validation outcomes

## 2. Performance Requirements

### 2.1 Response Time Targets
- **Form Load Time**: < 2 seconds for initial descriptor load
- **Validation Feedback**: < 100ms for inline validation (95th percentile)
- **Re-hydration Performance**: < 500ms for 95th percentile (critical for jurisdiction changes)
- **Data Source Loading**: < 1 second for dropdown population
- **Template Evaluation**: < 50ms for status template evaluation

### 2.2 Optimization Requirements
- **Debouncing**: 500ms debounce for re-hydration API calls
- **Caching**: Cache data source responses to prevent duplicate requests
- **Lazy Loading**: Load field data only when fields become visible
- **Code Splitting**: Implement route-based code splitting

## 3. Security Requirements

### 3.1 Validation Security
- **Backend Validation**: All validation MUST be re-executed on backend (never trust frontend)
- **Input Sanitization**: Backend sanitizes all inputs before processing
- **SQL Injection Prevention**: Use parameterized queries for any database operations
- **XSS Prevention**: Sanitize any user input that might be rendered as HTML

### 3.2 Authentication & Authorization
- **Token Management**: Securely store authentication tokens
- **Token Refresh**: Handle token expiration gracefully
- **Bearer Token Support**: Support Bearer tokens in API requests
- **API Key Support**: Support API keys via custom headers
- **RBAC**: Respect role-based access control for field visibility
- **Audit Trail**: Log all discriminant field changes and re-hydration events

### 3.3 Data Source Security
- **URL Whitelisting**: Backend validates that dataSource.url points to approved endpoints
- **Rate Limiting**: Prevent abuse of dynamic data source APIs
- **CORS**: Configure proper CORS policies for cross-origin requests
- **HTTPS**: All API communications must use HTTPS

### 3.4 OWASP Top 10 Compliance
- Review all code changes for OWASP Top 10 violations
- Implement proper input validation and output encoding
- Use timing-safe comparisons for secrets (SHA3-256 hashing)
- Avoid JWT where possible (prefer opaque tokens)

## 4. Functional Requirements

### 4.1 Form Descriptor System
- **Global Form Descriptor**: Hierarchical structure with blocks and fields
- **Deep Merging**: Merge GlobalFormDescriptor + RulesObject preserving structure
- **Version Control**: Support versioning in form descriptors
- **Metadata Support**: Title, description, and ordering for blocks and fields

### 4.2 Field Types Support
- **Text**: Single-line text input
- **Dropdown**: Static items or dynamic dataSource
- **Autocomplete**: Searchable dropdown with dynamic data
- **Radio**: Radio button groups
- **Checkbox**: Boolean checkbox input
- **Date**: Date picker with validation
- **File**: File upload with type/size validation

### 4.3 Data Source Management
- **Static Items**: Fields can provide hardcoded items array
- **Dynamic Data Sources**: Fields can specify dataSource for API-driven data
- **Mutual Exclusivity**: Field cannot have both items and dataSource
- **URL Templating**: Handlebars in URLs (e.g., `/cities?country={{country}}`)
- **Response Transformation**: Template-based transformation using Handlebars
- **Authentication**: Support Bearer tokens/API keys via headers

### 4.4 Template System
- **Handlebars Helpers**: eq, ne, gt, lt, gte, lte, and, or, not, contains, isEmpty
- **Context Access**: Nested form data access via dot notation
- **Status Evaluation**: Evaluate hidden, disabled, readonly templates
- **URL Evaluation**: Evaluate Handlebars in dataSource URLs
- **Payload Transformation**: Evaluate Handlebars in submission payload templates

### 4.5 Validation System
- **Validation Types**: required, minLength, maxLength, pattern, custom
- **Frontend Validation**: Immediate feedback (< 100ms)
- **Backend Validation**: Authoritative validation on submission
- **Error Mapping**: Map backend errors to specific field paths
- **Conditional Validation**: Rules that apply only under specific conditions
- **Cross-field Validation**: Validations that depend on multiple field values

### 4.6 Re-hydration System
- **Discriminant Detection**: Detect changes in fields marked as isDiscriminant
- **Context Extraction**: Build CaseContext from form data
- **Debouncing**: 500ms debounce for re-hydration calls
- **Loading States**: Show loading indicators without blocking input
- **Error Handling**: Handle re-hydration failures gracefully
- **State Preservation**: Preserve form data during re-hydration

### 4.7 Form Submission
- **Pre-validation**: Validate all visible fields before submission
- **Payload Transformation**: Evaluate payloadTemplate if provided
- **Configurable Endpoints**: Support GET, POST, PUT, PATCH methods
- **Authentication**: Support Bearer tokens and API keys
- **Error Handling**: Map backend errors to fields and display inline
- **Success Feedback**: Display clear success messages

## 5. User Experience Requirements

### 5.1 Visual Feedback
- **Loading Indicators**: Show loading states for data fetching and re-hydration
- **Smooth Transitions**: Animate blocks appearing/disappearing
- **Error Display**: Show validation errors inline beneath fields
- **Progress Indication**: User should understand form structure and progress
- **Toast Notifications**: Use Shadcn toast for success/error messages

### 5.2 Accessibility
- **WCAG 2.1 AA Compliance**: Required for all components
- **ARIA Labels**: All interactive elements must have proper ARIA labels
- **Keyboard Navigation**: Full keyboard navigation support
- **Screen Reader Support**: Proper semantic HTML and ARIA attributes
- **Focus Management**: Proper focus handling during form updates

### 5.3 Responsive Design
- **Mobile Support**: Form must work perfectly on mobile devices
- **Responsive Layout**: Blocks and fields adapt to screen size
- **Touch Targets**: Minimum 44x44px touch targets on mobile
- **Viewport Optimization**: Optimize for various screen sizes

### 5.4 Error Handling
- **Error Boundaries**: Catch and display form errors gracefully
- **Scroll to Error**: Automatically scroll to first error on validation failure
- **Clear Error Messages**: Specific and actionable error messages
- **Retry Mechanisms**: Allow retry for failed data source requests

## 6. API Requirements

### 6.1 Global Form Descriptor API
- **Endpoint**: `GET /api/form/global-descriptor`
- **Response**: GlobalFormDescriptor JSON
- **Error Handling**: Appropriate HTTP status codes
- **Headers**: Proper Content-Type headers

### 6.2 Rules Context API
- **Endpoint**: `POST /api/rules/context`
- **Request**: CaseContext object
- **Response**: RulesObject with validation rules and status conditions
- **Validation**: Validate CaseContext structure
- **Error Response**: Return validation errors with field paths

### 6.3 Data Source APIs
- **Dynamic URLs**: Support Handlebars templating in URLs
- **Authentication**: Support Bearer tokens and API keys
- **Response Format**: Support various response formats with transformation
- **Error Handling**: Graceful handling of API failures

### 6.4 Submission API
- **Configurable**: URL, method, headers, auth from descriptor
- **Payload Transformation**: Support Handlebars templates in payload
- **Error Mapping**: Return errors with field paths for mapping

## 7. Code Quality Requirements

### 7.1 JavaScript/TypeScript Standards
- **Functional Programming**: Pure functions, immutability, composition
- **Modern Syntax**: Arrow functions, destructuring, template literals
- **Type Safety**: Full TypeScript coverage
- **No Dead Code**: Remove unused code and files
- **Self-Describing APIs**: Clear function and variable names

### 7.2 Testing Requirements
- **TDD Process**: Write tests before implementation
- **Test Coverage**: Comprehensive test coverage for all utilities
- **Test Isolation**: No shared mutable state between tests
- **Integration Tests**: Test complete user journeys
- **5 Questions**: Tests must answer what, expected behavior, actual output, expected output, debugging

### 7.3 Documentation Requirements
- **Docblocks**: Minimal docblocks for public APIs
- **No Redundancy**: Comments should not reiterate code
- **Meaningful Comments**: Only comments that add value
- **Type Definitions**: Comprehensive TypeScript interfaces

## 8. State Management Requirements

### 8.1 Redux Store Structure
- **State Shape**: globalDescriptor, mergedDescriptor, formData, caseContext, validationErrors, isRehydrating, dataSourceCache
- **Actions**: loadGlobalDescriptor, updateFieldValue, triggerRehydration, applyRulesUpdate, setValidationErrors, loadDataSource
- **Selectors**: Access form state, visible blocks, visible fields, validation errors by field
- **Autodux Pattern**: Use Autodux dux objects, transpile from .sudo to .js

### 8.2 Saga Requirements
- **Global Descriptor Loading**: Fetch GET /api/form/global-descriptor
- **Re-hydration**: POST /api/rules/context with debouncing
- **Data Source Loading**: Fetch dynamic field data with authentication
- **Form Submission**: Submit form data to configured endpoint

## 9. Component Requirements

### 9.1 Component Patterns
- **Container/Presentation**: Containers connect Redux, no UI markup
- **No Business Logic in Containers**: Use react-redux connect to wire actions/selectors
- **Pure Presentation Components**: Presentation components are pure functions
- **Component Composition**: Compose smaller components into larger ones

### 9.2 Component Features
- **Conditional Rendering**: Based on status template evaluation
- **Loading States**: Show loading indicators appropriately
- **Error Display**: Display validation errors inline
- **Smooth Animations**: Animate transitions for blocks/fields
- **Accessibility**: Full ARIA and keyboard support

## 10. Success Metrics

### 10.1 Performance Metrics
- **Flexibility**: Ability to configure new KYC flows without code changes
- **Compliance**: 100% of validation rules enforced on backend
- **Performance**: Re-hydration completes within 500ms for 95th percentile
- **UX**: Inline validation feedback within 100ms
- **Reliability**: Frontend and backend validation consistency rate >99.9%

### 10.2 Quality Metrics
- **Test Coverage**: >80% code coverage
- **Type Safety**: 100% TypeScript coverage
- **Accessibility**: WCAG 2.1 AA compliance
- **Security**: Zero OWASP Top 10 violations
- **Code Quality**: All code reviews pass without major issues

## 11. Deployment Requirements

### 11.1 Environment
- **Platform**: Vercel
- **Node Version**: Compatible with Next.js 16.1.1
- **Build Process**: Next.js build pipeline
- **Environment Variables**: Secure handling of API keys and tokens

### 11.2 Monitoring
- **Error Tracking**: Track and log errors
- **Performance Monitoring**: Monitor API response times
- **User Analytics**: Track form completion rates
- **Audit Logging**: Log all discriminant field changes

## 12. Constraints

### 12.1 Technical Constraints
- **No Redux Toolkit**: Use Autodux pattern only
- **No Class Components**: Use functional components only
- **No Breaking Changes**: Follow open/closed principle
- **TDD Required**: All code changes must follow TDD process
- **One Task at a Time**: Never attempt multiple tasks simultaneously

### 12.2 Business Constraints
- **Backend Authority**: Backend is always source of truth
- **Compliance First**: Regulatory compliance cannot be bypassed
- **User Experience**: Must not sacrifice UX for compliance
- **Performance**: Must meet all performance targets
