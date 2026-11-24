import { getKeylessEntry, getKeylessSite } from './entry';

const local = 'http://127.0.0.1:3003';
const testSite = 'https://app.onekeytest.com';
const production = 'https://app.onekey.so';
const path = '/keyless-deletion';

it.each([local, testSite, production])(
  'reads and decodes the official invitation fragment at %s',
  (origin) => {
    expect(
      getKeylessEntry(
        new URL(
          `${path}/#invitationToken=${encodeURIComponent('opaque+token=')}`,
          origin,
        ),
      ),
    ).toEqual({ kind: 'invitation', invitationToken: 'opaque+token=' });
  },
);

it.each([
  '#token=old-alias',
  '#fixture-example',
  '#invitationToken=',
  '#invitationToken=first&invitationToken=second',
  '#invitationToken=opaque&env=test',
  '#invitationToken=opaque&token=other',
  '#invitationToken=%GH',
  '?env=test#invitationToken=opaque',
])('rejects ambiguous or unsupported invitation syntax %s', (suffix) => {
  expect(getKeylessEntry(new URL(`${path}${suffix}`, local))).toEqual({
    kind: 'invitation',
    invitationToken: '',
  });
});

it('only enables official app origins and loopback HTTP in development', () => {
  expect(getKeylessSite(new URL(testSite))).toBe('test');
  expect(getKeylessSite(new URL(production))).toBe('prod');
  expect(getKeylessSite(new URL(local))).toBe('local');
  expect(
    getKeylessSite(new URL('https://app.onekey.so.example.invalid')),
  ).toBeUndefined();
  expect(
    getKeylessEntry(
      new URL(`${path}#invitationToken=opaque`, 'https://example.invalid'),
    ),
  ).toEqual({ kind: 'invitation', invitationToken: '' });
  const original = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    expect(getKeylessSite(new URL(local))).toBeUndefined();
    expect(
      getKeylessEntry(new URL(`${path}#invitationToken=opaque`, local)),
    ).toEqual({ kind: 'invitation', invitationToken: '' });
  } finally {
    process.env.NODE_ENV = original;
  }
});

it('leaves regular app paths and ordinary OAuth callbacks alone', () => {
  expect(getKeylessEntry(new URL('/market', local))).toBeUndefined();
  expect(
    getKeylessEntry(new URL('/oauth_callback_web/?code=example', local)),
  ).toBeUndefined();
  expect(
    getKeylessEntry(
      new URL('/oauth_callback_web/?onekey_keyless_deletion=1', local),
    ),
  ).toEqual({ kind: 'callback' });
});
