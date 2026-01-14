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
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;

  // Quick checks
  if (m === 0) return n;
  if (n === 0) return m;
  if (str1 === str2) return 0;

  // Create matrix
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Check if two words are similar (fuzzy match)
 */
function wordsAreSimilar(word1, word2) {
  if (word1 === word2) return true;
  if (Math.abs(word1.length - word2.length) > MAX_LEVENSHTEIN_DISTANCE) return false;

  // For short words, require exact match or distance of 1
  const maxDist = word1.length <= 4 ? 1 : MAX_LEVENSHTEIN_DISTANCE;
  return levenshteinDistance(word1, word2) <= maxDist;
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
 */
function fuzzyNgramOverlap(searchNgrams, docNgrams) {
  if (searchNgrams.length === 0 || docNgrams.length === 0) return 0;

  let matchScore = 0;

  for (const searchNgram of searchNgrams) {
    const searchWords = searchNgram.split(' ');

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

      // If most words match, count it as a partial match
      const matchRatio = wordMatches / searchWords.length;
      if (matchRatio >= 0.6) {
        matchScore += matchRatio;
        break; // Only count best match for this search n-gram
      }
    }
  }

  return searchNgrams.length > 0 ? matchScore / searchNgrams.length : 0;
}

/**
 * Find best matching document entry for given transcribed words
 *
 * @param {string[]} words - Array of transcribed words (last 10-20 words)
 * @param {Object} searchIndex - The loaded search index
 * @param {Object} context - Previous match context for continuity
 * @returns {Object|null} - Best match with score, or null if no good match
 */
export function findBestMatch(words, searchIndex, context = {}) {
  if (!searchIndex || !searchIndex.documents || words.length < 3) {
    return null;
  }

  const searchTokens = tokenize(words.join(' '));
  const searchNgrams = generateNgrams(words.map(w => w.toLowerCase()));

  let bestMatch = null;
  let bestScore = 0;
  let debugTopMatches = [];

  for (const doc of searchIndex.documents) {
    // Calculate fuzzy token overlap score
    const tokenScore = fuzzyTokenOverlap(searchTokens, doc.tokens);

    // Calculate fuzzy n-gram overlap score
    const ngramScore = fuzzyNgramOverlap(searchNgrams, doc.ngrams);

    // Continuity bonus: boost score if same document as previous match
    let continuityBonus = 0;
    if (context.previousDocId === doc.docId) {
      continuityBonus = 0.1;
      // Extra bonus if sequential paragraph
      if (context.previousParagraphNum && doc.paragraphNum === context.previousParagraphNum + 1) {
        continuityBonus = 0.2;
      }
    }

    // Weighted final score - favor token overlap for fuzzy matching
    const score = (tokenScore * 0.5) + (ngramScore * 0.3) + continuityBonus;

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
        continuityBonus
      };
    }
  }

  // Log top matches for debugging
  if (debugTopMatches.length > 0) {
    console.log('[MATCH] Top 3 candidates:', debugTopMatches.map(m =>
      `${m.docId.substring(0, 30)}(t=${m.tokenScore.toFixed(2)},n=${m.ngramScore.toFixed(2)},s=${m.score.toFixed(2)})`
    ).join(', '));
  }

  // Only return if score exceeds threshold
  if (bestScore >= MATCH_THRESHOLD) {
    return bestMatch;
  }

  console.log('[MATCH] Best score', bestScore.toFixed(3), 'below threshold', MATCH_THRESHOLD);
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
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
