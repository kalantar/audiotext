import { computeSwitchThreshold } from '../../App';

describe('Dynamic Stickiness Threshold', () => {
  test('returns -0.10 for first match (matchCount=0)', () => {
    expect(computeSwitchThreshold(0)).toBe(-0.10);
  });

  test('returns -0.10 for second match (matchCount=1)', () => {
    expect(computeSwitchThreshold(1)).toBe(-0.10);
  });

  test('returns -0.10 for third match (matchCount=2)', () => {
    expect(computeSwitchThreshold(2)).toBe(-0.10);
  });

  test('returns 0.15 for fourth match (matchCount=3)', () => {
    expect(computeSwitchThreshold(3)).toBe(0.15);
  });

  test('returns 0.15 for stable matches (matchCount=10)', () => {
    expect(computeSwitchThreshold(10)).toBe(0.15);
  });
});
