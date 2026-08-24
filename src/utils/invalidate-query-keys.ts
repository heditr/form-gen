/**
 * Invalidate descriptor-configured TanStack Query keys after a successful popin submit.
 *
 * Query keys use prefix matching (exact is not set). String segments may be Handlebars
 * templates evaluated with formContext; number segments are passed through.
 */

import type { QueryClient } from '@tanstack/react-query';
import { evaluateTemplate, type FormContext } from './template-evaluator';

export type QueryKeySegment = string | number;

function evaluateQueryKeySegment(
  segment: QueryKeySegment,
  formContext: FormContext
): QueryKeySegment {
  if (typeof segment === 'number') {
    return segment;
  }
  return evaluateTemplate(segment, formContext);
}

export async function invalidateConfiguredQueryKeys({
  queryClient,
  queryKeys,
  formContext,
}: {
  queryClient: Pick<QueryClient, 'invalidateQueries'>;
  queryKeys?: Array<Array<QueryKeySegment>>;
  formContext: FormContext;
}): Promise<void> {
  if (!queryKeys || queryKeys.length === 0) {
    return;
  }

  await Promise.all(
    queryKeys.map((queryKey) => {
      const evaluatedKey = queryKey.map((segment) =>
        evaluateQueryKeySegment(segment, formContext)
      );
      return queryClient.invalidateQueries({ queryKey: evaluatedKey });
    })
  );
}
