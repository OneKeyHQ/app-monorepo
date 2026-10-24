import { Buffer } from 'buffer';

import {
  HARDWARE_CLOUD_SYNC_MESSAGE_PREFIX,
  HARDWARE_CLOUD_SYNC_PATH,
  buildHardwareCloudSyncMessage,
} from '../consts/hardwareCloudSyncConsts';

import {
  assertNoHardwareCloudSyncSigningRequest,
  isHardwareCloudSyncPath,
} from './hardwareCloudSyncGuards';

const message = buildHardwareCloudSyncMessage('0123456789abcdef');

describe('hardware Cloud root message contract', () => {
  test('keeps the complete warning and stable identity within 150 ASCII bytes', () => {
    expect(message).toBe(
      `${HARDWARE_CLOUD_SYNC_MESSAGE_PREFIX}0123456789abcdef`,
    );
    expect(Buffer.byteLength(message, 'ascii')).toBeLessThanOrEqual(150);
    expect(/^[\x20-\x7e\n]+$/.test(message)).toBe(true);
    expect(message.startsWith('WARNING:')).toBe(true);
    expect(message).toContain('Unlock ALL OneKey Cloud data');
    expect(message).toContain('Never sign in dApps');
  });

  test.each(['', '01234567', '0123456789ABCDEF', '../0123456789ab'])(
    'rejects noncanonical identity %s',
    (identity) => {
      expect(() => buildHardwareCloudSyncMessage(identity)).toThrow(
        'Invalid standard wallet identity',
      );
    },
  );
});

describe('reserved BTC Cloud account paths', () => {
  test.each(
    [
      HARDWARE_CLOUD_SYNC_PATH,
      "m/44'/0'/100'",
      'm/44h/0h/100H/1/999',
      "m/0044'/00'/0100'/0/0",
      "hw-device--m/44'/0'/100'/0/0",
      [2_147_483_692, 2_147_483_648, 2_147_483_748, 0, 0],
    ].map((path) => ({ path })),
  )('recognizes $path', ({ path }) => {
    expect(isHardwareCloudSyncPath(path)).toBe(true);
    expect(() =>
      assertNoHardwareCloudSyncSigningRequest({ address_n: path }),
    ).toThrow('OneKey Cloud key operations');
  });

  test.each(
    [
      "m/44'/0'/0'/0/0",
      "m/44'/60'/100'/0/0",
      "m/44'/0'/1000'/0/0",
      "m/84'/0'/100'/0/0",
      [2_147_483_692, 2_147_483_708, 2_147_483_748, 0, 0],
      undefined,
    ].map((path) => ({ path })),
  )('does not reserve unrelated path $path', ({ path }) => {
    expect(isHardwareCloudSyncPath(path)).toBe(false);
    expect(() =>
      assertNoHardwareCloudSyncSigningRequest({ path }),
    ).not.toThrow();
  });
});

describe('external Cloud signing request guard', () => {
  const encoded = Buffer.from(message, 'ascii');
  test.each([
    { method: 'personal_sign', params: [message, '0x1234'] },
    { method: 'eth_sign', params: ['0x1234', `0x${encoded.toString('hex')}`] },
    { method: 'signMessage', params: { message: encoded.toString('base64') } },
    { method: 'signMessage', params: { message: encoded } },
    { method: 'signMessage', params: { message: [...encoded] } },
    {
      method: 'signMessage',
      params: { message: { type: 'Buffer', data: [...encoded] } },
    },
    {
      method: 'sol_signOffchainMessage',
      params: { message: new Uint8Array(encoded) },
    },
    {
      method: 'signTypedData',
      params: { domain: { name: 'OneKey Cloud Key v1' } },
    },
    {
      method: 'deriveContextHash',
      params: { appName: 'onekey-cloud-key-v1', context: '1234' },
    },
    { method: 'signMessage', params: { message, walletInternalSign: true } },
    {
      method: 'request',
      params: { request: { method: 'btc_signMessage', params: [message] } },
    },
    {
      method: 'signMessage',
      params: {
        message: Buffer.from(encoded.toString('hex')).toString('base64'),
      },
    },
    {
      method: 'signMessage',
      params: { message: '{"message":"\\u004fneKey Cloud Key v1"}' },
    },
  ])('rejects root material request %p', (request) => {
    expect(() => assertNoHardwareCloudSyncSigningRequest(request)).toThrow(
      'OneKey Cloud key operations',
    );
  });

  test('handles a byte view without examining bytes outside that view', () => {
    const data = new Uint8Array(encoded.length + 4);
    data.set(encoded, 2);
    expect(() =>
      assertNoHardwareCloudSyncSigningRequest(
        new DataView(data.buffer, 2, encoded.length),
      ),
    ).toThrow('OneKey Cloud key operations');
  });

  test('rejects paths hidden in encoded structured parameters', () => {
    const payload = Buffer.from(
      JSON.stringify({ path: HARDWARE_CLOUD_SYNC_PATH }),
    ).toString('base64');
    expect(() => assertNoHardwareCloudSyncSigningRequest({ payload })).toThrow(
      'OneKey Cloud key operations',
    );
  });

  test.each([
    { method: 'personal_sign', params: ['Sign in to example.com', '0x1234'] },
    {
      method: 'eth_signTypedData_v4',
      params: ['0x1234', '{"domain":{"name":"Example"}}'],
    },
    {
      method: 'signMessage',
      params: { message: Buffer.from('normal BTC message').toString('base64') },
    },
    { method: 'connect', params: [] },
  ])('allows ordinary request %p', (request) => {
    expect(() =>
      assertNoHardwareCloudSyncSigningRequest(request),
    ).not.toThrow();
  });

  test('does not expose request contents in errors', () => {
    const privateMarker = 'sensitive-untrusted-payload';
    let errorMessage: string | undefined;
    try {
      assertNoHardwareCloudSyncSigningRequest(`${message} ${privateMarker}`);
    } catch (error) {
      errorMessage = (error as Error).message;
    }
    expect(errorMessage).toBe(
      'OneKey Cloud key operations are unavailable to external signing requests',
    );
    expect(errorMessage).not.toContain(privateMarker);
    expect(errorMessage).not.toContain('0123456789abcdef');
  });

  test.each([
    { kind: 'ArrayBuffer', value: new ArrayBuffer(16_385) },
    { kind: 'typed array', value: new Uint8Array(16_385) },
    { kind: 'DataView', value: new DataView(new ArrayBuffer(16_385)) },
  ])('bounds byte decoding before copying $kind', ({ value }) => {
    expect(() => assertNoHardwareCloudSyncSigningRequest({ value })).toThrow(
      'Signing request exceeds Cloud key validation limits',
    );
  });

  test('checks the view size rather than its larger backing buffer', () => {
    const backing = new Uint8Array(32_768);
    backing.set(Buffer.from('ordinary message'), 100);
    expect(() =>
      assertNoHardwareCloudSyncSigningRequest(
        new DataView(backing.buffer, 100, 16),
      ),
    ).not.toThrow();
  });

  test('rejects oversized numeric arrays before inspecting their elements', () => {
    const values: number[] = new Array<number>(16_385);
    const readElement = jest.fn(() => 65);
    Object.defineProperty(values, 3, { get: readElement });
    expect(() => assertNoHardwareCloudSyncSigningRequest(values)).toThrow(
      'Signing request exceeds Cloud key validation limits',
    );
    expect(readElement).not.toHaveBeenCalled();
  });

  test('fails closed on oversized nested arrays without walking their children', () => {
    const children: unknown[] = new Array<unknown>(50_001);
    const readTarget = jest.fn(() => ({ message }));
    Object.defineProperty(children, 50_000, { get: readTarget });
    expect(() =>
      assertNoHardwareCloudSyncSigningRequest({ metadata: { children } }),
    ).toThrow('Signing request exceeds Cloud key validation limits');
    expect(readTarget).not.toHaveBeenCalled();
  });

  test('bounds structured strings rather than skipping a possible nested target', () => {
    const encodedObject = `{"message":"${'a'.repeat(16_384)}"}`;
    expect(() =>
      assertNoHardwareCloudSyncSigningRequest({ payload: encodedObject }),
    ).toThrow('Signing request exceeds Cloud key validation limits');
  });

  test('stops a wide object before reading a value past the queue budget', () => {
    const wide: Record<string, unknown> = {};
    for (let index = 0; index < 49_999; index += 1) {
      wide[index] = null;
    }
    const readTarget = jest.fn(() => ({ message }));
    Object.defineProperty(wide, 'tail', { enumerable: true, get: readTarget });
    expect(() => assertNoHardwareCloudSyncSigningRequest(wide)).toThrow(
      'Signing request exceeds Cloud key validation limits',
    );
    expect(readTarget).not.toHaveBeenCalled();
  });

  test('terminates on cyclic values', () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(() => assertNoHardwareCloudSyncSigningRequest(cyclic)).not.toThrow();
  });
});
