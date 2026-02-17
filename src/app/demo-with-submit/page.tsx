'use client';

/**
 * Demo Page with Submission - Form Submission Showcase
 * 
 * Demo page that showcases form submission, displays payload being sent,
 * and shows backend validation responses.
 */

import { useState, useCallback, useMemo } from 'react';
import { useSelector, connect } from 'react-redux';
import type { ComponentType } from 'react';
import SubmitButton from '@/components/submit-button';
import { useGlobalDescriptor } from '@/hooks/use-form-query';
import { getFormState, getVisibleBlocks, getVisibleFields, syncFormDataToContext, type RootState } from '@/store/form-dux';
import { rehydrateRulesThunk, fetchDataSourceThunk } from '@/store/form-thunks';
import type { AppDispatch } from '@/store/store';
import { updateCaseContext, identifyDiscriminantFields, hasContextChanged } from '@/utils/context-extractor';
import { useFormDescriptor } from '@/hooks/use-form-descriptor';
import { createSubmissionOrchestrator, evaluatePayloadTemplate, constructSubmissionRequest } from '@/utils/submission-orchestrator';
import type { GlobalFormDescriptor, FormData, CaseContext, BlockDescriptor, FieldDescriptor } from '@/types/form-descriptor';
import { Button } from '@/components/ui/button';
import FormPresentation from '@/components/form-presentation';
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
              <FormContainerWithSubmission
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
  const { form } = useFormDescriptor(mergedDescriptor, {
    onDiscriminantChange: handleDiscriminantChange,
    savedFormData: _formData,
    caseContext,
    formData: _formData,
  });

  // Build form context for template evaluation (used by PopinManager)
  const formContext = useMemo(() => {
    const formValues = form.watch();
    return {
      ...formValues,
      caseContext,
      formData: formValues,
    };
  }, [form, caseContext]);

  // Create submission orchestrator
  const orchestrator = useMemo(() => createSubmissionOrchestrator(), []);

  // Create submit handler with payload/response tracking
  const handleSubmitWithTracking = useCallback(async (e?: React.BaseSyntheticEvent) => {
    if (!mergedDescriptor) {
      return;
    }

    // Get current form values
    const formValues = form.getValues();
    
    // Check if form data contains File objects
    const { hasFileObjects } = await import('@/utils/submission-orchestrator');
    const containsFiles = hasFileObjects(formValues as Partial<FormData>);

    // Evaluate payload template
    const evaluatedPayload = evaluatePayloadTemplate(
      mergedDescriptor.submission.payloadTemplate,
      formValues as Partial<FormData>
    );

    // Construct request body
    let requestBody: string | FormData;
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
      mergedDescriptor.submission,
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

    // Call the submit handler
    await submitHandler(e);
  }, [form, mergedDescriptor, orchestrator, onSubmissionStateChange]);

  // Prepare props for presentation component
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

const mapStateToProps = (state: RootState): StateProps => {
  const formState = getFormState(state);
  return {
    mergedDescriptor: formState.mergedDescriptor,
    visibleBlocks: getVisibleBlocks(state),
    visibleFields: getVisibleFields(state),
    caseContext: formState.caseContext,
    isRehydrating: formState.isRehydrating,
    formData: formState.formData,
    dataSourceCache: formState.dataSourceCache,
  };
};

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
)(FormContainerWithSubmissionComponent) as ComponentType<FormContainerWithSubmissionProps>;
