import { validateDisplaySnapshotValue } from './displaySnapshotStorageValidation';

describe('display snapshot UTF-8 size validation', () => {
  const config = {
    namespace: 'utf8-test',
    maxReadBatchSize: 1,
    maxRecordBytes: 1,
  };

  it.each<[string, string, number]>([
    ['ASCII', '\u0000Az\u007f', 4],
    ['two-byte boundaries', '\u0080\u07ff', 4],
    ['Chinese', '中文', 6],
    ['three-byte boundary', '\u0800\uffff', 6],
    ['emoji', '😀', 4],
    ['surrogate pair boundaries', '\ud800\udc00\udbff\udfff', 8],
    ['lone high surrogate', '\ud800', 3],
    ['lone low surrogate', '\udfff', 3],
    ['high surrogate before ASCII', '\ud800a', 4],
    ['consecutive high surrogates', '\ud800\udbff', 6],
    ['mixed text and lone surrogate', 'a中😀\ud800b', 12],
  ])(
    'accepts the exact %s byte limit and rejects one byte less',
    (_name, value, bytes) => {
      expect(() =>
        validateDisplaySnapshotValue(value, {
          ...config,
          maxRecordBytes: bytes,
        }),
      ).not.toThrow();
      expect(() =>
        validateDisplaySnapshotValue(value, {
          ...config,
          maxRecordBytes: bytes - 1,
        }),
      ).toThrow(`exceeds ${bytes - 1} bytes`);
    },
  );

  it('accepts an empty value', () => {
    expect(() => validateDisplaySnapshotValue('', config)).not.toThrow();
  });

  it('does not allocate through TextEncoder even when it is installed', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'TextEncoder',
    );
    const encoder = jest.fn();
    Object.defineProperty(globalThis, 'TextEncoder', {
      configurable: true,
      value: encoder,
    });
    try {
      const value = 'a'.repeat(256 * 1024);
      validateDisplaySnapshotValue(value, {
        ...config,
        maxRecordBytes: value.length,
      });
      expect(encoder).not.toHaveBeenCalled();
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, 'TextEncoder', descriptor);
      } else {
        Reflect.deleteProperty(globalThis, 'TextEncoder');
      }
    }
  });
});
