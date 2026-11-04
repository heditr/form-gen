/**
 * Tests that the global-descriptor-demo route checks repeatableChild configs.
 *
 * The check runs right after the nested block check, and a failure is a 500.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/repeatable-child-validator', () => ({
  assertRepeatableChildren: vi.fn((descriptor: unknown) => descriptor),
}));

vi.mock('@/utils/nested-block-resolver', async () => {
  const actual = await vi.importActual<typeof import('@/utils/nested-block-resolver')>(
    '@/utils/nested-block-resolver'
  );
  return { ...actual, assertNestedBlocks: vi.fn(actual.assertNestedBlocks) };
});

import { GET } from './route';
import { assertRepeatableChildren } from '@/utils/repeatable-child-validator';
import { assertNestedBlocks } from '@/utils/nested-block-resolver';

const request = () => new Request('http://localhost:3000/api/form/global-descriptor-demo');

describe('GET /api/form/global-descriptor-demo repeatableChild check', () => {
  beforeEach(() => {
    vi.mocked(assertRepeatableChildren).mockClear();
    vi.mocked(assertNestedBlocks).mockClear();
  });

  test('given a valid descriptor, should run the repeatableChild check after the nested block check', async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(assertRepeatableChildren).toHaveBeenCalledTimes(1);
    expect(vi.mocked(assertNestedBlocks).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(assertRepeatableChildren).mock.invocationCallOrder[0]
    );
  });

  test('given the repeatableChild check throws, should respond 500 with the error message', async () => {
    vi.mocked(assertRepeatableChildren).mockImplementationOnce(() => {
      throw new Error('Block "x" must set repeatableChild.maxDepth to 2');
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Block "x" must set repeatableChild.maxDepth to 2');
  });
});
