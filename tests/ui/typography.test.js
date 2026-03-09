import {
  BASE_FONT_SIZE,
  BODY_LINE_HEIGHT,
  SMALL_FONT_SIZE,
  SMALL_LINE_HEIGHT,
  TITLE_FONT_SIZE,
} from '../../utils/typography';

test('BASE_FONT_SIZE is 16', () => {
  expect(BASE_FONT_SIZE).toBe(16);
});

test('BODY_LINE_HEIGHT is 24', () => {
  expect(BODY_LINE_HEIGHT).toBe(24);
});

test('BODY_LINE_HEIGHT is BASE_FONT_SIZE * 1.5', () => {
  expect(BODY_LINE_HEIGHT).toBe(BASE_FONT_SIZE * 1.5);
});

test('SMALL_FONT_SIZE is 14', () => {
  expect(SMALL_FONT_SIZE).toBe(14);
});

test('SMALL_FONT_SIZE is BASE_FONT_SIZE - 2', () => {
  expect(SMALL_FONT_SIZE).toBe(BASE_FONT_SIZE - 2);
});

test('SMALL_LINE_HEIGHT is SMALL_FONT_SIZE * 1.5', () => {
  expect(SMALL_LINE_HEIGHT).toBe(SMALL_FONT_SIZE * 1.5);
});

test('TITLE_FONT_SIZE is 20', () => {
  expect(TITLE_FONT_SIZE).toBe(20);
});

test('TITLE_FONT_SIZE is BASE_FONT_SIZE + 4', () => {
  expect(TITLE_FONT_SIZE).toBe(BASE_FONT_SIZE + 4);
});
