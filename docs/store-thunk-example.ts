/**
 * Redux Store Configuration with Redux Toolkit and Thunk
 * 
 * This example shows how to properly configure the store for use with connect()
 * and Redux Toolkit thunks.
 */

import { configureStore } from '@reduxjs/toolkit';
import { reducer as formReducer, slice as formSlice, type RootState } from './form-dux';

/**
 * Configure Redux store with Redux Toolkit
 * 
 * Redux Toolkit includes Redux Thunk middleware by default,
 * so no need to add it manually.
 */
export const store = configureStore({
  reducer: {
    [formSlice]: formReducer,
  },
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

/**
 * ALTERNATIVE: If you're using the old Redux createStore API
 * (not recommended, but if you need it):
 * 
 * ```typescript
 * import { createStore, combineReducers, applyMiddleware } from 'redux';
 * import thunk, { ThunkAction, ThunkDispatch } from 'redux-thunk';
 * import { reducer as formReducer, slice as formSlice, type RootState } from './form-dux';
 * 
 * const rootReducer = combineReducers({
 *   [formSlice]: formReducer,
 * });
 * 
 * export const store = createStore(
 *   rootReducer,
 *   applyMiddleware(thunk)
 * );
 * 
 * export type RootState = ReturnType<typeof rootReducer>;
 * export type AppDispatch = ThunkDispatch<RootState, unknown, any>;
 * export type AppThunk<ReturnType = void> = ThunkAction<
 *   ReturnType,
 *   RootState,
 *   unknown,
 *   any
 * >;
 * ```
 */
