import {
  EBinanceDepositErrorCode,
  EBinanceDepositSessionStatus,
} from '../../../types/exchange';
import {
  BINANCE_DEPOSIT_BIND_DISABLED_RETRY_INTERVAL_MS,
  BINANCE_DEPOSIT_BIND_RETRY_INTERVAL_MS,
  BINANCE_DEPOSIT_BIND_WINDOW_MS,
  BINANCE_DEPOSIT_LOG_LIST_MAX_ITEMS,
  BINANCE_DEPOSIT_LOG_REDACTED_PLACEHOLDER,
  BINANCE_DEPOSIT_LOG_STRING_MAX_LENGTH,
  BINANCE_DEPOSIT_PARAMS_ERROR_CODE,
  BINANCE_DEPOSIT_RETURN_GRACE_MS,
  BINANCE_DEPOSIT_RETURN_MAX_OTHER_PARAM_NAMES,
  BINANCE_DEPOSIT_RETURN_NONCE_REGEX,
  BINANCE_DEPOSIT_RETURN_PARAM_NAME_PLACEHOLDER,
  BINANCE_DEPOSIT_RETURN_REASON,
  BINANCE_DEPOSIT_RETURN_RETRYABLE_REASONS,
  BINANCE_DEPOSIT_SECURE_STORAGE_KEY_REGEX,
  BINANCE_DEPOSIT_SEND_ATTEMPT_ACK_HOLD_MS,
  BINANCE_DEPOSIT_SERVICE_ERROR_CODE,
  BINANCE_DEPOSIT_SESSION_KEY_REGEX,
  EBinanceDepositLocalErrorCode,
} from '../../consts/binanceDepositConsts';
import {
  buildBinanceDepositSessionKeyStorageKey,
  canRearmBinanceDepositReport,
  compareBinanceDepositDestination,
  generateBinanceDepositSessionKey,
  getBinanceDepositAssetBlockReason,
  getBinanceDepositLocalBindDeadline,
  getBinanceDepositSendAttemptAckWaitMs,
  isBinanceDepositInProgressStatus,
  isBinanceDepositReportFinalErrorCode,
  isBinanceDepositReturnUrl,
  isBinanceDepositSessionClosed,
  isBinanceDepositSessionInProgress,
  isBinanceDepositTerminalStatus,
  maskBinanceDepositSessionId,
  maskBinanceDepositTxHash,
  parseBinanceDepositReturnUrl,
  resolveBinanceDepositBindStep,
  sanitizeBinanceDepositLogDetail,
  validateBinanceDepositLink,
} from '../binanceDepositUtils';

import type {
  IBinanceDepositAuthorizedDestination,
  IBinanceDepositBindCallResult,
  IBinanceDepositBindStepInput,
  IBinanceDepositLinkRejectReason,
  IBinanceDepositLogDetail,
  IBinanceDepositSessionView,
} from '../../../types/exchange';

const NONCE = '0123456789abcdefghijklmnopqrstuvwxyzABCDE-_';
const OTHER_NONCE = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ';
const RETURN_BASE = 'onekey-wallet://binance-connect/deposit-return';
const SESSION_ID =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('test fixtures', () => {
  it('uses nonces that match the server pattern', () => {
    expect(NONCE).toMatch(BINANCE_DEPOSIT_RETURN_NONCE_REGEX);
    expect(OTHER_NONCE).toMatch(BINANCE_DEPOSIT_RETURN_NONCE_REGEX);
  });
});

describe('isBinanceDepositReturnUrl', () => {
  it.each([
    `${RETURN_BASE}?rn=${NONCE}`,
    RETURN_BASE,
    `${RETURN_BASE}/`,
    `${RETURN_BASE}/?rn=${NONCE}`,
    `${RETURN_BASE}#section`,
    `${RETURN_BASE}?rn=${NONCE}#section`,
    `${RETURN_BASE}?`,
    `ONEKEY-WALLET://binance-connect/deposit-return?rn=${NONCE}`,
    `OneKey-Wallet://Binance-Connect/deposit-return?rn=${NONCE}`,
    // The path of an unrelated param value must not change the verdict.
    `${RETURN_BASE}?next=/other/path&rn=${NONCE}`,
  ])('accepts %s', (url) => {
    expect(isBinanceDepositReturnUrl(url)).toBe(true);
  });

  it.each([
    '',
    'onekey-wallet://',
    'onekey-wallet://binance-connect',
    `onekey-wallet://binance-connect?rn=${NONCE}`,
    'onekey-wallet://binance-connect/',
    'onekey-wallet://binance-connect/other',
    'onekey-wallet://binance-connect/deposit-return-v2',
    'onekey-wallet://binance-connect/deposit-return/extra',
    'onekey-wallet://binance-connect/deposit-return//',
    'onekey-wallet://binance-connect/Deposit-Return',
    'onekey-wallet://binance-connect/x/deposit-return',
    'onekey-wallet://binance-connect.evil/deposit-return',
    'onekey-wallet://evil/binance-connect/deposit-return',
    'onekey-wallet://user@binance-connect/deposit-return',
    'onekey-wallet://binance-connect:443/deposit-return',
    'onekey-wallet:///binance-connect/deposit-return',
    'onekey-wallet:binance-connect/deposit-return',
    'onekey-wallet:/binance-connect/deposit-return',
    'onekey://binance-connect/deposit-return',
    'onekey-wallet-x://binance-connect/deposit-return',
    'https://binance-connect/deposit-return',
    'wc://binance-connect/deposit-return',
    ` ${RETURN_BASE}?rn=${NONCE}`,
    `https://example.com/?next=${RETURN_BASE}`,
    'onekey-wallet://url_account?networkCode=btc',
  ])('rejects %s', (url) => {
    expect(isBinanceDepositReturnUrl(url)).toBe(false);
  });

  it('returns false instead of throwing on non-string input', () => {
    const unsafeInputs: unknown[] = [undefined, null, 1, {}, [], Symbol('x')];
    unsafeInputs.forEach((input) => {
      expect(isBinanceDepositReturnUrl(input as string)).toBe(false);
    });
  });
});

describe('parseBinanceDepositReturnUrl', () => {
  it('returns the raw nonce of a canonical return URL', () => {
    expect(parseBinanceDepositReturnUrl(`${RETURN_BASE}?rn=${NONCE}`)).toEqual({
      returnNonce: NONCE,
      otherParamNames: [],
    });
  });

  it.each([
    `ONEKEY-WALLET://BINANCE-CONNECT/deposit-return?rn=${NONCE}`,
    `${RETURN_BASE}/?rn=${NONCE}`,
    `${RETURN_BASE}?rn=${NONCE}#fragment`,
    `${RETURN_BASE}?rn=${NONCE}#rn=${OTHER_NONCE}`,
    `${RETURN_BASE}?&rn=${NONCE}&`,
  ])('accepts the equivalent form %s', (url) => {
    expect(parseBinanceDepositReturnUrl(url)).toEqual({
      returnNonce: NONCE,
      otherParamNames: [],
    });
  });

  it('ignores extra params and reports their names only', () => {
    const result = parseBinanceDepositReturnUrl(
      `${RETURN_BASE}?status=secret-status&rn=${NONCE}&orderId=secret-order&flag`,
    );
    expect(result).toEqual({
      returnNonce: NONCE,
      otherParamNames: ['status', 'orderId', 'flag'],
    });
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('does not decode other params, so a stray percent cannot break it', () => {
    expect(
      parseBinanceDepositReturnUrl(`${RETURN_BASE}?x=100%25&y=%&rn=${NONCE}`),
    ).toEqual({ returnNonce: NONCE, otherParamNames: ['x', 'y'] });
  });

  it('reports a non return URL', () => {
    expect(
      parseBinanceDepositReturnUrl(
        `onekey-wallet://binance-connect/other?rn=${NONCE}`,
      ),
    ).toEqual({ otherParamNames: [], reason: 'not_return_url' });
    expect(
      parseBinanceDepositReturnUrl(undefined as unknown as string),
    ).toEqual({ otherParamNames: [], reason: 'not_return_url' });
  });

  it.each([
    RETURN_BASE,
    `${RETURN_BASE}?`,
    `${RETURN_BASE}#rn=${NONCE}`,
    `${RETURN_BASE}#?rn=${NONCE}`,
  ])('reports a missing rn for %s', (url) => {
    expect(parseBinanceDepositReturnUrl(url)).toEqual({
      otherParamNames: [],
      reason: 'missing_rn',
    });
  });

  it('treats the param name as case-sensitive and never decodes it', () => {
    expect(parseBinanceDepositReturnUrl(`${RETURN_BASE}?RN=${NONCE}`)).toEqual({
      otherParamNames: ['RN'],
      reason: 'missing_rn',
    });
    // %72%6e is "rn" percent-encoded.
    expect(
      parseBinanceDepositReturnUrl(`${RETURN_BASE}?%72%6e=${NONCE}`),
    ).toEqual({
      otherParamNames: [BINANCE_DEPOSIT_RETURN_PARAM_NAME_PLACEHOLDER],
      reason: 'missing_rn',
    });
  });

  it.each([
    `${RETURN_BASE}?rn=${NONCE}&rn=${NONCE}`,
    `${RETURN_BASE}?rn=${NONCE}&rn=${OTHER_NONCE}`,
    `${RETURN_BASE}?rn=${NONCE}&x=1&rn=`,
    `${RETURN_BASE}?rn&rn=${NONCE}`,
  ])('rejects a duplicated rn in %s', (url) => {
    const result = parseBinanceDepositReturnUrl(url);
    expect(result.reason).toBe('duplicate_rn');
    expect(result.returnNonce).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain(NONCE);
  });

  it.each([
    ['empty', ''],
    ['too short', NONCE.slice(1)],
    ['too long', `${NONCE}A`],
    ['percent-encoded', `${NONCE.slice(0, 40)}%2D_`],
    ['percent suffix', `${NONCE}%0A`],
    ['standard base64 plus', `${NONCE.slice(0, 42)}+`],
    ['standard base64 slash', `${NONCE.slice(0, 42)}/`],
    ['padded', `${NONCE.slice(0, 42)}=`],
    ['extra equals', `${NONCE}=`],
    ['space', `${NONCE.slice(0, 42)} `],
    ['semicolon separated', `${NONCE};x=1`],
  ])('rejects a malformed rn (%s)', (_label, value) => {
    const result = parseBinanceDepositReturnUrl(`${RETURN_BASE}?rn=${value}`);
    expect(result).toEqual({ otherParamNames: [], reason: 'malformed_rn' });
  });

  it('rejects an rn without a value', () => {
    expect(parseBinanceDepositReturnUrl(`${RETURN_BASE}?rn`)).toEqual({
      otherParamNames: [],
      reason: 'malformed_rn',
    });
  });

  it('never echoes a nonce-shaped or unsafe param name', () => {
    const result = parseBinanceDepositReturnUrl(
      `${RETURN_BASE}?${OTHER_NONCE}&rn:${OTHER_NONCE}=1&a b=2&=3&ok_name-1.x=4`,
    );
    expect(result).toEqual({
      otherParamNames: [
        BINANCE_DEPOSIT_RETURN_PARAM_NAME_PLACEHOLDER,
        'ok_name-1.x',
      ],
      reason: 'missing_rn',
    });
    expect(JSON.stringify(result)).not.toContain(OTHER_NONCE);
  });

  it('deduplicates and caps the reported param names', () => {
    const names = Array.from({ length: 30 }, (_, index) => `p${index}`);
    const query = [...names, ...names].map((name) => `${name}=1`).join('&');
    const result = parseBinanceDepositReturnUrl(
      `${RETURN_BASE}?${query}&rn=${NONCE}`,
    );
    expect(result.returnNonce).toBe(NONCE);
    expect(result.otherParamNames).toEqual(
      names.slice(0, BINANCE_DEPOSIT_RETURN_MAX_OTHER_PARAM_NAMES),
    );
  });
});

const LINK_NOW = 1_760_000_000_000;
const LINK_FUTURE = LINK_NOW + 60_000;

const ACCEPTED_LINKS = [
  'https://app.binance.com/en/deposit?token=abc#frag',
  'https://www.binance.com/',
  'https://www.binance.com',
  'https://app.binance.com?x=1',
  'https://app.binance.com#x',
  'https://app.binance.com:443/path',
  'HTTPS://APP.BINANCE.COM/path',
  'https://app.binance.com/redirect?to=https://example.com/@x',
];

const REJECTED_LINKS: Array<[string, IBinanceDepositLinkRejectReason]> = [
  ['', 'malformed'],
  ['app.binance.com/path', 'malformed'],
  ['app.binance.com:443/path', 'not_https'],
  ['//app.binance.com/path', 'malformed'],
  ['https:/app.binance.com/path', 'malformed'],
  ['https:app.binance.com/path', 'malformed'],
  ['https:///app.binance.com/path', 'malformed'],
  ['https://', 'malformed'],
  [' https://app.binance.com/path', 'malformed'],
  ['https://app.binance.com/path ', 'malformed'],
  ['https://app.binance.com/pa th', 'malformed'],
  ['https://app.binance.com/\npath', 'malformed'],
  ['https://app.binance.com\t.evil.tld/path', 'malformed'],
  ['https://app.binance.com\\@evil.tld/path', 'malformed'],
  ['https://app.binance.com/\\path', 'malformed'],
  ['https://app.binance.com/pa\u00e9th', 'malformed'],
  ['http://app.binance.com/path', 'not_https'],
  ['bnc://app.binance.com/path', 'not_https'],
  ['data:text/html,hello', 'not_https'],
  ['file:///etc/hosts', 'not_https'],
  ['onekey-wallet://binance-connect/deposit-return', 'not_https'],
  ['https://user@app.binance.com/path', 'has_credentials'],
  ['https://user:pass@app.binance.com/path', 'has_credentials'],
  ['https://app.binance.com@evil.tld/path', 'has_credentials'],
  ['https://app.binance.com:443@evil.tld/path', 'has_credentials'],
  ['https://app.binance.com.evil.tld/path', 'host_not_allowed'],
  ['https://evil-app.binance.com/path', 'host_not_allowed'],
  ['https://xapp.binance.com/path', 'host_not_allowed'],
  ['https://binance.com/path', 'host_not_allowed'],
  ['https://accounts.binance.com/path', 'host_not_allowed'],
  ['https://app.binance.com./path', 'host_not_allowed'],
  ['https://app.binance.co/path', 'host_not_allowed'],
  ['https://app.binance.c%6fm/path', 'host_not_allowed'],
  ['https://evil.tld/app.binance.com', 'host_not_allowed'],
  ['https://evil.tld?app.binance.com', 'host_not_allowed'],
  ['https://evil.tld#@app.binance.com', 'host_not_allowed'],
  ['https://[::1]/path', 'host_not_allowed'],
  ['https://app.binance.com:8443/path', 'port_not_allowed'],
  ['https://app.binance.com:80/path', 'port_not_allowed'],
  ['https://app.binance.com:/path', 'port_not_allowed'],
  ['https://app.binance.com:0443/path', 'port_not_allowed'],
];

describe('validateBinanceDepositLink', () => {
  const NOW = LINK_NOW;
  const FUTURE = LINK_FUTURE;

  it.each(ACCEPTED_LINKS)('accepts %s', (link) => {
    expect(validateBinanceDepositLink(link, FUTURE, NOW)).toEqual({ ok: true });
  });

  it.each(REJECTED_LINKS)('rejects %j as %s', (link, reason) => {
    expect(validateBinanceDepositLink(link, FUTURE, NOW)).toEqual({
      ok: false,
      reason,
    });
  });

  it('rejects a non-string link without throwing', () => {
    expect(
      validateBinanceDepositLink(undefined as unknown as string, FUTURE, NOW),
    ).toEqual({ ok: false, reason: 'malformed' });
  });

  it.each([
    ['missing', undefined],
    ['NaN', Number.NaN],
    ['infinite', Number.POSITIVE_INFINITY],
    ['zero', 0],
    ['negative', -1],
    ['a string', String(FUTURE) as unknown as number],
  ])('fails closed when the expiry is %s', (_label, linkExpireTime) => {
    expect(
      validateBinanceDepositLink(
        'https://app.binance.com/path',
        linkExpireTime,
        NOW,
      ),
    ).toEqual({ ok: false, reason: 'expiry_invalid' });
  });

  it('rejects an expired link, including one expiring right now', () => {
    const link = 'https://app.binance.com/path';
    expect(validateBinanceDepositLink(link, NOW, NOW)).toEqual({
      ok: false,
      reason: 'expired',
    });
    expect(validateBinanceDepositLink(link, NOW - 1, NOW)).toEqual({
      ok: false,
      reason: 'expired',
    });
    expect(validateBinanceDepositLink(link, NOW + 1, NOW)).toEqual({
      ok: true,
    });
  });

  it('reports the link problem before the expiry problem', () => {
    expect(
      validateBinanceDepositLink('https://evil.tld/path', NOW - 1, NOW),
    ).toEqual({ ok: false, reason: 'host_not_allowed' });
  });

  it('defaults now to the current time', () => {
    const link = 'https://app.binance.com/path';
    expect(validateBinanceDepositLink(link, Date.now() + 60_000)).toEqual({
      ok: true,
    });
    expect(validateBinanceDepositLink(link, Date.now() - 60_000)).toEqual({
      ok: false,
      reason: 'expired',
    });
  });
});

// iOS and Android run this code on whatwg-url-without-unicode, installed by
// react-native-url-polyfill. Unlike the Node parser it keeps the host's case,
// percent-decodes it and folds backslashes, so the verdicts are pinned on that
// parser as well.
describe('validateBinanceDepositLink on the native URL parser', () => {
  const originalURL = globalThis.URL;

  beforeAll(() => {
    const nativeUrlModulePath = require.resolve('whatwg-url-without-unicode', {
      paths: [require.resolve('react-native-url-polyfill/package.json')],
    });
    globalThis.URL = jest.requireActual<{ URL: typeof URL }>(
      nativeUrlModulePath,
    ).URL;
  });

  afterAll(() => {
    globalThis.URL = originalURL;
  });

  it('really runs on a different parser', () => {
    expect(globalThis.URL).not.toBe(originalURL);
    expect(new URL('https://APP.BINANCE.COM/path').hostname).toBe(
      'APP.BINANCE.COM',
    );
  });

  it.each(ACCEPTED_LINKS)('accepts %s', (link) => {
    expect(validateBinanceDepositLink(link, LINK_FUTURE, LINK_NOW)).toEqual({
      ok: true,
    });
  });

  it.each(REJECTED_LINKS)('rejects %j as %s', (link, reason) => {
    expect(validateBinanceDepositLink(link, LINK_FUTURE, LINK_NOW)).toEqual({
      ok: false,
      reason,
    });
  });
});

describe('validateBinanceDepositLink without a usable URL parser', () => {
  const originalURL = globalThis.URL;

  afterEach(() => {
    globalThis.URL = originalURL;
  });

  it('fails closed when the parser throws', () => {
    globalThis.URL = jest.fn(() => {
      throw new TypeError('not implemented');
    }) as unknown as typeof URL;
    expect(
      validateBinanceDepositLink(ACCEPTED_LINKS[0], LINK_FUTURE, LINK_NOW),
    ).toEqual({ ok: false, reason: 'malformed' });
  });

  it('fails closed when the parser disagrees about the host', () => {
    globalThis.URL = jest.fn(() => ({
      protocol: 'https:',
      username: '',
      password: '',
      hostname: 'evil.tld',
      port: '',
    })) as unknown as typeof URL;
    expect(
      validateBinanceDepositLink(ACCEPTED_LINKS[0], LINK_FUTURE, LINK_NOW),
    ).toEqual({ ok: false, reason: 'host_not_allowed' });
    expect(globalThis.URL).toHaveBeenCalledTimes(1);
  });
});

describe('generateBinanceDepositSessionKey', () => {
  function mockRandomBytes(byte: number) {
    return jest
      .spyOn(globalThis.crypto, 'getRandomValues')
      .mockImplementation(<T extends ArrayBufferView | null>(array: T): T => {
        if (array instanceof Uint8Array) {
          array.fill(byte);
        }
        return array;
      });
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns 43 base64url characters without padding', () => {
    const key = generateBinanceDepositSessionKey();
    expect(key).toHaveLength(43);
    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(key).toMatch(BINANCE_DEPOSIT_SESSION_KEY_REGEX);
    expect(key).not.toMatch(/[+/=]/);
  });

  it('returns a different key on every call', () => {
    const keys = Array.from({ length: 200 }, () =>
      generateBinanceDepositSessionKey(),
    );
    expect(new Set(keys).size).toBe(keys.length);
    keys.forEach((key) => {
      expect(key).toMatch(BINANCE_DEPOSIT_SESSION_KEY_REGEX);
    });
  });

  it('draws exactly 32 bytes from the platform CSPRNG', () => {
    const spy = jest.spyOn(globalThis.crypto, 'getRandomValues');
    generateBinanceDepositSessionKey();
    expect(spy).toHaveBeenCalledTimes(1);
    const [buffer] = spy.mock.calls[0];
    expect(buffer).toBeInstanceOf(Uint8Array);
    expect((buffer as Uint8Array).byteLength).toBe(32);
  });

  it('maps the base64 alphabet to base64url and strips the padding', () => {
    // 0xfb bytes encode to "+/v7" groups in standard base64.
    mockRandomBytes(0xfb);
    expect(generateBinanceDepositSessionKey()).toBe(`${'-_v7'.repeat(10)}-_s`);
    jest.restoreAllMocks();
    // 0xff bytes encode to "////" groups.
    mockRandomBytes(0xff);
    expect(generateBinanceDepositSessionKey()).toBe(`${'_'.repeat(42)}8`);
  });

  it('refuses an RNG that returns no entropy', () => {
    mockRandomBytes(0);
    expect(() => generateBinanceDepositSessionKey()).toThrow(
      'Secure random source returned no entropy',
    );
  });
});

describe('buildBinanceDepositSessionKeyStorageKey', () => {
  it('prefixes the local id and stays within the secure-store key charset', () => {
    const key = buildBinanceDepositSessionKeyStorageKey(
      '3f2b8c1e-6a4d-4e2f-9b7a-0c1d2e3f4a5b',
    );
    expect(key).toBe('onekey_bcd_sk.3f2b8c1e-6a4d-4e2f-9b7a-0c1d2e3f4a5b');
    expect(key).toMatch(BINANCE_DEPOSIT_SECURE_STORAGE_KEY_REGEX);
  });

  it.each(['', 'a:b', 'a/b', 'a b', '../x', undefined])(
    'rejects the local id %j',
    (localId) => {
      expect(() =>
        buildBinanceDepositSessionKeyStorageKey(localId as string),
      ).toThrow('Invalid Binance deposit local session id');
    },
  );
});

describe('session status helpers', () => {
  it('treats only server-final statuses as terminal', () => {
    expect(
      Object.values(EBinanceDepositSessionStatus).filter((status) =>
        isBinanceDepositTerminalStatus(status),
      ),
    ).toEqual([
      EBinanceDepositSessionStatus.REJECTED,
      EBinanceDepositSessionStatus.EXPIRED,
      EBinanceDepositSessionStatus.SECURITY_CONFLICT,
    ]);
    expect(isBinanceDepositTerminalStatus('LOCAL_PENDING_CREATE')).toBe(false);
    expect(isBinanceDepositTerminalStatus(undefined)).toBe(false);
    expect(isBinanceDepositTerminalStatus('expired')).toBe(false);
  });

  it('knows which statuses count as an in-progress session', () => {
    expect(
      Object.values(EBinanceDepositSessionStatus).filter((status) =>
        isBinanceDepositInProgressStatus(status),
      ),
    ).toEqual([
      EBinanceDepositSessionStatus.CREATING,
      EBinanceDepositSessionStatus.INIT,
      EBinanceDepositSessionStatus.AUTHORIZED_UNBOUND,
    ]);
    expect(isBinanceDepositInProgressStatus('LOCAL_PENDING_CREATE')).toBe(true);
    expect(isBinanceDepositInProgressStatus(undefined)).toBe(false);
    expect(isBinanceDepositInProgressStatus('UNKNOWN')).toBe(false);
  });

  it('does not count a locally closed session as in progress', () => {
    expect(
      isBinanceDepositSessionInProgress({
        status: EBinanceDepositSessionStatus.INIT,
      }),
    ).toBe(true);
    expect(
      isBinanceDepositSessionInProgress({ status: 'LOCAL_PENDING_CREATE' }),
    ).toBe(true);
    expect(
      isBinanceDepositSessionInProgress({
        status: EBinanceDepositSessionStatus.INIT,
        localClosedReason: 'abandoned',
      }),
    ).toBe(false);
    expect(
      isBinanceDepositSessionInProgress({
        status: EBinanceDepositSessionStatus.AUTHORIZED,
      }),
    ).toBe(false);
    expect(isBinanceDepositSessionInProgress(undefined)).toBe(false);
  });

  it('treats a session as closed once nothing is left to do with the server', () => {
    const report = {
      txHash: '0xabc',
      senderAddress: '0xdef',
      attempts: 1,
      updatedAt: 1,
    };
    expect(
      isBinanceDepositSessionClosed({
        status: EBinanceDepositSessionStatus.AUTHORIZED,
      }),
    ).toBe(false);
    expect(
      isBinanceDepositSessionClosed({
        status: EBinanceDepositSessionStatus.AUTHORIZED,
        report: { ...report, status: 'PENDING' },
      }),
    ).toBe(false);
    // A failed report keeps the key: the session can still be queried.
    expect(
      isBinanceDepositSessionClosed({
        status: EBinanceDepositSessionStatus.AUTHORIZED,
        report: { ...report, status: 'FAILED' },
      }),
    ).toBe(false);
    expect(
      isBinanceDepositSessionClosed({
        status: EBinanceDepositSessionStatus.AUTHORIZED,
        report: { ...report, status: 'CONFIRMED' },
      }),
    ).toBe(true);
    expect(
      isBinanceDepositSessionClosed({
        status: EBinanceDepositSessionStatus.EXPIRED,
      }),
    ).toBe(true);
    expect(
      isBinanceDepositSessionClosed({
        status: EBinanceDepositSessionStatus.INIT,
        localClosedReason: 'abandoned',
      }),
    ).toBe(true);
    expect(isBinanceDepositSessionClosed(undefined)).toBe(false);
  });
});

describe('compareBinanceDepositDestination', () => {
  const destination: IBinanceDepositAuthorizedDestination = {
    networkId: 'evm--56',
    binanceNetwork: 'BSC',
    cryptoCurrency: 'USDT',
    contractAddress: '0x55d398326f99059fF775485246999027B3197955',
    minAmount: '0.01',
    address: '0x000000000000000000000000000000000000dEaD',
    authorizedAt: 1_760_000_000_000,
  };

  it('accepts an identical copy', () => {
    expect(
      compareBinanceDepositDestination(destination, { ...destination }),
    ).toBe(true);
  });

  it('treats a missing and an empty tag or contract as equal', () => {
    const native = { ...destination, contractAddress: undefined };
    expect(
      compareBinanceDepositDestination(native, {
        ...native,
        contractAddress: '',
        addressTag: '',
      }),
    ).toBe(true);
  });

  it.each<[string, Partial<IBinanceDepositAuthorizedDestination>]>([
    ['address', { address: '0x000000000000000000000000000000000000dEaE' }],
    ['address case', { address: destination.address.toLowerCase() }],
    ['addressTag', { addressTag: '12345' }],
    ['networkId', { networkId: 'evm--1' }],
    ['binanceNetwork', { binanceNetwork: 'ETH' }],
    ['cryptoCurrency', { cryptoCurrency: 'USDC' }],
    ['contractAddress', { contractAddress: undefined }],
    [
      'contractAddress case',
      { contractAddress: destination.contractAddress?.toLowerCase() },
    ],
    ['minAmount', { minAmount: '0.02' }],
    ['minAmount removed', { minAmount: undefined }],
    ['authorizedAt', { authorizedAt: destination.authorizedAt + 1 }],
  ])('rejects a different %s', (_label, patch) => {
    const other = { ...destination, ...patch };
    expect(compareBinanceDepositDestination(destination, other)).toBe(false);
    expect(compareBinanceDepositDestination(other, destination)).toBe(false);
  });

  it('distinguishes two different tags', () => {
    expect(
      compareBinanceDepositDestination(
        { ...destination, addressTag: '1' },
        { ...destination, addressTag: '2' },
      ),
    ).toBe(false);
  });

  it('fails closed when a side is missing or has no address', () => {
    expect(compareBinanceDepositDestination(destination, undefined)).toBe(
      false,
    );
    expect(compareBinanceDepositDestination(undefined, destination)).toBe(
      false,
    );
    expect(compareBinanceDepositDestination(undefined, undefined)).toBe(false);
    const empty = { ...destination, address: '' };
    expect(compareBinanceDepositDestination(empty, { ...empty })).toBe(false);
  });
});

describe('report retry helpers', () => {
  const failedReport = {
    txHash: '0xabc',
    senderAddress: '0xdef',
    status: 'FAILED' as const,
    attempts: 20,
    updatedAt: 1,
  };
  const authorized = {
    sessionId: SESSION_ID,
    status: EBinanceDepositSessionStatus.AUTHORIZED,
    report: failedReport,
  };

  it('knows which report rejections are final', () => {
    [
      EBinanceDepositErrorCode.ReportConflict,
      EBinanceDepositErrorCode.SecurityConflict,
      BINANCE_DEPOSIT_PARAMS_ERROR_CODE,
    ].forEach((code) => {
      expect(isBinanceDepositReportFinalErrorCode(code)).toBe(true);
    });
    [
      undefined,
      0,
      BINANCE_DEPOSIT_SERVICE_ERROR_CODE,
      EBinanceDepositErrorCode.DepositDisabled,
      EBinanceDepositErrorCode.RateLimited,
    ].forEach((code) => {
      expect(isBinanceDepositReportFinalErrorCode(code)).toBe(false);
    });
  });

  it('lets a report that only ran out of attempts be re-armed', () => {
    expect(canRearmBinanceDepositReport(authorized)).toBe(true);
    expect(
      canRearmBinanceDepositReport({
        ...authorized,
        report: {
          ...failedReport,
          lastErrorCode: BINANCE_DEPOSIT_SERVICE_ERROR_CODE,
        },
      }),
    ).toBe(true);
  });

  it('does not take an unreadable session key for a final rejection', () => {
    // A code of this device, outside the range the server uses.
    expect(EBinanceDepositLocalErrorCode.SessionKeyUnreadable).toBe(914_014);
    expect(
      isBinanceDepositReportFinalErrorCode(
        EBinanceDepositLocalErrorCode.SessionKeyUnreadable,
      ),
    ).toBe(false);
    // The key may be readable again, so the report can be re-armed by hand.
    expect(
      canRearmBinanceDepositReport({
        ...authorized,
        report: {
          ...failedReport,
          lastErrorCode: EBinanceDepositLocalErrorCode.SessionKeyUnreadable,
        },
      }),
    ).toBe(true);
  });

  it.each([
    EBinanceDepositErrorCode.ReportConflict,
    EBinanceDepositErrorCode.SecurityConflict,
    BINANCE_DEPOSIT_PARAMS_ERROR_CODE,
  ])('never re-arms a report the server refused with %s', (lastErrorCode) => {
    expect(
      canRearmBinanceDepositReport({
        ...authorized,
        report: { ...failedReport, lastErrorCode },
      }),
    ).toBe(false);
  });

  it('only re-arms a FAILED report of a session that can still report', () => {
    expect(canRearmBinanceDepositReport(undefined)).toBe(false);
    expect(
      canRearmBinanceDepositReport({ ...authorized, report: undefined }),
    ).toBe(false);
    (['PENDING', 'CONFIRMED'] as const).forEach((status) => {
      expect(
        canRearmBinanceDepositReport({
          ...authorized,
          report: { ...failedReport, status },
        }),
      ).toBe(false);
    });
    expect(
      canRearmBinanceDepositReport({ ...authorized, sessionId: undefined }),
    ).toBe(false);
    expect(
      canRearmBinanceDepositReport({
        ...authorized,
        localClosedReason: 'abandoned',
      }),
    ).toBe(false);
    [
      EBinanceDepositSessionStatus.INIT,
      EBinanceDepositSessionStatus.AUTHORIZED_UNBOUND,
      EBinanceDepositSessionStatus.EXPIRED,
      EBinanceDepositSessionStatus.SECURITY_CONFLICT,
    ].forEach((status) => {
      expect(canRearmBinanceDepositReport({ ...authorized, status })).toBe(
        false,
      );
    });
  });
});

describe('getBinanceDepositSendAttemptAckWaitMs', () => {
  const ATTEMPTED_AT = 1_760_000_000_000;
  const HOLD_MS = BINANCE_DEPOSIT_SEND_ATTEMPT_ACK_HOLD_MS;

  it('holds for 90 seconds, under a code of this device', () => {
    expect(HOLD_MS).toBe(90_000);
    expect(EBinanceDepositLocalErrorCode.SendAttemptAckTooEarly).toBe(914_015);
  });

  it('has nothing to wait for without a recorded attempt', () => {
    expect(getBinanceDepositSendAttemptAckWaitMs(undefined, ATTEMPTED_AT)).toBe(
      0,
    );
  });

  it.each<[string, number, number]>([
    ['at the time of the attempt', 0, HOLD_MS],
    ['one second in', 1000, HOLD_MS - 1000],
    ['one millisecond before the end', HOLD_MS - 1, 1],
    ['at the end', HOLD_MS, 0],
    ['after the end', HOLD_MS + 1, 0],
    ['long after the end', 24 * 60 * 60 * 1000, 0],
  ])('counts the wait down %s', (_label, elapsedMs, expected) => {
    expect(
      getBinanceDepositSendAttemptAckWaitMs(
        ATTEMPTED_AT,
        ATTEMPTED_AT + elapsedMs,
      ),
    ).toBe(expected);
  });

  it('keeps waiting when the device clock was set back since the attempt', () => {
    // Less than no time has passed. The wait ends when the clock reaches the
    // time of the attempt plus the hold again, never earlier.
    expect(
      getBinanceDepositSendAttemptAckWaitMs(ATTEMPTED_AT, ATTEMPTED_AT - 1),
    ).toBe(HOLD_MS + 1);
    expect(
      getBinanceDepositSendAttemptAckWaitMs(
        ATTEMPTED_AT,
        ATTEMPTED_AT - 60 * 60 * 1000,
      ),
    ).toBe(HOLD_MS + 60 * 60 * 1000);
  });

  it.each<[string, number, number]>([
    ['a mark that is not a number', Number.NaN, ATTEMPTED_AT + HOLD_MS],
    ['a time that is not a number', ATTEMPTED_AT, Number.NaN],
    [
      'a mark and a time that are both infinite',
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
    ],
  ])('keeps waiting for %s', (_label, sendAttemptedAt, now) => {
    // Nothing to count down from: the full hold, never zero.
    expect(getBinanceDepositSendAttemptAckWaitMs(sendAttemptedAt, now)).toBe(
      HOLD_MS,
    );
  });
});

describe('return reasons shared with the UI runtime', () => {
  it('keeps the spellings both runtimes exchange', () => {
    expect(BINANCE_DEPOSIT_RETURN_REASON).toEqual({
      AlreadyBound: 'already_bound',
      Duplicate: 'duplicate',
      Queued: 'queued',
      MalformedNonce: 'malformed_rn',
      NoWaitingSession: 'no_waiting_session',
      NonceAlreadyRejected: 'nonce_already_rejected',
      QueueFull: 'queue_full',
      LocalError: 'local_error',
      EndpointMismatch: 'endpoint_mismatch',
    });
  });

  it('marks only the unresolved discards as retryable', () => {
    expect([...BINANCE_DEPOSIT_RETURN_RETRYABLE_REASONS].toSorted()).toEqual([
      'endpoint_mismatch',
      'local_error',
      'queue_full',
    ]);
    // A settled discard, an accepted return and a missing reason are not.
    expect(
      BINANCE_DEPOSIT_RETURN_RETRYABLE_REASONS.has(
        BINANCE_DEPOSIT_RETURN_REASON.NoWaitingSession,
      ),
    ).toBe(false);
    expect(
      BINANCE_DEPOSIT_RETURN_RETRYABLE_REASONS.has(
        BINANCE_DEPOSIT_RETURN_REASON.Queued,
      ),
    ).toBe(false);
    expect(BINANCE_DEPOSIT_RETURN_RETRYABLE_REASONS.has('')).toBe(false);
  });
});

describe('getBinanceDepositAssetBlockReason', () => {
  const POL_PLACEHOLDER = '0x0000000000000000000000000000000000001010';
  const TOKEN = '0x55d398326f99059fF775485246999027B3197955';

  it('lets a native coin through on any network', () => {
    [undefined, '', '   '].forEach((contractAddress) => {
      expect(
        getBinanceDepositAssetBlockReason({
          networkId: 'xrp--0',
          contractAddress,
          isSingleToken: true,
        }),
      ).toBeUndefined();
      expect(
        getBinanceDepositAssetBlockReason({
          networkId: 'evm--137',
          contractAddress,
          isSingleToken: false,
        }),
      ).toBeUndefined();
    });
  });

  it('blocks any contract on a network whose vault only sends its native coin', () => {
    expect(
      getBinanceDepositAssetBlockReason({
        networkId: 'xrp--0',
        contractAddress: 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De',
        isSingleToken: true,
      }),
    ).toBe('single_token_network');
  });

  it('blocks the Polygon native coin listed under its placeholder contract', () => {
    [
      POL_PLACEHOLDER,
      POL_PLACEHOLDER.toUpperCase(),
      ` ${POL_PLACEHOLDER} `,
    ].forEach((contractAddress) => {
      expect(
        getBinanceDepositAssetBlockReason({
          networkId: 'evm--137',
          contractAddress,
          isSingleToken: false,
        }),
      ).toBe('native_placeholder_contract');
    });
  });

  it('lets an ordinary token through', () => {
    expect(
      getBinanceDepositAssetBlockReason({
        networkId: 'evm--137',
        contractAddress: TOKEN,
        isSingleToken: false,
      }),
    ).toBeUndefined();
  });

  it('applies the placeholder to its own network only', () => {
    ['evm--1', 'evm--56', 'constructor', '__proto__'].forEach((networkId) => {
      expect(
        getBinanceDepositAssetBlockReason({
          networkId,
          contractAddress: POL_PLACEHOLDER,
          isSingleToken: false,
        }),
      ).toBeUndefined();
    });
  });
});

describe('getBinanceDepositLocalBindDeadline', () => {
  const LINK_EXPIRE_TIME = 1_760_000_000_000;

  it('covers the server-side grace and bind window while only the link expiry is known', () => {
    // 2 minutes of INIT expiry grace plus the 10-minute bind window.
    expect(BINANCE_DEPOSIT_RETURN_GRACE_MS).toBe(
      2 * 60 * 1000 + BINANCE_DEPOSIT_BIND_WINDOW_MS,
    );
    expect(
      getBinanceDepositLocalBindDeadline({ linkExpireTime: LINK_EXPIRE_TIME }),
    ).toBe(LINK_EXPIRE_TIME + BINANCE_DEPOSIT_RETURN_GRACE_MS);
  });

  it('uses a bind deadline from the server as it is', () => {
    expect(
      getBinanceDepositLocalBindDeadline({
        bindDeadline: LINK_EXPIRE_TIME - 1,
        linkExpireTime: LINK_EXPIRE_TIME,
      }),
    ).toBe(LINK_EXPIRE_TIME - 1);
    expect(
      getBinanceDepositLocalBindDeadline({
        bindDeadline: LINK_EXPIRE_TIME + 1,
      }),
    ).toBe(LINK_EXPIRE_TIME + 1);
  });

  it('ignores values that are not usable timestamps', () => {
    expect(
      getBinanceDepositLocalBindDeadline({
        bindDeadline: Number.NaN,
        linkExpireTime: LINK_EXPIRE_TIME,
      }),
    ).toBe(LINK_EXPIRE_TIME + BINANCE_DEPOSIT_RETURN_GRACE_MS);
    expect(
      getBinanceDepositLocalBindDeadline({
        bindDeadline: 0,
        linkExpireTime: 0,
      }),
    ).toBeUndefined();
    expect(getBinanceDepositLocalBindDeadline({})).toBeUndefined();
  });
});

describe('resolveBinanceDepositBindStep', () => {
  const NOW = 1_760_000_000_000;
  const LINK_EXPIRE_TIME = NOW + 20 * 60 * 1000;
  const BIND_DEADLINE = NOW + 5 * 60 * 1000;
  // Until here the bind is retried while only the link expiry is known.
  const LINK_RETRY_DEADLINE =
    LINK_EXPIRE_TIME + BINANCE_DEPOSIT_RETURN_GRACE_MS;

  const destination: IBinanceDepositAuthorizedDestination = {
    networkId: 'evm--56',
    binanceNetwork: 'BSC',
    cryptoCurrency: 'BNB',
    address: '0x000000000000000000000000000000000000dEaD',
    authorizedAt: NOW,
  };

  function view(
    status: EBinanceDepositSessionStatus,
    extra: Partial<IBinanceDepositSessionView> = {},
  ): IBinanceDepositBindCallResult {
    return {
      kind: 'view',
      view: {
        sessionId: SESSION_ID,
        status,
        networkId: 'evm--56',
        cryptoCurrency: 'BNB',
        ...extra,
      },
    };
  }

  function resolve(
    result: IBinanceDepositBindCallResult,
    extra: Partial<IBinanceDepositBindStepInput> = {},
  ) {
    return resolveBinanceDepositBindStep({
      result,
      now: NOW,
      attempt: 1,
      linkExpireTime: LINK_EXPIRE_TIME,
      ...extra,
    });
  }

  it('reports authorized only for AUTHORIZED with a destination', () => {
    expect(
      resolve(
        view(EBinanceDepositSessionStatus.AUTHORIZED, {
          authorizedDestination: destination,
        }),
      ),
    ).toEqual({
      action: 'authorized',
      reason: 'authorized',
      nextStatus: EBinanceDepositSessionStatus.AUTHORIZED,
    });
  });

  it('still reports authorized after every deadline has passed', () => {
    expect(
      resolve(
        view(EBinanceDepositSessionStatus.AUTHORIZED, {
          authorizedDestination: destination,
        }),
        { now: LINK_RETRY_DEADLINE + 1, bindDeadline: BIND_DEADLINE },
      ).action,
    ).toBe('authorized');
  });

  it('retries after the confirm cooldown while the server is still INIT', () => {
    expect(resolve(view(EBinanceDepositSessionStatus.INIT))).toEqual({
      action: 'retry',
      reason: 'init_pending',
      delayMs: BINANCE_DEPOSIT_BIND_RETRY_INTERVAL_MS,
      nextStatus: EBinanceDepositSessionStatus.INIT,
    });
    expect(BINANCE_DEPOSIT_BIND_RETRY_INTERVAL_MS).toBeGreaterThan(3000);
  });

  it('keeps the nonce and retries later while the deposit switch is off', () => {
    expect(
      resolve(
        { kind: 'error', code: EBinanceDepositErrorCode.DepositDisabled },
        { bindDeadline: BIND_DEADLINE },
      ),
    ).toEqual({
      action: 'retry',
      reason: 'deposit_disabled',
      delayMs: BINANCE_DEPOSIT_BIND_DISABLED_RETRY_INTERVAL_MS,
    });
  });

  it('retries a service or upstream failure', () => {
    expect(
      resolve({ kind: 'error', code: BINANCE_DEPOSIT_SERVICE_ERROR_CODE }),
    ).toEqual({
      action: 'retry',
      reason: 'service_error',
      delayMs: BINANCE_DEPOSIT_BIND_RETRY_INTERVAL_MS,
    });
  });

  it('retries a network error, whatever code came with it', () => {
    const expected = {
      action: 'retry',
      reason: 'network_error',
      delayMs: BINANCE_DEPOSIT_BIND_RETRY_INTERVAL_MS,
    };
    expect(resolve({ kind: 'error', isNetworkError: true })).toEqual(expected);
    expect(resolve({ kind: 'error', isNetworkError: true, code: 502 })).toEqual(
      expected,
    );
    expect(
      resolve({
        kind: 'error',
        isNetworkError: true,
        code: BINANCE_DEPOSIT_PARAMS_ERROR_CODE,
      }),
    ).toEqual(expected);
  });

  it.each([
    ['a response without a code', undefined],
    ['an unrelated code', 404],
    ['a rate limit', EBinanceDepositErrorCode.RateLimited],
  ])('retries %s until the deadline', (_label, code) => {
    expect(resolve({ kind: 'error', code })).toEqual({
      action: 'retry',
      reason: 'unexpected_error',
      delayMs: BINANCE_DEPOSIT_BIND_RETRY_INTERVAL_MS,
    });
    expect(
      resolve({ kind: 'error', code }, { now: LINK_RETRY_DEADLINE - 1 }).action,
    ).toBe('retry');
    expect(
      resolve({ kind: 'error', code }, { now: LINK_RETRY_DEADLINE }).action,
    ).toBe('give_up');
  });

  it('drops a rejected nonce without ending the session', () => {
    const expected = { action: 'rejected_nonce', reason: 'nonce_rejected' };
    const result: IBinanceDepositBindCallResult = {
      kind: 'error',
      code: EBinanceDepositErrorCode.BindProofInvalid,
    };
    expect(resolve(result)).toEqual(expected);
    // Still not terminal once the deadline has passed.
    expect(resolve(result, { now: LINK_RETRY_DEADLINE + 1 })).toEqual(expected);
  });

  it.each([
    EBinanceDepositSessionStatus.REJECTED,
    EBinanceDepositSessionStatus.EXPIRED,
    EBinanceDepositSessionStatus.SECURITY_CONFLICT,
  ])('ends the session on a %s view', (status) => {
    expect(resolve(view(status))).toEqual({
      action: 'terminal',
      reason: 'server_terminal',
      nextStatus: status,
    });
  });

  it('ends the session when the server no longer knows it', () => {
    expect(
      resolve({ kind: 'error', code: BINANCE_DEPOSIT_PARAMS_ERROR_CODE }),
    ).toEqual({ action: 'terminal', reason: 'session_not_found' });
  });

  it.each<[string, IBinanceDepositBindCallResult, string | undefined]>([
    [
      'CREATING',
      view(EBinanceDepositSessionStatus.CREATING),
      EBinanceDepositSessionStatus.CREATING,
    ],
    [
      'AUTHORIZED_UNBOUND',
      view(EBinanceDepositSessionStatus.AUTHORIZED_UNBOUND),
      EBinanceDepositSessionStatus.AUTHORIZED_UNBOUND,
    ],
    [
      'AUTHORIZED without a destination',
      view(EBinanceDepositSessionStatus.AUTHORIZED),
      undefined,
    ],
    [
      'AUTHORIZED with an empty address',
      view(EBinanceDepositSessionStatus.AUTHORIZED, {
        authorizedDestination: { ...destination, address: '' },
      }),
      undefined,
    ],
    [
      'an unknown status',
      view('SOMETHING_NEW' as EBinanceDepositSessionStatus),
      undefined,
    ],
  ])('keeps retrying on %s without releasing anything', (_l, result, next) => {
    expect(resolve(result)).toEqual({
      action: 'retry',
      reason: 'unexpected_view',
      delayMs: BINANCE_DEPOSIT_BIND_RETRY_INTERVAL_MS,
      nextStatus: next,
    });
  });

  describe('deadline', () => {
    const init = view(EBinanceDepositSessionStatus.INIT);
    const giveUp = { action: 'give_up', reason: 'deadline_passed' };

    it('keeps retrying past the link expiry while the server may still open a bind window', () => {
      // The server confirms an INIT session shortly after its expiry and
      // only then starts the bind window, so the link expiry is not the end.
      expect(resolve(init, { now: LINK_EXPIRE_TIME }).action).toBe('retry');
      expect(resolve(init, { now: LINK_RETRY_DEADLINE - 1 }).action).toBe(
        'retry',
      );
      expect(resolve(init, { now: LINK_RETRY_DEADLINE })).toEqual(giveUp);
      expect(resolve(init, { now: LINK_RETRY_DEADLINE + 1 })).toEqual(giveUp);
    });

    it('prefers the bind deadline over the link expiry', () => {
      const extra = { bindDeadline: BIND_DEADLINE };
      expect(resolve(init, { ...extra, now: BIND_DEADLINE - 1 }).action).toBe(
        'retry',
      );
      expect(resolve(init, { ...extra, now: BIND_DEADLINE })).toEqual(giveUp);
      // A later bind deadline also outlives an earlier link expiry.
      expect(
        resolve(init, {
          bindDeadline: LINK_EXPIRE_TIME + 60_000,
          now: LINK_EXPIRE_TIME + 1,
        }).action,
      ).toBe('retry');
    });

    it('applies the deadline to every retryable outcome', () => {
      const retryable: IBinanceDepositBindCallResult[] = [
        init,
        view(EBinanceDepositSessionStatus.AUTHORIZED_UNBOUND),
        { kind: 'error', code: EBinanceDepositErrorCode.DepositDisabled },
        { kind: 'error', code: BINANCE_DEPOSIT_SERVICE_ERROR_CODE },
        { kind: 'error', isNetworkError: true },
      ];
      retryable.forEach((result) => {
        expect(
          resolve(result, { bindDeadline: BIND_DEADLINE, now: BIND_DEADLINE }),
        ).toEqual(giveUp);
      });
    });

    it('reads a deadline carried by the response itself', () => {
      const unbound = view(EBinanceDepositSessionStatus.AUTHORIZED_UNBOUND, {
        bindDeadline: BIND_DEADLINE,
      });
      expect(
        resolve(unbound, { linkExpireTime: undefined, now: BIND_DEADLINE - 1 })
          .action,
      ).toBe('retry');
      expect(
        resolve(unbound, { linkExpireTime: undefined, now: BIND_DEADLINE }),
      ).toEqual(giveUp);

      const initWithExpiry = view(EBinanceDepositSessionStatus.INIT, {
        linkExpireTime: LINK_EXPIRE_TIME,
      });
      expect(
        resolve(initWithExpiry, {
          linkExpireTime: undefined,
          now: LINK_RETRY_DEADLINE - 1,
        }).action,
      ).toBe('retry');
      expect(
        resolve(initWithExpiry, {
          linkExpireTime: undefined,
          now: LINK_RETRY_DEADLINE,
        }),
      ).toEqual(giveUp);
    });

    it('falls back to ten minutes from the first attempt', () => {
      const extra = { linkExpireTime: undefined, firstAttemptAt: NOW };
      expect(BINANCE_DEPOSIT_BIND_WINDOW_MS).toBe(10 * 60 * 1000);
      expect(
        resolve(init, {
          ...extra,
          now: NOW + BINANCE_DEPOSIT_BIND_WINDOW_MS - 1,
        }).action,
      ).toBe('retry');
      expect(
        resolve(init, { ...extra, now: NOW + BINANCE_DEPOSIT_BIND_WINDOW_MS }),
      ).toEqual(giveUp);
    });

    it('ignores deadlines that are not usable timestamps', () => {
      expect(
        resolve(init, {
          bindDeadline: Number.NaN,
          linkExpireTime: 0,
          firstAttemptAt: NOW,
          now: NOW + 1000,
        }).action,
      ).toBe('retry');
    });

    it('stays finite when no time reference is available at all', () => {
      const extra = { linkExpireTime: undefined };
      const maxAttempts =
        Math.ceil(
          BINANCE_DEPOSIT_BIND_WINDOW_MS /
            BINANCE_DEPOSIT_BIND_RETRY_INTERVAL_MS,
        ) + 1;
      expect(resolve(init, { ...extra, attempt: 1 }).action).toBe('retry');
      expect(resolve(init, { ...extra, attempt: maxAttempts - 1 }).action).toBe(
        'retry',
      );
      expect(resolve(init, { ...extra, attempt: maxAttempts })).toEqual(giveUp);
      expect(resolve(init, { ...extra, attempt: Number.NaN }).action).toBe(
        'retry',
      );
    });
  });
});

describe('mask helpers', () => {
  it('keeps the first 8 characters of a session id', () => {
    expect(maskBinanceDepositSessionId(SESSION_ID)).toBe('01234567…');
    expect(maskBinanceDepositSessionId('abc')).toBe('abc…');
    expect(maskBinanceDepositSessionId('')).toBe('');
    expect(maskBinanceDepositSessionId(undefined)).toBe('');
  });

  it('never returns a string the native log layer would redact', () => {
    expect(maskBinanceDepositSessionId(SESSION_ID)).not.toMatch(
      /[0-9a-fA-F]{64}/,
    );
    expect(maskBinanceDepositTxHash(`0x${SESSION_ID}`)).not.toMatch(
      /[0-9a-fA-F]{64}/,
    );
  });

  it('keeps the first 10 characters of a tx hash', () => {
    expect(maskBinanceDepositTxHash(`0x${SESSION_ID}`)).toBe('0x01234567…');
    expect(maskBinanceDepositTxHash(undefined)).toBe('');
  });
});

describe('sanitizeBinanceDepositLogDetail', () => {
  it('passes short scalars through and drops empty values', () => {
    expect(
      sanitizeBinanceDepositLogDetail({
        sid: '01234567…',
        networkId: 'tron--0x2b6653dc',
        attempt: 3,
        ok: false,
        code: undefined,
      }),
    ).toEqual({
      sid: '01234567…',
      networkId: 'tron--0x2b6653dc',
      attempt: 3,
      ok: false,
    });
  });

  it('redacts anything long enough to be a session key or a nonce', () => {
    expect(BINANCE_DEPOSIT_LOG_STRING_MAX_LENGTH).toBeLessThan(NONCE.length);
    const sanitized = sanitizeBinanceDepositLogDetail({
      reason: NONCE,
      sid: SESSION_ID,
      atLimit: 'a'.repeat(BINANCE_DEPOSIT_LOG_STRING_MAX_LENGTH),
      overLimit: 'a'.repeat(BINANCE_DEPOSIT_LOG_STRING_MAX_LENGTH + 1),
    });
    expect(sanitized).toEqual({
      reason: BINANCE_DEPOSIT_LOG_REDACTED_PLACEHOLDER,
      sid: BINANCE_DEPOSIT_LOG_REDACTED_PLACEHOLDER,
      atLimit: 'a'.repeat(BINANCE_DEPOSIT_LOG_STRING_MAX_LENGTH),
      overLimit: BINANCE_DEPOSIT_LOG_REDACTED_PLACEHOLDER,
    });
    expect(JSON.stringify(sanitized)).not.toContain(NONCE);
  });

  it('redacts URLs of any length', () => {
    expect(
      sanitizeBinanceDepositLogDetail({
        a: 'https://app.binance.com/x',
        b: 'onekey-wallet://binance-connect',
      }),
    ).toEqual({
      a: BINANCE_DEPOSIT_LOG_REDACTED_PLACEHOLDER,
      b: BINANCE_DEPOSIT_LOG_REDACTED_PLACEHOLDER,
    });
  });

  it('flattens a name list, sanitizing and capping its items', () => {
    const names = Array.from({ length: 20 }, (_, index) => `p${index}`);
    expect(
      sanitizeBinanceDepositLogDetail({
        otherParamNames: ['status', NONCE, 'orderId'],
        many: names,
        none: [],
      }),
    ).toEqual({
      otherParamNames: `status,${BINANCE_DEPOSIT_LOG_REDACTED_PLACEHOLDER},orderId`,
      many: names.slice(0, BINANCE_DEPOSIT_LOG_LIST_MAX_ITEMS).join(','),
      none: '',
    });
  });

  it('never lets an object through, e.g. a raw request error', () => {
    const requestError = Object.assign(new Error('timeout'), {
      config: { data: JSON.stringify({ sessionKey: NONCE }) },
    });
    const sanitized = sanitizeBinanceDepositLogDetail({
      error: requestError,
      nested: { returnNonce: NONCE },
      list: [{ returnNonce: NONCE }, 1],
      fn: () => NONCE,
      nothing: null,
    } as unknown as IBinanceDepositLogDetail);
    expect(sanitized).toEqual({
      error: BINANCE_DEPOSIT_LOG_REDACTED_PLACEHOLDER,
      nested: BINANCE_DEPOSIT_LOG_REDACTED_PLACEHOLDER,
      list: `${BINANCE_DEPOSIT_LOG_REDACTED_PLACEHOLDER},${BINANCE_DEPOSIT_LOG_REDACTED_PLACEHOLDER}`,
      fn: BINANCE_DEPOSIT_LOG_REDACTED_PLACEHOLDER,
    });
    expect(JSON.stringify(sanitized)).not.toContain(NONCE);
  });

  it('returns an empty object for a missing detail', () => {
    expect(
      sanitizeBinanceDepositLogDetail(
        undefined as unknown as IBinanceDepositLogDetail,
      ),
    ).toEqual({});
  });
});
