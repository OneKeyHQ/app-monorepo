import { formatRelativeTimeAbbr } from './dateUtils';

test('formatRelativeTimeAbbr', () => {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

  expect(formatRelativeTimeAbbr(oneMinuteAgo)).toBe('1m');
});

test('formatRelativeTimeAbbr auto-detects timestamp format', () => {
  const now = Math.floor(Date.now() / 1000);
  const oneMinuteAgo = now - 60;

  expect(formatRelativeTimeAbbr(oneMinuteAgo)).toBe('1m');
});
