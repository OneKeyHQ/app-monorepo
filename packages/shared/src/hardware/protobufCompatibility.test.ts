import { Reader, Root, util } from 'protobufjs/light';

describe('protobuf runtime compatibility', () => {
  const maxUint64 = Uint8Array.from([
    0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x01,
  ]);

  test('preserves full-width unsigned values on the wire', () => {
    const type = Root.fromJSON({
      nested: {
        Counter: { fields: { value: { type: 'uint64', id: 1 } } },
      },
    }).lookupType('Counter');
    const message = type.fromObject({ value: '18446744073709551615' });
    const encoded = type.encode(message).finish();
    expect(Array.from(encoded)).toEqual([0x08, ...maxUint64]);
    expect(type.toObject(type.decode(encoded), { longs: String })).toEqual({
      value: '18446744073709551615',
    });
  });

  test('decodes uint64 with a transpiled default Long constructor', () => {
    const original = util.Long;
    Object.defineProperty(util, 'Long', { value: { default: original } });
    try {
      expect(Reader.create(maxUint64).uint64().toString()).toBe(
        '18446744073709551615',
      );
    } finally {
      Object.defineProperty(util, 'Long', { value: original });
    }
  });
});
