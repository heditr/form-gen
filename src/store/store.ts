/**
 * Redux store configuration
 * 
 * Creates root reducer and configures store with redux-saga middleware
 */

import { createStore, combineReducers, applyMiddleware, Store } from 'redux';
import createSagaMiddleware from 'redux-saga';
import { reducer as formReducer, slice as formSlice, type FormState, type RootState } from './form-dux';

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

// Export saga middleware for running sagas (will be used in next task)
export { sagaMiddleware };
