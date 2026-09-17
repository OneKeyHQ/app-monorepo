import { resolveOneKeyIdLastLoginMethod } from './oneKeyIdLastLoginMethod';

describe('resolveOneKeyIdLastLoginMethod', () => {
  it.each(['email', 'google', 'apple'] as const)('accepts %s', (method) => {
    expect(resolveOneKeyIdLastLoginMethod(method)).toBe(method);
  });

  it.each([
    undefined,
    null,
    '',
    'oauth',
    'wallet',
    'GOOGLE',
    1,
    { method: 'email' },
  ])('ignores invalid value %p', (method) => {
    expect(resolveOneKeyIdLastLoginMethod(method)).toBeUndefined();
  });
});
