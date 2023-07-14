import { gtIgnore, gteIgnore, ltIgnore, lteIgnore } from './semverUtils';

test('test gteIgnore', () => {
  expect(gteIgnore('1.1.1', '1.1.1', 'patch')).toBe(true);
  expect(gteIgnore('1.1.1', '1.1.2', 'patch')).toBe(true);
  expect(gteIgnore('1.1.1', '1.2.1', 'patch')).toBe(false);

  expect(gteIgnore('1.1.1', '1.1.1', 'minor')).toBe(true);
  expect(gteIgnore('1.1.1', '1.1.2', 'minor')).toBe(true);
  expect(gteIgnore('1.1.1', '1.0.2', 'minor')).toBe(true);
  expect(gteIgnore('1.1.1', '1.2.2', 'minor')).toBe(true);
  expect(gteIgnore('0.1.1', '1.1.1', 'minor')).toBe(false);
  expect(gteIgnore('1.1.0', '0.1.1', 'minor')).toBe(true);
  expect(gteIgnore('0.1.1', '1.1.0', 'minor')).toBe(false);
});

test('test lteIgnore', () => {
  expect(lteIgnore('1.1.1', '1.1.1', 'patch')).toBe(true);
  expect(lteIgnore('1.1.1', '1.1.2', 'patch')).toBe(true);
  expect(lteIgnore('1.2.1', '1.1.1', 'patch')).toBe(false);

  expect(lteIgnore('1.1.1', '1.1.1', 'minor')).toBe(true);
  expect(lteIgnore('1.1.1', '1.1.2', 'minor')).toBe(true);
  expect(lteIgnore('1.0.1', '1.1.2', 'minor')).toBe(true);
  expect(lteIgnore('1.1.1', '1.2.2', 'minor')).toBe(true);
  expect(lteIgnore('1.1.1', '0.1.1', 'minor')).toBe(false);
  expect(lteIgnore('1.1.0', '0.1.1', 'minor')).toBe(false);
  expect(lteIgnore('0.1.1', '1.1.0', 'minor')).toBe(true);
});

test('test gtIgnore', () => {
  expect(gtIgnore('1.1.1', '1.1.1', 'patch')).toBe(false);
  expect(gtIgnore('1.1.1', '1.1.2', 'patch')).toBe(false);
  expect(gtIgnore('1.1.1', '1.2.1', 'patch')).toBe(false);
  expect(gtIgnore('1.2.1', '1.1.1', 'patch')).toBe(true);

  expect(gtIgnore('1.1.1', '1.1.1', 'minor')).toBe(false);
  expect(gtIgnore('1.1.1', '1.1.2', 'minor')).toBe(false);
  expect(gtIgnore('1.1.1', '1.0.2', 'minor')).toBe(false);
  expect(gtIgnore('1.1.1', '1.2.2', 'minor')).toBe(false);
  expect(gtIgnore('0.1.1', '1.1.1', 'minor')).toBe(false);
  expect(gtIgnore('1.1.0', '0.1.1', 'minor')).toBe(true);
  expect(gtIgnore('0.1.1', '1.1.0', 'minor')).toBe(false);
});

test('test ltIgnore', () => {
  expect(ltIgnore('1.1.1', '1.1.1', 'patch')).toBe(false);
  expect(ltIgnore('1.1.1', '1.1.2', 'patch')).toBe(false);
  expect(ltIgnore('1.1.1', '1.2.1', 'patch')).toBe(true);
  expect(ltIgnore('1.2.1', '1.1.1', 'patch')).toBe(false);

  expect(ltIgnore('1.1.1', '1.1.1', 'minor')).toBe(false);
  expect(ltIgnore('1.1.1', '1.1.2', 'minor')).toBe(false);
  expect(ltIgnore('1.1.1', '1.0.2', 'minor')).toBe(false);
  expect(ltIgnore('1.1.1', '1.2.2', 'minor')).toBe(false);
  expect(ltIgnore('0.1.1', '1.1.1', 'minor')).toBe(true);
  expect(ltIgnore('1.1.0', '0.1.1', 'minor')).toBe(false);
  expect(ltIgnore('0.1.1', '1.1.0', 'minor')).toBe(true);
});
