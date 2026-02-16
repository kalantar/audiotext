# AI UI Review Agent

Subjective quality assessment of UI screenshots against CLAUDE.md design principles.

## Purpose

Automated tests catch layout bugs and behavior regressions, but can't assess subjective quality like:
- "This spacing feels off"
- "Highlighting looks wrong"
- "Design principle violation"

The AI review agent analyzes screenshots and reports quality issues with severity ratings.

## Usage

### 1. Capture Screenshots

Run the app with test fixture data and capture screenshots:

```bash
# Start app
npm run web

# In browser:
# - Open debug panel
# - Paste fixture transcription text
# - Capture screenshots at key states

# Save to tests/ui-review/screenshots/:
# - [fixture-name]-initial.png
# - [fixture-name]-matched.png
# - [fixture-name]-scrolled.png
```

### 2. Run Review

```bash
node tests/ui-review/review-ui.js paragraph-67
```

Or invoke through Claude Code:
```bash
/review-ui paragraph-67
```

### 3. Review Output

Agent will report:
- ✓ What looks correct
- ⚠️ Potential issues (minor/moderate/major severity)
- 💡 Suggestions for improvement

## Design Principles Checked

From CLAUDE.md:
- Visual Consistency (uniform body text)
- Marker-Style Highlighting (background only)
- Consistent Spacing (no special spacing around highlights)
- Layout Stability (no jumps when content loads)
- Inline Content Flow (highlights inline with text)

## When to Use

- Before committing UI changes
- After fixing visual bugs
- When making spacing/layout changes
- During UI feature development

**Not in CI** - This is a development-time tool, not a build gate.

## Fixtures to Review

Priority fixtures for UI testing:
- paragraph-67 - Short phrase, spacing test
- long-text-epistle-mid-paragraph - Long passage layout
- common-phrase-o-son-of-arabic-1 - Disambiguation UI
- short-prayer-with-noise - Minimum threshold UX
