import { recentLogBytes } from './recentLogBytes';

describe('recent log byte boundary', () => {
  it.each([
    ['old\r\n日志🙂\r\n', 12, '日志🙂\r\n'],
    ['old\r\n日志🙂\r\n', 13, '日志🙂\r\n'],
    ['old\r\n日志🙂\r\n', 11, ''],
    ['old\nnew', 3, 'new'],
    ['old\nnew', 4, 'new'],
    ['old\nnew', 2, ''],
    ['old\nnew', 0, ''],
    ['old\nnew', 7, 'old\nnew'],
  ])(
    'preserves complete suffixes for %j with %i bytes',
    (source, limit, expected) => {
      const bytes = recentLogBytes(new TextEncoder().encode(source), limit);
      expect(bytes.byteLength).toBeLessThanOrEqual(limit);
      expect(new TextDecoder('utf-8', { fatal: true }).decode(bytes)).toBe(
        expected,
      );
    },
  );
});
