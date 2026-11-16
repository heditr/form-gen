/**
 * Tests that the global-descriptor route checks repeatOnce fields.
 *
 * The check runs after the repeatableChild check, and a failure is a 500.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/repeat-once-validator', () => ({
  assertRepeatOnce: vi.fn((descriptor: unknown) => descriptor),
}));

vi.mock('@/utils/repeatable-child-validator', () => ({
  assertRepeatableChildren: vi.fn((descriptor: unknown) => descriptor),
}));

import { GET } from './route';
import { assertRepeatOnce } from '@/utils/repeat-once-validator';
import { assertRepeatableChildren } from '@/utils/repeatable-child-validator';

const request = () => new Request('http://localhost:3000/api/form/global-descriptor');

describe('GET /api/form/global-descriptor repeatOnce check', () => {
  beforeEach(() => {
    vi.mocked(assertRepeatOnce).mockClear();
    vi.mocked(assertRepeatableChildren).mockClear();
  });

  test('given a valid descriptor, should run the repeatOnce check after the repeatableChild check', async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(assertRepeatOnce).toHaveBeenCalledTimes(1);
    expect(vi.mocked(assertRepeatableChildren).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(assertRepeatOnce).mock.invocationCallOrder[0]
    );
  });

  test('given an invalid repeatOnce descriptor, should respond 500', async () => {
    vi.mocked(assertRepeatOnce).mockImplementationOnce(() => {
      throw new Error('Field "country" on block "addresses-block" sits between grouped fields');
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Field "country" on block "addresses-block" sits between grouped fields');
  });
});
