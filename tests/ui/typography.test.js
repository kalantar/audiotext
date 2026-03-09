import {
  BASE_FONT_SIZE,
  BODY_LINE_HEIGHT,
  SMALL_FONT_SIZE,
} from '../../utils/typography';

test('BASE_FONT_SIZE is 16', () => {
  expect(BASE_FONT_SIZE).toBe(16);
});

test('BODY_LINE_HEIGHT is BASE_FONT_SIZE * 1.5', () => {
  expect(BODY_LINE_HEIGHT).toBe(BASE_FONT_SIZE * 1.5);
});

test('SMALL_FONT_SIZE is BASE_FONT_SIZE - 2', () => {
  expect(SMALL_FONT_SIZE).toBe(BASE_FONT_SIZE - 2);
});
