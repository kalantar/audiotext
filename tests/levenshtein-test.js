/**
 * Levenshtein Distance Optimization Tests
 *
 * Validates that the optimized version returns the same results as the original
 * and measures performance improvements.
 *
 * Run with: node tests/levenshtein-test.js
 */

// Original implementation (full matrix)
function levenshteinDistanceOriginal(str1, str2) {
  const m = str1.length;
  const n = str2.length;

  if (m === 0) return n;
  if (n === 0) return m;
  if (str1 === str2) return 0;

  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

// Optimized implementation (two-row + early exit)
function levenshteinDistanceOptimized(str1, str2, maxDistance = Infinity) {
  const m = str1.length;
  const n = str2.length;

  if (m === 0) return n;
  if (n === 0) return m;
  if (str1 === str2) return 0;

  if (Math.abs(m - n) > maxDistance) return maxDistance + 1;

  let prevRow = Array(n + 1).fill(0);
  let currRow = Array(n + 1).fill(0);

  for (let j = 0; j <= n; j++) prevRow[j] = j;

  for (let i = 1; i <= m; i++) {
    currRow[0] = i;
    let minInRow = i;

    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1,
        currRow[j - 1] + 1,
        prevRow[j - 1] + cost
      );
      minInRow = Math.min(minInRow, currRow[j]);
    }

    if (minInRow > maxDistance) return maxDistance + 1;

    [prevRow, currRow] = [currRow, prevRow];
  }

  return prevRow[n];
}

// Test cases
const testCases = [
  { str1: 'kitten', str2: 'sitting', expected: 3 },
  { str1: 'saturday', str2: 'sunday', expected: 3 },
  { str1: 'hello', str2: 'hallo', expected: 1 },
  { str1: 'hello', str2: 'hello', expected: 0 },
  { str1: '', str2: 'test', expected: 4 },
  { str1: 'test', str2: '', expected: 4 },
  { str1: 'righteousness', str2: 'rightousness', expected: 1 },
  { str1: 'manifestation', str2: 'manifstation', expected: 1 },
  { str1: 'blessed', str2: 'blessing', expected: 2 },
  { str1: 'the', str2: 'teh', expected: 2 },
  { str1: 'love', str2: 'live', expected: 1 },
  { str1: 'faith', str2: 'fate', expected: 2 },
];

console.log('=== Levenshtein Distance Correctness Tests ===\n');

let passed = 0;
let failed = 0;

for (const { str1, str2, expected } of testCases) {
  const resultOriginal = levenshteinDistanceOriginal(str1, str2);
  const resultOptimized = levenshteinDistanceOptimized(str1, str2);

  if (resultOriginal === expected && resultOptimized === expected && resultOriginal === resultOptimized) {
    console.log(`✓ "${str1}" → "${str2}": ${resultOptimized} (expected ${expected})`);
    passed++;
  } else {
    console.log(`✗ "${str1}" → "${str2}": got ${resultOptimized}, expected ${expected} (original: ${resultOriginal})`);
    failed++;
  }
}

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);

// Early exit tests
console.log('=== Early Exit Tests (maxDistance=2) ===\n');

const earlyExitTests = [
  { str1: 'hello', str2: 'world', maxDist: 2, shouldExceed: true },
  { str1: 'hello', str2: 'hallo', maxDist: 2, shouldExceed: false },
  { str1: 'manifestation', str2: 'manifstation', maxDist: 2, shouldExceed: false },
  { str1: 'righteousness', str2: 'wrong', maxDist: 2, shouldExceed: true },
];

for (const { str1, str2, maxDist, shouldExceed } of earlyExitTests) {
  const result = levenshteinDistanceOptimized(str1, str2, maxDist);
  const exceeds = result > maxDist;

  if (exceeds === shouldExceed) {
    console.log(`✓ "${str1}" → "${str2}" (maxDist=${maxDist}): ${exceeds ? 'exceeds' : 'within'} threshold`);
  } else {
    console.log(`✗ "${str1}" → "${str2}" (maxDist=${maxDist}): expected ${shouldExceed ? 'exceed' : 'within'}, got ${exceeds ? 'exceed' : 'within'}`);
  }
}

// Performance benchmark
console.log('\n=== Performance Benchmark ===\n');

const benchmarkPairs = [];
const words = ['righteousness', 'manifestation', 'blessed', 'glory', 'kingdom', 'divine', 'spiritual', 'eternal', 'truth', 'wisdom'];

// Generate 1000 random word pairs
for (let i = 0; i < 1000; i++) {
  const word1 = words[Math.floor(Math.random() * words.length)];
  const word2 = words[Math.floor(Math.random() * words.length)];
  benchmarkPairs.push([word1, word2]);
}

console.log(`Running 1000 comparisons...\n`);

// Benchmark original
const startOriginal = performance.now();
for (const [str1, str2] of benchmarkPairs) {
  levenshteinDistanceOriginal(str1, str2);
}
const timeOriginal = performance.now() - startOriginal;

// Benchmark optimized (no maxDistance)
const startOptimizedNoMax = performance.now();
for (const [str1, str2] of benchmarkPairs) {
  levenshteinDistanceOptimized(str1, str2);
}
const timeOptimizedNoMax = performance.now() - startOptimizedNoMax;

// Benchmark optimized (with maxDistance=2)
const startOptimizedWithMax = performance.now();
for (const [str1, str2] of benchmarkPairs) {
  levenshteinDistanceOptimized(str1, str2, 2);
}
const timeOptimizedWithMax = performance.now() - startOptimizedWithMax;

console.log(`Original implementation: ${timeOriginal.toFixed(2)}ms`);
console.log(`Optimized (no maxDistance): ${timeOptimizedNoMax.toFixed(2)}ms (${((1 - timeOptimizedNoMax / timeOriginal) * 100).toFixed(1)}% faster)`);
console.log(`Optimized (maxDistance=2): ${timeOptimizedWithMax.toFixed(2)}ms (${((1 - timeOptimizedWithMax / timeOriginal) * 100).toFixed(1)}% faster)`);

console.log('\n=== Test Complete ===');
