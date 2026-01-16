'use client';

/**
 * Providers Component
 * 
 * Wraps the app with Redux Provider, TanStack Query Provider, and initializes Handlebars helpers.
 * This must be a client component since Redux, TanStack Query, and Handlebars need to run on the client.
 */

import { useEffect } from 'react';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { store } from '@/store/store';
import { registerHandlebarsHelpers } from '@/utils/handlebars-helpers';

/**
 * Initialize Handlebars helpers on client side
 */
function HandlebarsInitializer() {
  useEffect(() => {
    registerHandlebarsHelpers();
  }, []);

  return null;
}

/**
 * Create QueryClient instance
 * 
 * Configured with default options for form descriptor engine:
 * - Retry disabled for faster error feedback
 * - Refetch on window focus disabled (form data shouldn't auto-refetch)
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

/**
 * Redux and TanStack Query Provider wrapper
 */
export function ReduxProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <HandlebarsInitializer />
        {children}
      </Provider>
    </QueryClientProvider>
  );
}
