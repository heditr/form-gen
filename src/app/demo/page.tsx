'use client';

/**
 * Demo Page - Re-hydration Showcase
 * 
 * Comprehensive demo page that showcases the form engine's re-hydration process.
 * Displays form state, re-hydration status, and allows interactive testing.
 */

import { useState, useCallback, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import FormContainer from '@/components/form-container';
import { useGlobalDescriptor } from '@/hooks/use-form-query';
import { getFormState, initializeCaseContextFromPrefill, updateCaseContextValues } from '@/store/form-dux';
import type { RootState } from '@/store/form-dux';
import type { AppDispatch } from '@/store/store';
import { Button } from '@/components/ui/button';

export default function DemoPage() {
  const dispatch = useDispatch<AppDispatch>();
  const formState = useSelector((state: RootState) => getFormState(state));
  const [showDebug, setShowDebug] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<Record<string, unknown> | null>(null);

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
    setSubmissionResult(null);
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
              <FormContainer />
            </div>

            {/* Submission Results */}
            {submissionResult && (
              <div className="mt-6 bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-semibold mb-4">Submission Result</h2>
                <pre className="bg-gray-50 p-4 rounded overflow-auto text-sm">
                  {JSON.stringify(submissionResult, null, 2)}
                </pre>
              </div>
            )}
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
