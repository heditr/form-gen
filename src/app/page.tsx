'use client';

/**
 * Demo Page
 * 
 * Basic demo page to test form descriptor and Handlebars utilities.
 * Loads the form descriptor and renders the form container.
 */

import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import FormContainer from '@/components/form-container';
import { fetchGlobalDescriptor } from '@/store/form-sagas';

export default function Home() {
  const dispatch = useDispatch();

  // Load global descriptor on mount
  useEffect(() => {
    dispatch(fetchGlobalDescriptor());
  }, [dispatch]);

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Form Descriptor Demo</h1>
          <p className="text-gray-600">
            Testing form descriptor loading and Handlebars template evaluation
          </p>
        </header>

        <main>
          <FormContainer />
        </main>
      </div>
    </div>
  );
}
