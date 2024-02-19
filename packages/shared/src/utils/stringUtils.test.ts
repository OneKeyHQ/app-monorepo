import { stableStringify } from './stringUtils';

test('stableStringify', () => {
  expect(stableStringify({ a: '1', b: '2' })).toBe(
    stableStringify({ b: '2', a: '1' }),
  );
});
