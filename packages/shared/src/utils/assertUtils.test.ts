import { check, checkIsDefined, checkIsUndefined } from './assertUtils';

test('Check statement expect correct', () => {
  check(true);
  check(1);
  check('a');
  check({});
});

test('Check statement expect failed', () => {
  expect(() => check(false)).toThrow('Invalid statement');
  expect(() => check(0)).toThrow('Invalid statement');
  expect(() => check('')).toThrow('Invalid statement');
  expect(() => check(null)).toThrow('Invalid statement');
  expect(() => check(undefined)).toThrow('Invalid statement');
});

test('Throw custom error', () => {
  expect(() => check(false, 'Something wrong here')).toThrow(
    'Something wrong here',
  );
  expect(() => check(false, new Error('Something wrong here'))).toThrow(
    'Something wrong here',
  );
});

test('check is defined', () => {
  const hold: any = { a: 1, b: undefined };

  expect(checkIsDefined(hold.a)).toBe(1);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  expect(() => checkIsDefined(hold.b)).toThrow(
    'Expect defined but actually undefined',
  );
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  expect(() => checkIsDefined(hold.c)).toThrow(
    'Expect defined but actually undefined',
  );
});

test('check is undefined', () => {
  const hold: any = { a: 1, b: undefined };

  checkIsUndefined(hold.b);
  checkIsUndefined(hold.c);
  expect(() => checkIsUndefined(hold.a)).toThrow(
    'Expect undefined but actually 1',
  );
});
