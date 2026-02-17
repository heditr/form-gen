'use client';

/**
 * Demo Page - Re-hydration Showcase
 * 
 * Comprehensive demo page that showcases the form engine's re-hydration process.
 * Displays form state, re-hydration status, and allows interactive testing.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSelector, useDispatch, connect } from 'react-redux';
import { useGlobalDescriptor } from '@/hooks/use-form-query';
import { getFormState, getVisibleBlocks, getVisibleFields, syncFormDataToContext, initializeCaseContextFromPrefill, updateCaseContextValues } from '@/store/form-dux';
import { rehydrateRulesThunk, fetchDataSourceThunk } from '@/store/form-thunks';
import type { RootState } from '@/store/form-dux';
import type { AppDispatch } from '@/store/store';
import { Button } from '@/components/ui/button';
import { createSubmissionOrchestrator, evaluatePayloadTemplate } from '@/utils/submission-orchestrator';
import type { FormData, GlobalFormDescriptor, BlockDescriptor, FieldDescriptor, CaseContext } from '@/types/form-descriptor';
import { useFormDescriptor } from '@/hooks/use-form-descriptor';
import { updateCaseContext, identifyDiscriminantFields, hasContextChanged } from '@/utils/context-extractor';
import FormPresentation from '@/components/form-presentation';
import { PopinManagerProvider } from '@/components/popin-manager';
import SubmitButton from '@/components/submit-button';

interface SubmissionState {
  payload: string | null;
  requestHeaders?: Record<string, string> | null;
  response: unknown | null;
  responseStatus: number | null;
  errors: Array<{ field: string; message: string }> | null;
  isSubmitting: boolean;
  submittedAt?: Date | null;
}

export default function DemoPage() {
  const dispatch = useDispatch<AppDispatch>();
  const formState = useSelector((state: RootState) => getFormState(state));
  const [showDebug, setShowDebug] = useState(false);
  const [submissionState, setSubmissionState] = useState<SubmissionState>({
    payload: null,
    response: null,
    responseStatus: null,
    errors: null,
    isSubmitting: false,
  });

  const {
    mergedDescriptor,
    caseContext,
    isRehydrating,
    formData,
    dataSourceCache,
  } = formState;

  // Load global descriptor using TanStack Query hook
  // This automatically syncs to Redux state on success
  const { refetch: refetchDescriptor } = useGlobalDescriptor('/api/form/global-descriptor-demo');

  // Automatically initialize case context with test values on page load
  // Only initialize if context is empty to avoid overwriting existing values
  useEffect(() => {
    const hasContext = caseContext && Object.keys(caseContext).length > 0;
    if (!hasContext) {
      // Set CasePrefill values
      dispatch(initializeCaseContextFromPrefill({
        casePrefill: {
          incorporationCountry: 'US',
          processType: 'standard',
          needSignature: true,
        },
      }));
      // Set custom context values for template testing (email, phone, etc.)
      dispatch(updateCaseContextValues({
        caseContext: {
          email: 'test@example.com',
          phone: '+1-555-123-4567',
          documentUrl: 'https://example.com/sample-document.pdf',
          priority: 5,
          newsletter: true,
        },
      }));
    }
  }, [dispatch, caseContext]);


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

  // Initialize case context with test values for demo
  const handleInitTestContext = useCallback(() => {
    // Set CasePrefill values
    dispatch(initializeCaseContextFromPrefill({
      casePrefill: {
        incorporationCountry: 'US',
        processType: 'standard',
        needSignature: true,
      },
    }));
    // Set custom context values for template testing (email, phone, etc.)
    dispatch(updateCaseContextValues({
      caseContext: {
        email: 'test@example.com',
        phone: '+1-555-123-4567',
        documentUrl: 'https://example.com/sample-document.pdf',
        priority: 5,
        newsletter: true,
      },
    }));
  }, [dispatch]);

  // Get visible blocks count
  const visibleBlocksCount = mergedDescriptor?.blocks?.length || 0;
  
  // Get total fields count
  const totalFieldsCount = mergedDescriptor?.blocks?.reduce(
    (acc, block) => acc + (block.fields?.length || 0),
    0
  ) || 0;

  // Get discriminant fields
  const discriminantFields = mergedDescriptor?.blocks
    ?.flatMap(block => block.fields || [])
    .filter(field => field.isDiscriminant) || [];

  // Extract errors for display
  const hasErrors = submissionState.errors && submissionState.errors.length > 0;

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">Form Engine Demo</h1>
              <p className="text-gray-600 text-lg">
                Interactive showcase of form re-hydration and dynamic validation
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDebug(!showDebug)}
              >
                {showDebug ? 'Hide' : 'Show'} Debug Panel
              </Button>
              <Button variant="outline" onClick={handleInitTestContext}>
                Init Test Context
              </Button>
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
            <div className="px-4 py-2 bg-white rounded-lg shadow-sm border">
              <div className="text-sm text-gray-500">Blocks</div>
              <div className="text-lg font-semibold">{visibleBlocksCount}</div>
            </div>
            <div className="px-4 py-2 bg-white rounded-lg shadow-sm border">
              <div className="text-sm text-gray-500">Total Fields</div>
              <div className="text-lg font-semibold">{totalFieldsCount}</div>
            </div>
            <div className="px-4 py-2 bg-white rounded-lg shadow-sm border">
              <div className="text-sm text-gray-500">Discriminant Fields</div>
              <div className="text-lg font-semibold">{discriminantFields.length}</div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form Area */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-xl font-semibold mb-4">Form</h2>
              <FormContainerWithSubmission
                onSubmissionStateChange={setSubmissionState}
              />
            </div>

            {/* Submission Payload */}
            {submissionState.payload ? (
              <div className="mt-6 bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-semibold mb-4">Submission Payload</h2>
                {mergedDescriptor?.submission && (
                  <div className="mb-4 space-y-1 text-sm">
                    <div>
                      <span className="text-gray-500">Method: </span>
                      <span className="font-medium">{mergedDescriptor.submission.method || 'POST'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">URL: </span>
                      <span className="font-medium">{mergedDescriptor.submission.url}</span>
                    </div>
                  </div>
                )}
                <pre className="bg-gray-50 p-4 rounded overflow-auto text-sm max-h-64">
                  {submissionState.payload}
                </pre>
              </div>
            ) : null}

            {/* Submission Errors */}
            {hasErrors && submissionState.errors ? (
              <div className="mt-6 bg-white rounded-lg shadow-sm border border-red-200 p-6">
                <h2 className="text-xl font-semibold mb-4 text-red-700">
                  Validation Errors ({submissionState.errors.length})
                </h2>
                <div className="bg-red-50 border border-red-200 rounded p-4">
                  <ul className="list-disc list-inside space-y-2">
                    {submissionState.errors.map((error, index) => (
                      <li key={index} className="text-sm">
                        <span className="font-medium text-red-800">{error.field}:</span>{' '}
                        <span className="text-red-700">{error.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}

            {/* Submission Response */}
            {submissionState.response ? (
              <div className="mt-6 bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Submission Response</h2>
                  {submissionState.responseStatus ? (
                    <span className={`px-3 py-1 rounded text-sm font-medium ${
                      submissionState.responseStatus >= 200 && submissionState.responseStatus < 300
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      Status: {submissionState.responseStatus}
                    </span>
                  ) : null}
                </div>
                {submissionState.submittedAt ? (
                  <div className="mb-4 text-sm text-gray-500">
                    Submitted at: {submissionState.submittedAt.toLocaleTimeString()}
                  </div>
                ) : null}
                <pre className="bg-gray-50 p-4 rounded overflow-auto text-sm max-h-64">
                  {JSON.stringify(submissionState.response, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>

          {/* Debug Panel */}
          {showDebug && (
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-sm border p-6 sticky top-4">
                <h2 className="text-xl font-semibold mb-4">Debug Panel</h2>
                
                {/* Case Context */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Case Context</h3>
                  <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto max-h-40">
                    {JSON.stringify(caseContext, null, 2)}
                  </pre>
                </div>

                {/* Form Data */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Form Data</h3>
                  <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto max-h-40">
                    {JSON.stringify(formData, null, 2)}
                  </pre>
                </div>

                {/* Discriminant Fields */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Discriminant Fields ({discriminantFields.length})
                  </h3>
                  <div className="bg-gray-50 p-3 rounded text-xs">
                    {discriminantFields.length > 0 ? (
                      <ul className="list-disc list-inside space-y-1">
                        {discriminantFields.map(field => (
                          <li key={field.id}>{field.id} ({field.label})</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-gray-500">No discriminant fields</span>
                    )}
                  </div>
                </div>

                {/* Data Source Cache */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Data Source Cache ({Object.keys(dataSourceCache || {}).length})
                  </h3>
                  <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto max-h-40">
                    {JSON.stringify(dataSourceCache, null, 2)}
                  </pre>
                </div>

                {/* Re-hydration Info */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Re-hydration Info</h3>
                  <div className="bg-gray-50 p-3 rounded text-xs space-y-1">
                    <div>
                      <span className="font-medium">Status:</span>{' '}
                      {isRehydrating ? (
                        <span className="text-blue-600">Re-hydrating...</span>
                      ) : (
                        <span className="text-green-600">Ready</span>
                      )}
                    </div>
                    <div>
                      <span className="font-medium">Context Keys:</span>{' '}
                      {Object.keys(caseContext || {}).length}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
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

function FormContainerWithSubmissionComponent({
  mergedDescriptor,
  visibleBlocks,
  visibleFields,
  caseContext,
  isRehydrating,
  formData: savedFormData,
  dataSourceCache,
  syncFormDataToContext: syncFormData,
  rehydrateRules: rehydrate,
  fetchDataSource: loadDataSource,
  onSubmissionStateChange,
}: FormContainerWithSubmissionComponentProps) {
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

  const { form } = useFormDescriptor(mergedDescriptor, {
    onDiscriminantChange: handleDiscriminantChange,
    savedFormData,
    caseContext,
    formData: savedFormData,
  });

  const orchestrator = useMemo(() => createSubmissionOrchestrator(), []);

  const handleSubmitWithTracking = useCallback(async (e?: React.BaseSyntheticEvent) => {
    if (!mergedDescriptor) {
      return;
    }

    const formValues = form.getValues();
    
    const { hasFileObjects } = await import('@/utils/submission-orchestrator');
    const containsFiles = hasFileObjects(formValues as Partial<FormData>);

    const evaluatedPayload = evaluatePayloadTemplate(
      mergedDescriptor.submission?.payloadTemplate,
      formValues as Partial<FormData>
    );

    let requestBody: string | FormData;
    let payloadString: string;
    if (containsFiles) {
      const { constructFormData } = await import('@/utils/submission-orchestrator');
      const payloadData = typeof evaluatedPayload === 'object' && !Array.isArray(evaluatedPayload) && evaluatedPayload !== null
        ? evaluatedPayload
        : formValues as Partial<FormData>;
      requestBody = constructFormData(formValues as Partial<FormData>, payloadData);
      payloadString = typeof evaluatedPayload === 'string'
        ? evaluatedPayload
        : JSON.stringify(evaluatedPayload);
    } else {
      requestBody = typeof evaluatedPayload === 'string'
        ? evaluatedPayload
        : JSON.stringify(evaluatedPayload);
      payloadString = requestBody;
    }

    const { constructSubmissionRequest } = await import('@/utils/submission-orchestrator');
    const requestInit = constructSubmissionRequest(
      mergedDescriptor.submission,
      requestBody,
      containsFiles
    );
    const headers = requestInit.headers as Record<string, string>;

    onSubmissionStateChange({
      payload: payloadString,
      requestHeaders: headers,
      response: null,
      responseStatus: null,
      errors: null,
      isSubmitting: true,
      submittedAt: null,
    });

    const submitHandler = orchestrator.createSubmitHandler(
      form,
      mergedDescriptor,
      {
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

    await submitHandler(e);
  }, [form, mergedDescriptor, orchestrator, onSubmissionStateChange]);

  const formContext = useMemo(() => {
    const formValues = form.watch();
    return {
      ...formValues,
      caseContext,
      formData: formValues,
    };
  }, [form, caseContext]);

  const presentationProps = useMemo(
    () => ({
      form,
      visibleBlocks,
      visibleFields,
      isRehydrating,
      mergedDescriptor,
      onLoadDataSource: loadDataSource,
      dataSourceCache,
    }),
    [form, visibleBlocks, visibleFields, isRehydrating, mergedDescriptor, loadDataSource, dataSourceCache]
  );

  return (
    <PopinManagerProvider
      mergedDescriptor={mergedDescriptor}
      form={form}
      formContext={formContext}
      caseContext={caseContext}
      onLoadDataSource={loadDataSource}
      dataSourceCache={dataSourceCache}
    >
      <FormPresentation {...presentationProps} />
      {mergedDescriptor && (
        <div className="mt-6">
          <SubmitButton
            form={form}
            descriptor={mergedDescriptor}
            isRehydrating={isRehydrating}
            onSubmit={handleSubmitWithTracking}
          />
        </div>
      )}
    </PopinManagerProvider>
  );
}

const mapStateToProps = (state: RootState): StateProps => ({
  mergedDescriptor: getFormState(state).mergedDescriptor,
  visibleBlocks: getVisibleBlocks(state),
  visibleFields: getVisibleFields(state),
  caseContext: getFormState(state).caseContext,
  isRehydrating: getFormState(state).isRehydrating,
  formData: getFormState(state).formData,
  dataSourceCache: getFormState(state).dataSourceCache,
});

const mapDispatchToProps = (dispatch: AppDispatch): DispatchProps => ({
  syncFormDataToContext: (formData: Partial<FormData>) => {
    dispatch(syncFormDataToContext({ formData }));
  },
  rehydrateRules: (caseContext: CaseContext) => {
    dispatch(rehydrateRulesThunk(caseContext));
  },
  fetchDataSource: (fieldPath: string, url: string, auth?: { type: 'bearer' | 'apikey'; token?: string; headerName?: string }) => {
    dispatch(fetchDataSourceThunk({ fieldPath, url, auth }));
  },
});

const FormContainerWithSubmission = connect(
  mapStateToProps,
  mapDispatchToProps
)(FormContainerWithSubmissionComponent);
