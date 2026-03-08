/**
 * Text Matcher Utility
 *
 * Matches transcribed speech to indexed religious texts using fuzzy matching:
 * - Fuzzy token matching (Levenshtein distance)
 * - N-gram similarity
 * - Continuity bonus for same document
 */

// Minimum score threshold to consider a match valid (very low for poor speech-to-text)
const MATCH_THRESHOLD = 0.08;

// Maximum Levenshtein distance to consider words as matching
const MAX_LEVENSHTEIN_DISTANCE = 2;

// Prefix length for inverted index lookup — must match PREFIX_LENGTH in crawl-bahai-library.cjs
const PREFIX_LENGTH = 4;

// Dev mode flag and logging helper
// Use Metro's global __DEV__ if available (React Native/Expo), otherwise silent in production
function debugLog(...args) {
  if (typeof __DEV__ !== 'undefined' ? __DEV__ : false) console.log(...args);
}

// Dev-only match stats (module-level to avoid mutating the shared searchIndex object)
const _matchStats = { indexHits: 0, fallbacks: 0, totalCandidates: 0 };

// Stop words to exclude from matching
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before',
  'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
  'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now', 'that', 'this',
  'these', 'those', 'it', 'its', 'he', 'she', 'they', 'them', 'his', 'her',
  'their', 'my', 'your', 'our', 'i', 'you', 'we', 'who', 'which', 'whom'
]);

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1, str2, maxDistance = Infinity) {
  const m = str1.length;
  const n = str2.length;

  // Quick checks
  if (m === 0) return n;
  if (n === 0) return m;
  if (str1 === str2) return 0;

  // Early exit if length difference exceeds threshold
  if (Math.abs(m - n) > maxDistance) return maxDistance + 1;

  // Use only two rows instead of full matrix for memory efficiency
  let prevRow = Array(n + 1).fill(0);
  let currRow = Array(n + 1).fill(0);

  // Initialize first row
  for (let j = 0; j <= n; j++) prevRow[j] = j;

  // Fill matrix row by row
  for (let i = 1; i <= m; i++) {
    currRow[0] = i;
    let minInRow = i;  // Track minimum in current row

    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1,          // deletion
        currRow[j - 1] + 1,      // insertion
        prevRow[j - 1] + cost    // substitution
      );
      minInRow = Math.min(minInRow, currRow[j]);
    }

    // Early exit: if minimum in row exceeds threshold, no point continuing
    if (minInRow > maxDistance) return maxDistance + 1;

    // Swap rows
    [prevRow, currRow] = [currRow, prevRow];
  }

  return prevRow[n];
}

/**
 * Check if two words are similar (fuzzy match)
 */
function wordsAreSimilar(word1, word2) {
  if (word1 === word2) return true;
  if (Math.abs(word1.length - word2.length) > MAX_LEVENSHTEIN_DISTANCE) return false;

  // For short words, require exact match or distance of 1
  const maxDist = word1.length <= 4 ? 1 : MAX_LEVENSHTEIN_DISTANCE;
  return levenshteinDistance(word1, word2, maxDist) <= maxDist;
}

/**
 * Normalize and tokenize text for matching
 */
export function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

/**
 * Generate n-grams from words array
 */
export function generateNgrams(words, sizes = [3, 4, 5]) {
  const ngrams = [];
  for (const size of sizes) {
    for (let i = 0; i <= words.length - size; i++) {
      ngrams.push(words.slice(i, i + size).join(' '));
    }
  }
  return ngrams;
}

/**
 * Calculate fuzzy token overlap score
 * Returns ratio of search tokens that have a fuzzy match in document tokens
 */
function fuzzyTokenOverlap(searchTokens, docTokens) {
  if (searchTokens.length === 0 || docTokens.length === 0) return 0;

  let matchCount = 0;
  const docTokenSet = new Set(docTokens);

  for (const searchToken of searchTokens) {
    // First try exact match
    if (docTokenSet.has(searchToken)) {
      matchCount++;
      continue;
    }

    // Then try fuzzy match
    for (const docToken of docTokens) {
      if (wordsAreSimilar(searchToken, docToken)) {
        matchCount++;
        break;
      }
    }
  }

  return matchCount / searchTokens.length;
}

/**
 * Calculate fuzzy n-gram overlap score
 * Optimized with Set for exact matches and early exit
 */
function fuzzyNgramOverlap(searchNgrams, docNgrams) {
  if (searchNgrams.length === 0 || docNgrams.length === 0) return 0;

  let matchScore = 0;

  // Convert doc n-grams to Set for O(1) exact match lookup
  const docNgramSet = new Set(docNgrams);

  for (const searchNgram of searchNgrams) {
    // OPTIMIZATION 1: Try exact match first (O(1) Set lookup)
    if (docNgramSet.has(searchNgram)) {
      matchScore += 1.0;
      continue; // Early exit for this search n-gram
    }

    // OPTIMIZATION 2: Only do fuzzy matching if no exact match
    const searchWords = searchNgram.split(' ');
    let bestMatchRatio = 0;

    for (const docNgram of docNgrams) {
      const docWords = docNgram.split(' ');

      if (searchWords.length !== docWords.length) continue;

      // Count how many words in the n-gram match (fuzzy)
      let wordMatches = 0;
      for (let i = 0; i < searchWords.length; i++) {
        if (wordsAreSimilar(searchWords[i], docWords[i])) {
          wordMatches++;
        }
      }

      const matchRatio = wordMatches / searchWords.length;

      // OPTIMIZATION 3: Early exit if we find a perfect match
      if (matchRatio === 1.0) {
        bestMatchRatio = 1.0;
        break;
      }

      bestMatchRatio = Math.max(bestMatchRatio, matchRatio);
    }

    // Only count if match ratio >= 0.6
    if (bestMatchRatio >= 0.6) {
      matchScore += bestMatchRatio;
    }
  }

  return searchNgrams.length > 0 ? matchScore / searchNgrams.length : 0;
}

/**
 * Compute token signature for pre-screening
 * Uses first 2 characters of each token for fast approximate matching
 */
function computeTokenSignature(tokens) {
  const signature = new Set();
  for (const token of tokens) {
    if (token.length >= 2) {
      signature.add(token.substring(0, 2));
    }
  }
  return signature;
}

/**
 * Check if document has minimal token overlap for pre-screening
 * Returns true if document should be considered (>= threshold signature overlap).
 * Default threshold is 0.15 but the linear fallback call site passes 0.10.
 */
function hasMinimalOverlap(searchSignature, docTokens, threshold = 0.15) {
  if (searchSignature.size === 0) return false;

  let matchCount = 0;
  for (const token of docTokens) {
    if (token.length >= 2 && searchSignature.has(token.substring(0, 2))) {
      matchCount++;
    }
  }

  return (matchCount / searchSignature.size) >= threshold;
}

// Candidates processed per chunk before yielding the event loop.
// Each candidate takes ~3-5ms on Hermes; 50 candidates ≈ 150-250ms per chunk.
// Yielding allows queued bridge events (e.g. Stop button press) to run between chunks.
const PASS2_CHUNK_SIZE = 50;

/**
 * Find best matching document entry for given transcribed words
 *
 * @param {string[]} words - Array of transcribed words from the sliding window (typically ~45 words). Returns null if fewer than 8 words are provided.
 * @param {Object} searchIndex - The loaded search index
 * @param {Object} context - Previous match context for continuity
 * @param {Object|null} prediction - Optional temporal prediction from match history
 * @param {Object|null} cancelToken - Optional {cancelled: boolean} ref; set cancelled=true to abort mid-match
 * @returns {Promise<Object|null>} - Best match with score, or null if no good match
 */
export async function findBestMatch(words, searchIndex, context = {}, prediction = null, cancelToken = null) {
  if (!searchIndex || !searchIndex.documents || words.length < 8) {
    return null;
  }

  const searchTokens = tokenize(words.join(' '));
  const searchNgrams = generateNgrams(words.map(w => w.toLowerCase()));

  // PASS 1: Prefix index lookup — fast path when tokenIndex is available
  // Falls back to linear pre-screening scan for old index files without tokenIndex.
  // NOTE: tokens shorter than PREFIX_LENGTH (4 chars) are skipped by the index path.
  // Passages composed mostly of short meaningful words (e.g. "O God thy mercy")
  // may produce zero candidates and return null even when a match exists.
  // This is a known limitation; the 45-word window makes it rare in practice.
  let candidates;

  if (searchIndex.tokenIndex) {
    // Count how many query prefixes each candidate matches.
    // Require MIN_PREFIX_MATCHES to qualify — reduces Pass 2 candidates from
    // thousands (any 1 shared prefix) to hundreds (2+ shared prefixes), which
    // is critical on Hermes/JSC where fuzzy matching is much slower than V8.
    const MIN_PREFIX_MATCHES = 2;
    const candidateCounts = new Map();
    for (const token of searchTokens) {
      if (token.length >= PREFIX_LENGTH) {
        const prefix = token.substring(0, PREFIX_LENGTH);
        const list = searchIndex.tokenIndex[prefix];
        if (list) {
          for (const i of list) {
            candidateCounts.set(i, (candidateCounts.get(i) || 0) + 1);
          }
        }
      }
    }
    candidates = [];
    for (const [i, count] of candidateCounts) {
      if (count >= MIN_PREFIX_MATCHES) candidates.push(searchIndex.documents[i]);
    }
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      _matchStats.indexHits++;
      _matchStats.totalCandidates += candidates.length;
      debugLog('[MATCH] Pass 1 (index): ' + candidates.length + ' candidates | hits=' + _matchStats.indexHits + ' fallbacks=' + _matchStats.fallbacks + ' avgCandidates=' + (_matchStats.totalCandidates / _matchStats.indexHits).toFixed(0));
    }
  } else {
    const searchSignature = computeTokenSignature(searchTokens);
    candidates = searchIndex.documents.filter(doc => hasMinimalOverlap(searchSignature, doc.tokens, 0.10));
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      _matchStats.fallbacks++;
      debugLog('[MATCH] Pass 1 (linear fallback): ' + candidates.length + ' candidates | hits=' + _matchStats.indexHits + ' fallbacks=' + _matchStats.fallbacks);
    }
  }

  // PASS 2: Detailed fuzzy matching only on candidates.
  // Processed in chunks of PASS2_CHUNK_SIZE with a yield between chunks so the JS
  // event loop can process queued bridge events (e.g. Stop button press). If cancelToken
  // is set to cancelled=true during a yield, returns null immediately.
  let bestMatch = null;
  let bestScore = 0;
  let debugTopMatches = [];

  for (let idx = 0; idx < candidates.length; idx++) {
    if (idx > 0 && idx % PASS2_CHUNK_SIZE === 0) {
      if (cancelToken?.cancelled) return null;
      await new Promise(r => setTimeout(r, 0));
      if (cancelToken?.cancelled) return null;
    }
    const doc = candidates[idx];
    // Calculate fuzzy token overlap score
    const tokenScore = fuzzyTokenOverlap(searchTokens, doc.tokens);

    // Calculate fuzzy n-gram overlap score
    const ngramScore = fuzzyNgramOverlap(searchNgrams, doc.ngrams);

    // Weighted base score - favor token overlap for fuzzy matching
    const baseScore = (tokenScore * 0.5) + (ngramScore * 0.3);

    // Continuity bonus: small boost for same document, but only if base match is decent
    let continuityBonus = 0;
    if (context.previousDocId === doc.docId && baseScore >= 0.12) {
      // Multiplicative bonus instead of fixed addition
      continuityBonus = baseScore * 0.15; // 15% boost to base score

      // Extra boost if sequential paragraph
      if (context.previousParagraphNum && doc.paragraphNum === context.previousParagraphNum + 1) {
        continuityBonus = baseScore * 0.25; // 25% boost for sequential
      }
    }

    // Temporal continuity bonus: boost nearby paragraphs if we have a prediction
    let neighborhoodBonus = 0;
    if (prediction && doc.docId === prediction.docId) {
      const distance = Math.abs(doc.paragraphNum - prediction.paragraphNum);
      if (distance <= 3) {
        neighborhoodBonus = 0.10;
        // Stronger bonus for exact predicted paragraph
        if (doc.paragraphNum === prediction.paragraphNum) {
          neighborhoodBonus = 0.15;
        }
      }
    }

    // Final score with continuity bonus
    const score = baseScore + continuityBonus + neighborhoodBonus;

    // Track top matches for debugging
    if (debugTopMatches.length < 3 || score > debugTopMatches[debugTopMatches.length - 1]?.score) {
      debugTopMatches.push({ docId: doc.docId, score, tokenScore, ngramScore });
      debugTopMatches.sort((a, b) => b.score - a.score);
      debugTopMatches = debugTopMatches.slice(0, 3);
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = {
        ...doc,
        score,
        tokenScore,
        ngramScore,
        continuityBonus,
        neighborhoodBonus
      };
    }
  }

  // Log top matches for debugging
  if (debugTopMatches.length > 0) {
    debugLog('[MATCH] Top 3 candidates:', debugTopMatches.map(m =>
      `${m.docId.substring(0, 30)}(t=${m.tokenScore.toFixed(2)},n=${m.ngramScore.toFixed(2)},s=${m.score.toFixed(2)})`
    ).join(', '));
  }

  // Only return if score exceeds threshold
  if (bestScore >= MATCH_THRESHOLD) {
    return bestMatch;
  }

  debugLog('[MATCH] Best score', bestScore.toFixed(3), 'below threshold', MATCH_THRESHOLD);
  return null;
}

/**
 * Find the position of matched text within full document content
 *
 * @param {string} fullText - The full text of the verse/paragraph
 * @param {string[]} searchWords - The words we're looking for
 * @returns {Object} - Start and end character positions for highlighting
 */
export function findHighlightPosition(fullText, searchWords) {
  const normalizedText = fullText.toLowerCase();
  const searchPhrase = searchWords.join(' ').toLowerCase();

  // Try exact phrase match first
  let startIndex = normalizedText.indexOf(searchPhrase);

  if (startIndex === -1) {
    // Try finding longest matching substring
    const words = searchWords.map(w => w.toLowerCase());

    // Try progressively shorter phrases
    for (let len = words.length; len >= 3; len--) {
      for (let start = 0; start <= words.length - len; start++) {
        const phrase = words.slice(start, start + len).join(' ');
        const idx = normalizedText.indexOf(phrase);
        if (idx !== -1) {
          startIndex = idx;
          break;
        }
      }
      if (startIndex !== -1) break;
    }
  }

  // If still not found, try finding individual significant words
  if (startIndex === -1) {
    const significantWords = searchWords
      .map(w => w.toLowerCase())
      .filter(w => w.length > 4 && !STOP_WORDS.has(w));

    for (const word of significantWords) {
      const idx = normalizedText.indexOf(word);
      if (idx !== -1) {
        startIndex = idx;
        break;
      }
    }
  }

  // If still not found, default to beginning
  if (startIndex === -1) {
    startIndex = 0;
  }

  // Calculate end position
  const highlightLength = Math.min(searchWords.join(' ').length, 200);
  const endIndex = Math.min(startIndex + highlightLength, fullText.length);

  return {
    start: startIndex,
    end: endIndex,
    contextStart: Math.max(0, startIndex - 150),
    contextEnd: Math.min(fullText.length, endIndex + 150)
  };
}

/**
 * Get document metadata from index
 */
export function getDocumentMetadata(searchIndex, docId) {
  return searchIndex?.metadata?.[docId] || null;
}

/**
 * Debounce helper for matching calls
 */
export function debounce(func, wait) {
  let timeout;
  function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  }
  executedFunction.cancel = () => { clearTimeout(timeout); timeout = null; };
  return executedFunction;
}
