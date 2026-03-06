const fs = require('fs');
const path = require('path');
const index = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../public/search-index.json'), 'utf8'));

if (!index.tokenIndex) {
  console.error('FAIL: tokenIndex field missing from search-index.json');
  process.exit(1);
}

const keys = Object.keys(index.tokenIndex);
console.log('tokenIndex keys:', keys.length);
console.log('Sample entry "mani":', index.tokenIndex['mani']?.slice(0, 5));
console.log('Sample entry "righ":', index.tokenIndex['righ']?.slice(0, 5));
console.log('Sample entry "glor":', index.tokenIndex['glor']?.slice(0, 5));

if (keys.length < 1000) {
  console.error('FAIL: tokenIndex seems too small, expected > 1000 keys, got:', keys.length);
  process.exit(1);
}

console.log('\nPASS: tokenIndex looks valid.');
process.exit(0);
