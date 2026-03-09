// Central font-size constants for the reading interface.
// BASE_FONT_SIZE is the single value to adjust for user text-size preference — all derived constants update automatically.
export const BASE_FONT_SIZE = 16;
export const BODY_LINE_HEIGHT = BASE_FONT_SIZE * 1.5;   // 1.5× — standard comfortable reading line height
export const SMALL_FONT_SIZE = BASE_FONT_SIZE - 2;      // small text: author lines, labels, metadata
export const SMALL_LINE_HEIGHT = SMALL_FONT_SIZE * 1.5; // 1.5× line height for small text
export const TITLE_FONT_SIZE = BASE_FONT_SIZE + 4;      // document title — proportional to body size
