import { Buffer } from 'buffer';

import {
  HARDWARE_CLOUD_SYNC_MESSAGE_PREFIX,
  HARDWARE_CLOUD_SYNC_PATH,
  buildHardwareCloudSyncMessage,
} from '../consts/hardwareCloudSyncConsts';

import { assertNoHardwareCloudSyncSigningRequest } from './hardwareCloudSyncGuards';

const message = buildHardwareCloudSyncMessage('0123456789abcdef');
const bytes = Buffer.from(message, 'ascii');

describe('hardware Cloud root message contract', () => {
  test('keeps the warning and stable identity within 150 ASCII bytes', () => {
    expect(message).toBe(
      `${HARDWARE_CLOUD_SYNC_MESSAGE_PREFIX}0123456789abcdef`,
    );
    expect(bytes.length).toBe(147);
    expect(/^[\x20-\x7e\n]+$/.test(message)).toBe(true);
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

describe('exact protocol message comparison', () => {
  test.each(
    [
      message,
      buildHardwareCloudSyncMessage('0000000000000000'),
      buildHardwareCloudSyncMessage('ffffffffffffffff'),
      bytes,
      [...bytes],
      new Uint8Array(bytes),
      new DataView(new Uint8Array(bytes).buffer),
      new Uint8Array(bytes).buffer,
    ].map((value) => ({ value })),
  )(
    'rejects exact Cloud bytes, including identities of other wallets',
    ({ value }) => {
      expect(() => assertNoHardwareCloudSyncSigningRequest(value)).toThrow(
        'OneKey Cloud key operations',
      );
    },
  );

  test.each([
    [bytes.toString('hex'), 'hex'],
    [bytes.toString('hex').toUpperCase(), 'hex'],
    [`0x${bytes.toString('hex')}`, 'hex'],
  ] as const)(
    'uses the explicitly selected protocol encoding %s',
    (value, encoding) => {
      expect(() =>
        assertNoHardwareCloudSyncSigningRequest(value, encoding),
      ).toThrow('OneKey Cloud key operations');
    },
  );

  test.each([
    bytes.toString('base64'),
    bytes.toString('base64url'),
    `${' '.repeat(32_768)}${bytes.toString('base64')}`,
  ])(
    'checks bytes after base64 transport decoding rather than guessing an encoding',
    (value) => {
      const actualMessage = Buffer.from(value, 'base64');
      expect(() =>
        assertNoHardwareCloudSyncSigningRequest(actualMessage),
      ).toThrow('OneKey Cloud key operations');
    },
  );

  test('examines only the selected byte view', () => {
    const backing = new Uint8Array(1024);
    backing.set(bytes, 7);
    expect(() =>
      assertNoHardwareCloudSyncSigningRequest(
        new DataView(backing.buffer, 7, bytes.length),
      ),
    ).toThrow('OneKey Cloud key operations');
    expect(() =>
      assertNoHardwareCloudSyncSigningRequest(
        new DataView(backing.buffer, 0, bytes.length),
      ),
    ).not.toThrow();
  });

  test.each([
    'OneKey Cloud Key v1',
    HARDWARE_CLOUD_SYNC_MESSAGE_PREFIX,
    `${message} extra bytes`,
    `extra bytes ${message}`,
    `${message}\n`,
    message.toUpperCase(),
    message.replace(/\n/g, '\r\n'),
    message.replace('0123456789abcdef', '0123456789ABCDEF'),
    bytes.toString('hex'),
    bytes.toString('base64'),
    JSON.stringify({ message }),
    JSON.stringify(message),
  ])('allows different literal signed bytes %s', (value) => {
    expect(() => assertNoHardwareCloudSyncSigningRequest(value)).not.toThrow();
  });

  test('does not recursively reinterpret protocol metadata or message literals', () => {
    expect(() =>
      assertNoHardwareCloudSyncSigningRequest({
        payload: { message },
        path: HARDWARE_CLOUD_SYNC_PATH,
        walletInternalSign: true,
      }),
    ).not.toThrow();
    // JSON-RPC parsing recovers the actual message field before the BTC guard.
    const rpc = JSON.parse(
      JSON.stringify({ params: { message } }).replace(
        'WARNING',
        '\\u0057ARNING',
      ),
    ) as { params: { message: string } };
    expect(() =>
      assertNoHardwareCloudSyncSigningRequest(rpc.params.message),
    ).toThrow('OneKey Cloud key operations');
  });

  test('normal protocol decoding still rejects equivalent hex/base64 transport values', () => {
    const wrapped = JSON.parse(
      JSON.stringify({
        padding: 'a'.repeat(32_768),
        params: { payload: { message: bytes.toString('base64') } },
      }),
    ) as { params: { payload: { message: string } } };
    const actualMessageHex = Buffer.from(
      wrapped.params.payload.message,
      'base64',
    ).toString('hex');
    expect(() =>
      assertNoHardwareCloudSyncSigningRequest(actualMessageHex, 'hex'),
    ).toThrow('OneKey Cloud key operations');
  });

  test('does not reject unrelated large strings, structured values or byte views', () => {
    const large = 'a'.repeat(128 * 1024);
    for (const value of [
      large,
      JSON.stringify({ message: large }),
      { message: large },
      new Uint8Array(128 * 1024),
      new DataView(new ArrayBuffer(128 * 1024)),
      new ArrayBuffer(128 * 1024),
    ]) {
      expect(() =>
        assertNoHardwareCloudSyncSigningRequest(value),
      ).not.toThrow();
    }
  });

  test('bounds work before reading numeric arrays or unrelated object properties', () => {
    const read = jest.fn(() => 65);
    const numeric: number[] = new Array<number>(100_000);
    Object.defineProperty(numeric, 3, { get: read });
    const metadata = Object.defineProperty({}, 'message', { get: read });
    expect(() =>
      assertNoHardwareCloudSyncSigningRequest(numeric),
    ).not.toThrow();
    expect(() =>
      assertNoHardwareCloudSyncSigningRequest(metadata),
    ).not.toThrow();
    expect(read).not.toHaveBeenCalled();
  });

  test('never copies or decodes large encoded values', () => {
    const from = jest.spyOn(Buffer, 'from');
    try {
      assertNoHardwareCloudSyncSigningRequest('a'.repeat(32_768), 'hex');
      expect(from).not.toHaveBeenCalled();
    } finally {
      from.mockRestore();
    }
  });

  test('does not expose contents in errors', () => {
    expect(() => assertNoHardwareCloudSyncSigningRequest(message)).toThrow(
      /^OneKey Cloud key operations are unavailable to external signing requests$/,
    );
  });
});
