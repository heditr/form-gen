/**
 * Tests for the list sum behind a repeat-once progress bar.
 *
 * The root list and a child list are totaled on their own. A child array
 * sitting on a root row is not part of the root sum.
 */

import { describe, test, expect } from 'vitest';
import { progressFillPercent, sumRowField } from './progress-sum';

describe('sumRowField', () => {
  test('given root rows and one child list, should total each list on its own', () => {
    const rootRows = [
      { sector: 'holding', percentage: 70, subsectors: [{ percentage: 40 }] },
      { sector: 'retail', percentage: 30 },
    ];
    const childRows = [{ percentage: 40 }, { percentage: '10' }];

    expect(sumRowField(rootRows, 'percentage')).toBe(100);
    expect(sumRowField(childRows, 'percentage')).toBe(50);
  });

  test('given missing or non-numeric values, should count them as zero', () => {
    expect(sumRowField(undefined, 'percentage')).toBe(0);
    expect(sumRowField([], 'percentage')).toBe(0);
    expect(sumRowField([{ percentage: 'nope' }, {}, { percentage: null }], 'percentage')).toBe(0);
  });
});

describe('progressFillPercent', () => {
  test('given a sum past the maximum, should clamp the bar width and leave the scale at 100', () => {
    expect(progressFillPercent(40, 100)).toBe(40);
    expect(progressFillPercent(150, 100)).toBe(100);
    expect(progressFillPercent(-5, 100)).toBe(0);
  });
});
