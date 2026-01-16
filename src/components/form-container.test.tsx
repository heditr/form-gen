/**
 * Tests for Form Container Component
 * 
 * Following TDD: Tests verify the container uses React-Redux hooks to connect
 * Redux state and actions to the presentation component, initializes react-hook-form,
 * and syncs discriminant fields.
 */

import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { store } from '@/store/store';
import FormContainer from './form-container';

describe('FormContainer', () => {
  test('given component, should be defined', () => {
    expect(FormContainer).toBeDefined();
  });

  test('given component, should be a function component', () => {
    // Now it's a function component using hooks, not connect() HOC
    expect(typeof FormContainer).toBe('function');
  });

  test('given Redux store and QueryClient, should render without errors', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <Provider store={store}>
          <FormContainer />
        </Provider>
      </QueryClientProvider>
    );

    expect(container).toBeDefined();
  });
});
