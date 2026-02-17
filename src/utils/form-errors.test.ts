import { describe, it, expect } from 'vitest';
import { getErrorByPath } from './form-errors';

describe('getErrorByPath', () => {
  it('returns undefined for undefined errors', () => {
    expect(getErrorByPath(undefined, 'foo')).toBeUndefined();
  });

  it('returns undefined for empty path', () => {
    expect(getErrorByPath({ foo: { message: 'x' } }, '')).toBeUndefined();
  });

  it('returns flat error by key', () => {
    const errors = { email: { message: 'Required' } };
    expect(getErrorByPath(errors, 'email')).toEqual({ message: 'Required' });
  });

  it('returns nested error by dot path', () => {
    const errors = {
      addresses: [
        { street: { message: 'Street is required' } },
      ],
    };
    expect(getErrorByPath(errors, 'addresses.0.street')).toEqual({
      message: 'Street is required',
    });
  });

  it('returns undefined when path does not exist', () => {
    const errors = { addresses: [] };
    expect(getErrorByPath(errors, 'addresses.0.street')).toBeUndefined();
  });
});
