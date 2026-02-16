#!/usr/bin/env node
/**
 * AI UI Review Agent
 *
 * Analyzes UI screenshots against CLAUDE.md design principles
 *
 * Usage:
 *   node tests/ui-review/review-ui.js              # Review all fixtures
 *   node tests/ui-review/review-ui.js paragraph-67  # Review specific fixture
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load design principles from CLAUDE.md
const claudeMdPath = path.join(__dirname, '../../CLAUDE.md');
const claudeMd = fs.readFileSync(claudeMdPath, 'utf8');

// Extract UI Design Principles section
const principlesMatch = claudeMd.match(/## UI Design Principles([\s\S]*?)(?=##|$)/);
const designPrinciples = principlesMatch ? principlesMatch[1] : '';

console.log('='.repeat(70));
console.log('AI UI REVIEW AGENT');
console.log('='.repeat(70));
console.log('\nDesign Principles Loaded:');
console.log(designPrinciples.substring(0, 500) + '...\n');

// Get fixture to review
const fixtureArg = process.argv[2];

console.log('='.repeat(70));
console.log('REVIEW INSTRUCTIONS');
console.log('='.repeat(70));
console.log(`
To use this AI review agent:

1. Run the app with test fixture data:
   - Load fixture in app (e.g., paragraph-67)
   - Capture screenshots at key states (loading, matched, scrolled)

2. Save screenshots to tests/ui-review/screenshots/:
   - paragraph-67-initial.png
   - paragraph-67-matched.png
   - paragraph-67-scrolled.png

3. Open Claude Code and run:
   /review-ui ${fixtureArg || '[fixture-name]'}

4. Claude will analyze screenshots against design principles and report:
   ✓ What looks correct
   ⚠️ Potential issues (severity: minor/moderate/major)
   💡 Suggestions for improvement

Design Principles to Check:
${designPrinciples}
`);

// Check for screenshots directory
const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  console.log('\n⚠️  No screenshots directory found.');
  console.log(`   Create: mkdir -p ${screenshotsDir}`);
  process.exit(0);
}

// List available screenshots
const screenshots = fs.readdirSync(screenshotsDir)
  .filter(f => f.endsWith('.png') || f.endsWith('.jpg'));

if (screenshots.length === 0) {
  console.log('\n⚠️  No screenshots found in tests/ui-review/screenshots/');
  console.log('   Add screenshots and run this script again.');
  process.exit(0);
}

console.log('\n' + '='.repeat(70));
console.log('AVAILABLE SCREENSHOTS');
console.log('='.repeat(70));
screenshots.forEach(s => console.log(`  - ${s}`));

console.log('\n✓ Ready for AI review');
console.log('  Invoke this script through Claude Code for analysis\n');
