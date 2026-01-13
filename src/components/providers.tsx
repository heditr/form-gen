'use client';

/**
 * Providers Component
 * 
 * Wraps the app with Redux Provider and initializes Handlebars helpers.
 * This must be a client component since Redux and Handlebars need to run on the client.
 */

import { useEffect } from 'react';
import { Provider } from 'react-redux';
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
 * Redux Provider wrapper
 */
export function ReduxProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <HandlebarsInitializer />
      {children}
    </Provider>
  );
}
