/**
 * Statistical Utilities for Monte Carlo Testing
 *
 * Provides functions for statistical analysis of probability distributions,
 * confidence intervals, and goodness-of-fit tests.
 */

/**
 * Calculate binomial confidence interval using Wilson score method
 *
 * More accurate than normal approximation for small samples or extreme probabilities.
 *
 * @param successes - Number of successful trials
 * @param trials - Total number of trials
 * @param confidenceLevel - Confidence level (0.95 for 95%, 0.99 for 99%)
 * @returns Confidence interval bounds and mean
 */
export function binomialConfidenceInterval(
  successes: number,
  trials: number,
  confidenceLevel: number = 0.95
): { lower: number; upper: number; mean: number } {
  if (trials === 0) {
    return { lower: 0, upper: 1, mean: 0 };
  }

  const p = successes / trials;
  const z =
    confidenceLevel === 0.95 ? 1.96 : confidenceLevel === 0.99 ? 2.576 : 1.96;

  const denominator = 1 + (z * z) / trials;
  const center = p + (z * z) / (2 * trials);
  const spread =
    z * Math.sqrt((p * (1 - p)) / trials + (z * z) / (4 * trials * trials));

  return {
    lower: Math.max(0, (center - spread) / denominator),
    upper: Math.min(1, (center + spread) / denominator),
    mean: p,
  };
}

/**
 * Calculate empirical expected value from results
 *
 * @param results - Array of bet/payout pairs
 * @returns Expected value (payout / bet ratio)
 */
export function calculateEmpiricalEV(
  results: Array<{ bet: number; payout: number }>
): number {
  if (results.length === 0) return 0;

  const totalBet = results.reduce((sum, r) => sum + r.bet, 0);
  const totalPayout = results.reduce((sum, r) => sum + r.payout, 0);

  return totalBet === 0 ? 0 : totalPayout / totalBet;
}

/**
 * Verify empirical EV matches theoretical within confidence interval
 *
 * @param empiricalEV - Observed EV from trials
 * @param theoreticalEV - Expected EV from theory
 * @param trials - Number of trials
 * @param confidenceLevel - Confidence level
 * @returns Whether EV is within CI and statistics
 */
export function verifyEV(
  empiricalEV: number,
  theoreticalEV: number,
  trials: number,
  confidenceLevel: number = 0.95
): { withinCI: boolean; difference: number; ciWidth: number; zScore: number } {
  // Estimate standard error (simplified - assumes unit variance)
  // In reality, variance depends on payout distribution
  const variance = 1; // Simplified assumption
  const z = confidenceLevel === 0.95 ? 1.96 : 2.576;
  const se = Math.sqrt(variance / trials);
  const ciWidth = z * se;

  const difference = Math.abs(empiricalEV - theoreticalEV);
  const withinCI = difference <= ciWidth;
  const zScore = difference / se;

  return { withinCI, difference, ciWidth, zScore };
}

/**
 * Chi-squared goodness-of-fit test
 *
 * Tests whether observed distribution matches expected distribution.
 *
 * @param observed - Observed counts for each category
 * @param expected - Expected counts for each category
 * @returns Test statistic, p-value, and pass/fail
 */
export function chiSquaredTest(
  observed: number[],
  expected: number[]
): {
  statistic: number;
  pValue: number;
  passesTest: boolean;
  degreesOfFreedom: number;
} {
  if (observed.length !== expected.length) {
    throw new Error("Observed and expected arrays must have same length");
  }

  let chiSq = 0;
  for (let i = 0; i < observed.length; i++) {
    if (expected[i] === 0) continue; // Skip if expected is 0
    const diff = observed[i] - expected[i];
    chiSq += (diff * diff) / expected[i];
  }

  const df = observed.length - 1;
  const pValue = 1 - chiSquaredCDF(chiSq, df);

  return {
    statistic: chiSq,
    pValue,
    passesTest: pValue > 0.05, // 5% significance level
    degreesOfFreedom: df,
  };
}

/**
 * Chi-squared cumulative distribution function
 *
 * @param x - Value
 * @param df - Degrees of freedom
 * @returns CDF value
 */
function chiSquaredCDF(x: number, df: number): number {
  if (x < 0) return 0;
  if (x === 0) return 0;

  // Use incomplete gamma function
  return incompleteGamma(df / 2, x / 2);
}

/**
 * Incomplete gamma function (regularized)
 *
 * Uses series expansion for numerical approximation.
 *
 * @param s - Shape parameter
 * @param x - Value
 * @returns Approximation of incomplete gamma
 */
function incompleteGamma(s: number, x: number): number {
  if (x === 0) return 0;
  if (x < 0 || s <= 0) return 0;

  let sum = 0;
  let term = 1 / s;

  for (let n = 0; n < 100; n++) {
    sum += term;
    term *= x / (s + n + 1);
    if (Math.abs(term) < 1e-10) break;
  }

  const result = sum * Math.exp(-x) * Math.pow(x, s);

  // Normalize by gamma function approximation
  const gamma = gammaFunction(s);

  return Math.min(1, result / gamma);
}

/**
 * Gamma function approximation using Stirling's formula
 *
 * @param z - Input value
 * @returns Gamma(z)
 */
function gammaFunction(z: number): number {
  if (z === 1) return 1;
  if (z === 0.5) return Math.sqrt(Math.PI);

  // Stirling's approximation for large z
  if (z > 10) {
    return Math.sqrt((2 * Math.PI) / z) * Math.pow(z / Math.E, z);
  }

  // Use reflection formula for small z
  if (z < 0.5) {
    return Math.PI / (Math.sin(Math.PI * z) * gammaFunction(1 - z));
  }

  // Lanczos approximation for intermediate values
  const g = 7;
  const coef = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];

  z -= 1;
  let x = coef[0];
  for (let i = 1; i < g + 2; i++) {
    x += coef[i] / (z + i);
  }

  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

/**
 * Calculate standard deviation
 *
 * @param values - Array of numbers
 * @returns Standard deviation
 */
export function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
  const variance =
    squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;

  return Math.sqrt(variance);
}

/**
 * Calculate percentile
 *
 * @param values - Sorted array of numbers
 * @param percentile - Percentile (0-100)
 * @returns Value at percentile
 */
export function calculatePercentile(
  values: number[],
  percentile: number
): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) return sorted[lower];

  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}
