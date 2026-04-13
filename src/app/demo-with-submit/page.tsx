'use client';

/**
 * Demo Page with Submission - Form Submission Showcase
 * 
 * Demo page that showcases form submission, displays payload being sent,
 * and shows backend validation responses.
 */

import { useState, useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import SubmitButton from '@/components/submit-button';
import { useGlobalDescriptor } from '@/hooks/use-form-query';
import { getFormState, getVisibleBlocks, getVisibleFields, syncFormDataToContext, type RootState } from '@/store/form-dux';
import { fetchDataSourceThunk } from '@/store/form-thunks';
import { useDebouncedRehydration } from '@/hooks/use-debounced-rehydration';
import { useDraftSave } from '@/hooks/use-draft-save';
import type { AppDispatch } from '@/store/store';
import { updateCaseContext, identifyDiscriminantFields, hasContextChanged } from '@/utils/context-extractor';
import { useFormDescriptor } from '@/hooks/use-form-descriptor';
import { createSubmissionOrchestrator, evaluatePayloadTemplate, constructSubmissionRequest, serializeFormValues } from '@/utils/submission-orchestrator';
import type { GlobalFormDescriptor, FormData, CaseContext, BlockDescriptor, FieldDescriptor } from '@/types/form-descriptor';
import { evaluateValidationArrayTemplate } from '@/utils/array-template-evaluator';
import type { FormContext } from '@/utils/template-evaluator';
import { Button } from '@/components/ui/button';
import FormPresentation from '@/components/form-presentation';
import FormValuesWatcher from '@/components/form-values-watcher';
import { PopinManagerProvider } from '@/components/popin-manager';

interface SubmissionState {
  payload: string | null;
  requestHeaders: Record<string, string> | null;
  response: unknown | null;
  responseStatus: number | null;
  errors: Array<{ field: string; message: string }> | null;
  isSubmitting: boolean;
  submittedAt: Date | null;
}

export default function DemoWithSubmitPage() {
  const formState = useSelector((state: RootState) => getFormState(state));
  const [submissionState, setSubmissionState] = useState<SubmissionState>({
    payload: null,
    requestHeaders: null,
    response: null,
    responseStatus: null,
    errors: null,
    isSubmitting: false,
    submittedAt: null,
  });

  const {
    mergedDescriptor,
    isRehydrating,
  } = formState;

  // Load global descriptor using TanStack Query hook
  // This automatically syncs to Redux state on success
  const { refetch: refetchDescriptor } = useGlobalDescriptor('/api/form/global-descriptor-demo');

  // Reset form handler
  const handleReset = useCallback(() => {
    setSubmissionState({
      payload: null,
      requestHeaders: null,
      response: null,
      responseStatus: null,
      errors: null,
      isSubmitting: false,
      submittedAt: null,
    });
    // Reload the descriptor to reset form
    refetchDescriptor();
  }, [refetchDescriptor]);

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">Form Submission Demo</h1>
              <p className="text-gray-600 text-lg">
                Interactive showcase of form submission with payload and response display
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleReset}>
                Reset Form
              </Button>
            </div>
          </div>

          {/* Status Indicators */}
          <div className="flex gap-4 mb-4">
            <div className="px-4 py-2 bg-white rounded-lg shadow-sm border">
              <div className="text-sm text-gray-500">Re-hydration Status</div>
              <div className="flex items-center gap-2 mt-1">
                {isRehydrating ? (
                  <>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-blue-600">Re-hydrating...</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium text-green-600">Ready</span>
                  </>
                )}
              </div>
            </div>
            {submissionState.submittedAt && (
              <div className="px-4 py-2 bg-white rounded-lg shadow-sm border">
                <div className="text-sm text-gray-500">Last Submitted</div>
                <div className="text-sm font-medium">
                  {submissionState.submittedAt.toLocaleTimeString()}
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Main Form Area */}
          <div>
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-xl font-semibold mb-4">Form</h2>
              <FormContainerWithSubmissionWithHook
                onSubmissionStateChange={setSubmissionState}
              />
            </div>
          </div>

          {/* Submission Info Panel */}
          <div className="space-y-6">
            {/* Payload Display */}
            {submissionState.payload && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-semibold mb-4">Request Payload</h2>
                <div className="mb-2">
                  <span className="text-sm text-gray-500">Method: </span>
                  <span className="text-sm font-medium">{mergedDescriptor?.submission?.method || 'POST'}</span>
                </div>
                <div className="mb-2">
                  <span className="text-sm text-gray-500">URL: </span>
                  <span className="text-sm font-medium">{mergedDescriptor?.submission?.url || '/api/form/submit'}</span>
                </div>
                {submissionState.requestHeaders && (
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Headers</h3>
                    <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto max-h-32">
                      {JSON.stringify(submissionState.requestHeaders, null, 2)}
                    </pre>
                  </div>
                )}
                <pre className="bg-gray-50 p-4 rounded overflow-auto text-sm max-h-64">
                  {submissionState.payload}
                </pre>
              </div>
            )}

            {/* Response Display */}
            {submissionState.response !== null && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-semibold mb-4">Response</h2>
                {submissionState.responseStatus && (
                  <div className="mb-4">
                    <span className="text-sm text-gray-500">Status: </span>
                    <span className={`text-sm font-medium ${
                      submissionState.responseStatus >= 200 && submissionState.responseStatus < 300
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      {submissionState.responseStatus}
                    </span>
                  </div>
                )}
                {submissionState.errors && submissionState.errors.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-red-700 mb-2">
                      Validation Errors ({submissionState.errors.length})
                    </h3>
                    <div className="bg-red-50 border border-red-200 rounded p-3">
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {submissionState.errors.map((error, index) => (
                          <li key={index}>
                            <span className="font-medium">{error.field}:</span> {error.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                <pre className="bg-gray-50 p-4 rounded overflow-auto text-sm max-h-64">
                  {JSON.stringify(submissionState.response, null, 2)}
                </pre>
              </div>
            )}

            {/* Placeholder when no submission yet */}
            {!submissionState.payload && !submissionState.response && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-semibold mb-4">Submission Info</h2>
                <p className="text-gray-500 text-sm">
                  Fill out the form and click Submit to see the payload and response here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Form Container with Submission - Custom container that includes submission functionality
 */
interface FormContainerWithSubmissionProps {
  onSubmissionStateChange: (state: SubmissionState) => void;
}

interface StateProps {
  mergedDescriptor: GlobalFormDescriptor | null;
  visibleBlocks: BlockDescriptor[];
  visibleFields: FieldDescriptor[];
  caseContext: CaseContext;
  isRehydrating: boolean;
  formData: Partial<FormData>;
  dataSourceCache: Record<string, unknown>;
}

interface DispatchProps {
  syncFormDataToContext: (formData: Partial<FormData>) => void;
  rehydrateRules: (caseContext: CaseContext) => void;
  fetchDataSource: (fieldPath: string, url: string, auth?: { type: 'bearer' | 'apikey'; token?: string; headerName?: string }) => void;
}

type FormContainerWithSubmissionComponentProps = StateProps & DispatchProps & FormContainerWithSubmissionProps;

function withTemplateDemoDescriptor(descriptor: GlobalFormDescriptor | null): GlobalFormDescriptor | null {
  if (!descriptor) {
    return null;
  }

  // Demonstrate template-driven items + validation without changing backend APIs.
  // - `emergencyRelationship.items` becomes a Handlebars template returning JSON items
  // - `state.validation` becomes a Handlebars template returning JSON rules
  return {
    ...descriptor,
    blocks: descriptor.blocks.map((block) => ({
      ...block,
      fields: block.fields.map((field) => {
        if (field.id === 'emergencyRelationship' && field.type === 'dropdown') {
          return {
            ...field,
            description: `${field.description ?? ''} (template items demo)`.trim(),
            items:
              '{{#if (eq entityType "individual")}}' +
              '[{"label":"Spouse","value":"spouse"},{"label":"Parent","value":"parent"},{"label":"Friend","value":"friend"}]' +
              '{{else}}' +
              '[{"label":"Director","value":"director"},{"label":"Officer","value":"officer"},{"label":"Shareholder","value":"shareholder"}]' +
              '{{/if}}',
          };
        }

        if (field.id === 'state' && field.type === 'dropdown') {
          return {
            ...field,
            description: `${field.description ?? ''} (template validation demo)`.trim(),
            validation:
              '[' +
              '{"type":"required","message":"State/Province is required"},' +
              '{{#if (eq country "US")}}' +
              '{"type":"pattern","value":"^[A-Z]{2}$","message":"Use 2-letter state code (US)"}' +
              '{{else}}' +
              '{"type":"minLength","value":2,"message":"Too short"}' +
              '{{/if}}' +
              ']',
          };
        }

        return field;
      }),
    })),
  };
}

function FormContainerWithSubmissionComponent({
  mergedDescriptor,
  visibleBlocks,
  visibleFields,
  caseContext,
  isRehydrating,
  formData: _formData,
  dataSourceCache,
  syncFormDataToContext: syncFormData,
  rehydrateRules: rehydrate,
  fetchDataSource: loadDataSource,
  onSubmissionStateChange,
}: FormContainerWithSubmissionComponentProps) {
  const demoDescriptor = useMemo(() => withTemplateDemoDescriptor(mergedDescriptor), [mergedDescriptor]);

  // Initialize react-hook-form with descriptor
  const handleDiscriminantChange = useCallback(
    (newFormData: Partial<FormData>) => {
      syncFormData(newFormData);
      const discriminantFields = mergedDescriptor
        ? identifyDiscriminantFields(visibleFields)
        : [];
      if (discriminantFields.length === 0) {
        return;
      }
      const updatedContext = updateCaseContext(caseContext, newFormData, discriminantFields);
      if (hasContextChanged(caseContext, updatedContext)) {
        rehydrate(updatedContext);
      }
    },
    [mergedDescriptor, visibleFields, caseContext, syncFormData, rehydrate]
  );

  // Initialize useFormDescriptor hook
  const { form } = useFormDescriptor(demoDescriptor, {
    savedFormData: _formData,
    caseContext,
    formData: _formData,
  });

  // Create submission orchestrator
  const orchestrator = useMemo(() => createSubmissionOrchestrator(), []);
  const { saveDraft } = useDraftSave({
    form,
    draftConfig: demoDescriptor?.draft,
    caseContext,
  });

  // Create submit handler with payload/response tracking
  const handleSubmitWithTracking = useCallback(async (e?: React.BaseSyntheticEvent) => {
    if (!demoDescriptor) {
      return;
    }

    // Get current form values
    const formValues = form.getValues();
    
    // Check if form data contains File objects
    const { hasFileObjects } = await import('@/utils/submission-orchestrator');
    const containsFiles = hasFileObjects(formValues as Partial<FormData>);

    // Evaluate payload template
    const evaluatedPayload = evaluatePayloadTemplate(
      demoDescriptor.submission.payloadTemplate,
      formValues as Partial<FormData>,
      caseContext
    );

    // Construct request body
    let requestBody: string | globalThis.FormData;
    let payloadString: string;
    if (containsFiles) {
      const { constructFormData } = await import('@/utils/submission-orchestrator');
      // For multipart, use form values directly (evaluated payload is for JSON)
      const payloadData = typeof evaluatedPayload === 'object' && !Array.isArray(evaluatedPayload) && evaluatedPayload !== null
        ? evaluatedPayload
        : formValues as Partial<FormData>;
      requestBody = constructFormData(formValues as Partial<FormData>, payloadData);
      // For display purposes, stringify the evaluated payload
      payloadString = typeof evaluatedPayload === 'string'
        ? evaluatedPayload
        : JSON.stringify(evaluatedPayload);
    } else {
      requestBody = typeof evaluatedPayload === 'string'
        ? evaluatedPayload
        : JSON.stringify(evaluatedPayload);
      payloadString = requestBody;
    }

    // Construct request to get headers
    const requestInit = constructSubmissionRequest(
      demoDescriptor.submission,
      requestBody,
      containsFiles
    );
    const headers = requestInit.headers as Record<string, string>;

    // Update state with payload and headers before submission
    onSubmissionStateChange({
      payload: payloadString,
      requestHeaders: headers,
      response: null,
      responseStatus: null,
      errors: null,
      isSubmitting: true,
      submittedAt: null,
    });

    // Create submit handler with tracking
    const submitHandler = orchestrator.createSubmitHandler(
      form,
      demoDescriptor,
      {
        caseContext,
        setError: (field: string, error: { type: string; message: string }) => {
          form.setError(field, error);
        },
        onSuccess: (response: unknown) => {
          onSubmissionStateChange({
            payload: payloadString,
            requestHeaders: headers,
            response,
            responseStatus: 200,
            errors: null,
            isSubmitting: false,
            submittedAt: new Date(),
          });
        },
        onError: (error: unknown) => {
          if (error && typeof error === 'object' && 'errors' in error) {
            const backendError = error as { errors?: Array<{ field: string; message: string }>; error?: string };
            onSubmissionStateChange({
              payload: payloadString,
              requestHeaders: headers,
              response: error,
              responseStatus: 400,
              errors: backendError.errors || null,
              isSubmitting: false,
              submittedAt: new Date(),
            });
          } else {
            onSubmissionStateChange({
              payload: payloadString,
              requestHeaders: headers,
              response: error,
              responseStatus: null,
              errors: null,
              isSubmitting: false,
              submittedAt: new Date(),
            });
          }
        },
      }
    );

    // Call the submit handler
    await submitHandler(e);
  }, [form, demoDescriptor, caseContext, orchestrator, onSubmissionStateChange]);

  // Prepare props for presentation component
  const presentationProps = useMemo(
    () => ({
      form,
      visibleBlocks,
      visibleFields,
      isRehydrating,
      mergedDescriptor: demoDescriptor,
      onLoadDataSource: loadDataSource,
      dataSourceCache,
    }),
    [form, visibleBlocks, visibleFields, isRehydrating, demoDescriptor, loadDataSource, dataSourceCache]
  );

  return (
    <FormValuesWatcher
      form={form}
      caseContext={caseContext}
      descriptor={mergedDescriptor}
      onDiscriminantChange={handleDiscriminantChange}
      onFormChange={saveDraft}
    >
      {(formContext) => (
        <PopinManagerProvider
          mergedDescriptor={demoDescriptor}
          form={form}
          formContext={formContext}
          caseContext={caseContext}
          onLoadDataSource={loadDataSource}
          dataSourceCache={dataSourceCache}
        >
          <FormPresentation {...presentationProps} formContext={formContext} />
          {demoDescriptor && (
            <div className="mt-6">
              <SubmitButton
                form={form}
                descriptor={demoDescriptor}
                isRehydrating={isRehydrating}
                onSubmit={handleSubmitWithTracking}
              />
            </div>
          )}
        </PopinManagerProvider>
      )}
    </FormValuesWatcher>
  );
}


// Component that uses the debounced rehydration hook
function FormContainerWithSubmissionWithHook({
  onSubmissionStateChange,
}: {
  onSubmissionStateChange: (state: SubmissionState) => void;
}) {
  const dispatch = useDispatch<AppDispatch>();
  const formState = useSelector((state: RootState) => getFormState(state));
  const visibleBlocks = useSelector((state: RootState) => getVisibleBlocks(state));
  const visibleFields = useSelector((state: RootState) => getVisibleFields(state));
  const { mutate: debouncedRehydrate, isPending: isRehydratingFromHook } = useDebouncedRehydration();

  const {
    mergedDescriptor,
    caseContext,
    isRehydrating: isRehydratingFromRedux,
    formData,
    dataSourceCache,
  } = formState;

  const isRehydrating = isRehydratingFromHook || isRehydratingFromRedux;

  // Force form remount when validation rules change so RHF picks up fresh resolver rules.
  // Avoid remounting on every context update because it can cancel pending debounced draft saves.
  const formKey = useMemo(() => {
    if (!mergedDescriptor) {
      return 'no-descriptor';
    }
    const validationHash = mergedDescriptor.blocks
      .flatMap((block) => block.fields)
      .map((field) => {
        const evaluatedRules = evaluateValidationArrayTemplate(
          field.validation,
          { caseContext: caseContext as unknown as FormContext } as FormContext
        );
        const ruleTypes = evaluatedRules
          .map((rule) => {
            if (rule.type === 'pattern') {
              const patternValue = typeof rule.value === 'string' ? rule.value : rule.value.toString();
              return `${rule.type}:${patternValue}`;
            }
            return `${rule.type}:${'value' in rule ? rule.value : ''}`;
          })
          .join(',') || 'none';
        return `${field.id}:${ruleTypes}`;
      })
      .join('|');
    return `form-${validationHash}`;
  }, [mergedDescriptor, caseContext]);

  const syncFormData = useCallback(
    (formData: Partial<FormData>) => {
      dispatch(syncFormDataToContext({ formData: serializeFormValues(formData) }));
    },
    [dispatch]
  );

  const rehydrate = useCallback(
    (caseContext: CaseContext) => {
      debouncedRehydrate(caseContext);
    },
    [debouncedRehydrate]
  );

  const loadDataSource = useCallback(
    (fieldPath: string, url: string, auth?: { type: 'bearer' | 'apikey'; token?: string; headerName?: string }) => {
      dispatch(fetchDataSourceThunk({ fieldPath, url, auth }));
    },
    [dispatch]
  );

  return (
    <FormContainerWithSubmissionComponent
      key={formKey}
      mergedDescriptor={mergedDescriptor}
      visibleBlocks={visibleBlocks}
      visibleFields={visibleFields}
      caseContext={caseContext}
      isRehydrating={isRehydrating}
      formData={formData}
      dataSourceCache={dataSourceCache}
      syncFormDataToContext={syncFormData}
      rehydrateRules={rehydrate}
      fetchDataSource={loadDataSource}
      onSubmissionStateChange={onSubmissionStateChange}
    />
  );
}
