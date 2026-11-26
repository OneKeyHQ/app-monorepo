import { decodeSparkValue, encodeSparkValue } from './sparkSdkCodec';

// What the extension's runtime port does to a message.
const throughPort = (value: unknown): unknown =>
  JSON.parse(JSON.stringify(value));

describe('sparkSdkCodec', () => {
  it('carries bigint, Map and undefined through the port', () => {
    const value = {
      amount: 21n,
      payments: [{ fees: 2n, description: undefined }, undefined, 'text'],
      tokenBalances: new Map([['token', { balance: 5n }]]),
      lnurlDomain: undefined,
      syncIntervalSecs: 60,
      privateEnabledDefault: false,
      realTimeSyncServerUrl: null,
    };

    const decoded = decodeSparkValue(throughPort(encodeSparkValue(value)));

    expect(decoded).toStrictEqual(value);
    // A dropped key would turn the SDK default back on.
    expect(Object.keys(decoded as object)).toContain('lnurlDomain');
  });

  it('keeps amounts beyond the safe integer range exact', () => {
    const amount = 2n ** 100n + 1n;

    expect(
      decodeSparkValue(throughPort(encodeSparkValue({ amount }))),
    ).toStrictEqual({ amount });
  });

  it.each([undefined, null, 0n, 0, 'text', true, []])(
    'carries %p as a whole message',
    (value) => {
      expect(
        decodeSparkValue(throughPort(encodeSparkValue(value))),
      ).toStrictEqual(value);
    },
  );
});
