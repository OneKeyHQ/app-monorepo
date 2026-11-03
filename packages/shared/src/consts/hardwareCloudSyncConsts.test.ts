import {
  assertHardwareCloudSyncAuthContext,
  buildHardwareCloudSyncAuthMessage,
  buildHardwareCloudSyncMessage,
  getHardwareCloudSyncIdentityTagFromCredentialId,
  parseHardwareCloudSyncAuthMessage,
} from './hardwareCloudSyncConsts';

const identityTag = '0123456789abcdef';
const salt = '00112233445566778899aabbccddeeff';
// RFC 9449 section 6.1, Figure 9 (public example key).
const jkt = '0ZcOCORZNYy-DWpqq30jZyJGHTN0d2HglBV3uiguA4I';
const context = { identityTag, jkt, env: 'prod' as const };
const expires = '2026-11-03T08:00:00.000Z';
const now = Date.parse('2026-11-03T07:55:00.000Z');
const nonce = salt.repeat(2);
const keyMessage =
  'WARNING: Sign ONLY in OneKey App. NEVER in other apps or dApps. Signing unlocks ALL your OneKey Cloud data. >>> type=onekey-cloud-key;v=1;wallet=0123456789abcdef;salt=00112233445566778899aabbccddeeff';
const authMessage =
  'WARNING: Sign ONLY in OneKey App. NEVER in other apps or dApps. Signing approves OneKey Cloud sign-in. >>> type=onekey-cloud-signin;v=1;service=onekey-cloud-sync;env=prod;wallet=0123456789abcdef;nonce=00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff;session=0ZcOCORZ;jkt=0ZcOCORZNYy-DWpqq30jZyJGHTN0d2HglBV3uiguA4I;expires=2026-11-03T08:00:00.000Z';

describe('hardware Cloud sync final v1 message contract', () => {
  test('freezes the Jira vectors as 199 and 363 printable ASCII bytes', () => {
    expect(buildHardwareCloudSyncMessage(identityTag, salt)).toBe(keyMessage);
    expect(
      buildHardwareCloudSyncAuthMessage({ ...context, nonce, expires }),
    ).toBe(authMessage);
    expect(Buffer.byteLength(keyMessage, 'utf8')).toBe(199);
    expect(Buffer.byteLength(authMessage, 'utf8')).toBe(363);
    for (const message of [keyMessage, authMessage]) {
      expect(message).toMatch(/^[\x20-\x7e]+$/);
      expect(message.split(' >>> ')).toHaveLength(2);
    }
    expect(parseHardwareCloudSyncAuthMessage(authMessage)).toEqual({
      ...context,
      nonce,
      session: jkt.slice(0, 8),
      expires,
    });
    expect(
      assertHardwareCloudSyncAuthContext(authMessage, context, now),
    ).toMatchObject(context);
  });

  test.each([
    [
      'legacy draft',
      `OneKey Cloud Sync sign-in\nNonce: ${nonce}\nDevice: 0ZcOCORZ\nExpires: ${expires}`,
    ],
    ['key message', keyMessage],
    ['trailing LF', `${authMessage}\n`],
    ['trailing CRLF', `${authMessage}\r\n`],
    ['tab', authMessage.replace(' >>> ', '\t>>> ')],
    ['unicode', authMessage.replace('OneKey App', 'OneKey App\u200b')],
    ['extra separator', authMessage.replace(' >>> ', ' >>>  >>> ')],
    ['extra space', authMessage.replace(';wallet=', '; wallet=')],
    ['duplicate field', authMessage.replace(';v=1', ';v=1;v=1')],
    ['extra field', `${authMessage};extra=1`],
    ['missing field', authMessage.replace(';service=onekey-cloud-sync', '')],
    [
      'reordered fields',
      authMessage.replace(
        'type=onekey-cloud-signin;v=1',
        'v=1;type=onekey-cloud-signin',
      ),
    ],
    ['unknown version', authMessage.replace(';v=1;', ';v=2;')],
    [
      'wrong type',
      authMessage.replace('type=onekey-cloud-signin', 'type=onekey-cloud-key'),
    ],
    [
      'wrong service',
      authMessage.replace('service=onekey-cloud-sync', 'service=other-service'),
    ],
    ['unknown env', authMessage.replace('env=prod', 'env=dev')],
    [
      'uppercase wallet',
      authMessage.replace(identityTag, identityTag.toUpperCase()),
    ],
    ['short nonce', authMessage.replace(nonce, salt)],
    ['uppercase nonce', authMessage.replace(nonce, nonce.toUpperCase())],
    [
      'session mismatch',
      authMessage.replace('session=0ZcOCORZ', 'session=aaaaaaaa'),
    ],
    ['padded thumbprint', authMessage.replace(`jkt=${jkt}`, `jkt=${jkt}=`)],
    [
      'short thumbprint',
      authMessage.replace(`jkt=${jkt}`, `jkt=${jkt.slice(0, 8)}`),
    ],
    [
      'nonexistent calendar date',
      authMessage.replace(expires, '2026-02-30T08:00:00.000Z'),
    ],
    ['noncanonical date', authMessage.replace(expires, '2026-11-03T08:00:00Z')],
    [
      'offset date',
      authMessage.replace(expires, '2026-11-03T08:00:00.000+00:00'),
    ],
  ])('rejects %s before signing', (_name, message) => {
    expect(() => parseHardwareCloudSyncAuthMessage(message)).toThrow(
      'Invalid Cloud sync sign-in challenge',
    );
  });

  test.each([
    ['another wallet', { ...context, identityTag: 'fedcba9876543210' }],
    ['another environment', { ...context, env: 'test' as const }],
    // The display session matches, but the full security binding differs.
    [
      'same session, another full thumbprint',
      { ...context, jkt: `${jkt.slice(0, 8)}${'a'.repeat(35)}` },
    ],
  ])('rejects %s despite a well-formed message', (_name, expected) => {
    expect(() =>
      assertHardwareCloudSyncAuthContext(authMessage, expected, now),
    ).toThrow('Invalid Cloud sync sign-in challenge');
  });

  test.each([
    Date.parse(expires),
    Date.parse(expires) + 1,
    Date.parse(expires) - 15 * 60 * 1000 - 1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])('rejects an expired, overlong or uncheckable lifetime at %s', (clock) => {
    expect(() =>
      assertHardwareCloudSyncAuthContext(authMessage, context, clock),
    ).toThrow();
  });

  test('accepts the bounded lifetime and trusted test environment', () => {
    expect(() =>
      assertHardwareCloudSyncAuthContext(
        authMessage,
        context,
        Date.parse(expires) - 15 * 60 * 1000,
      ),
    ).not.toThrow();
    expect(() =>
      assertHardwareCloudSyncAuthContext(
        authMessage.replace('env=prod', 'env=test'),
        { ...context, env: 'test' },
        now,
      ),
    ).not.toThrow();
  });

  test('rejects malformed key inputs, including a final LF', () => {
    for (const tag of [`${identityTag}\n`, identityTag.toUpperCase(), '1234']) {
      expect(() => buildHardwareCloudSyncMessage(tag, salt)).toThrow();
    }
    for (const value of [`${salt}\n`, salt.toUpperCase(), 'not-a-salt']) {
      expect(() => buildHardwareCloudSyncMessage(identityTag, value)).toThrow();
    }
    const credentialId = `hardware-cloud-v1-${identityTag}${'0'.repeat(48)}`;
    expect(getHardwareCloudSyncIdentityTagFromCredentialId(credentialId)).toBe(
      identityTag,
    );
    for (const id of [
      'hardware-cloud-v1-test',
      `${credentialId}\n`,
      credentialId.toUpperCase(),
    ]) {
      expect(() =>
        getHardwareCloudSyncIdentityTagFromCredentialId(id),
      ).toThrow();
    }
  });
});
