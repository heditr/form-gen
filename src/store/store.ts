/**
 * Redux store configuration
 * 
 * Creates root reducer and configures store with Redux Toolkit.
 * Redux Toolkit includes Redux Thunk middleware by default.
 */

import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { reducer as formReducer, slice as formSlice, type RootState as FormRootState } from './form-dux';

/**
 * Root reducer combining all slices
 * 
 * Exported for testing purposes
 */
export const rootReducer = combineReducers({
  [formSlice]: formReducer,
});

/**
 * Configure Redux store with Redux Toolkit
 * 
 * Redux Toolkit includes Redux Thunk middleware by default,
 * so no need to add it manually.
 */
export const store = configureStore({
  reducer: rootReducer,
  // Redux Thunk is included by default in Redux Toolkit
  // No need to add middleware manually
});

/**
 * Export types for use with connect() and hooks
 * 
 * These types are essential for proper TypeScript typing when using:
 * - connect() with mapDispatchToProps
 * - useSelector and useDispatch hooks
 */
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
