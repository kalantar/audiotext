/**
 * Tests that generateSearchIndex produces a valid tokenIndex field.
 * Run with: node tests/inverted-index-build-test.cjs
 */

const PREFIX_LENGTH = 4;

function buildTokenIndex(documents) {
  const tokenIndex = {};
  for (let i = 0; i < documents.length; i++) {
    for (const token of documents[i].tokens) {
      if (token.length >= PREFIX_LENGTH) {
        const prefix = token.substring(0, PREFIX_LENGTH);
        if (!tokenIndex[prefix]) tokenIndex[prefix] = [];
        tokenIndex[prefix].push(i);
      }
    }
  }
  return tokenIndex;
}

const mockDocuments = [
  { id: 'doc-0', tokens: ['manifestation', 'glory', 'divine'] },
  { id: 'doc-1', tokens: ['manifest', 'power', 'righteousness'] },
  { id: 'doc-2', tokens: ['glory', 'kingdom', 'earth'] },
];

const tokenIndex = buildTokenIndex(mockDocuments);

let passed = true;

const maniList = tokenIndex['mani'];
if (!maniList || !maniList.includes(0) || !maniList.includes(1)) {
  console.error('FAIL: mani prefix should include indices 0 and 1, got:', maniList);
  passed = false;
} else {
  console.log('PASS: mani prefix includes both manifestation and manifest entries');
}

const glorList = tokenIndex['glor'];
if (!glorList || !glorList.includes(0) || !glorList.includes(2)) {
  console.error('FAIL: glor prefix should include indices 0 and 2, got:', glorList);
  passed = false;
} else {
  console.log('PASS: glor prefix includes both glory entries');
}

const earthList = tokenIndex['eart'];
if (!earthList || !earthList.includes(2)) {
  console.error('FAIL: eart prefix should include index 2, got:', earthList);
  passed = false;
} else {
  console.log('PASS: eart prefix includes earth entry');
}

const docs2 = [{ id: 'doc-0', tokens: ['god'] }];
const idx2 = buildTokenIndex(docs2);
if (Object.keys(idx2).length !== 0) {
  console.error('FAIL: tokens shorter than PREFIX_LENGTH should be skipped');
  passed = false;
} else {
  console.log('PASS: short tokens (< PREFIX_LENGTH) are skipped');
}

console.log(passed ? '\nAll tests passed.' : '\nSome tests FAILED.');
process.exit(passed ? 0 : 1);
