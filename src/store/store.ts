/**
 * Redux store configuration
 * 
 * Creates root reducer and configures store with redux-saga middleware
 */

import { createStore, combineReducers, applyMiddleware, Store } from 'redux';
import createSagaMiddleware from 'redux-saga';
import { reducer as formReducer, slice as formSlice, type FormState, type RootState } from './form-dux';
import { formSagas } from './form-sagas';

// Root reducer combining all slices
export const rootReducer = combineReducers({
  [formSlice]: formReducer,
});

// Create saga middleware
const sagaMiddleware = createSagaMiddleware();

// Configure store with saga middleware
export const store: Store<RootState> = createStore(
  rootReducer,
  applyMiddleware(sagaMiddleware)
);

// Run form sagas
sagaMiddleware.run(formSagas);

// Export saga middleware for running additional sagas if needed
export { sagaMiddleware };
