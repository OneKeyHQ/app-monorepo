import { MessageTypes, hashMessage } from './message';

const MAX_SAFE_INTEGER_AS_HEX = `0x${Number.MAX_SAFE_INTEGER.toString(16)}`;
const MAX_SAFE_INTEGER_PLUS_ONE_CHAR_AS_HEX = `0x${Number.MAX_SAFE_INTEGER.toString(
  16,
)}1`;

const encodeDataExamples = {
  bytes: [
    10,
    '10',
    '0x10',
    '0x101',
    Buffer.from('10', 'utf8'),
    '0xa22cb465000000000000000000000000a9079d872d10185b54c5db2c36cc978cbd3f72b70000000000000000000000000000000000000000000000000000000000000001',
    MAX_SAFE_INTEGER_AS_HEX,
    MAX_SAFE_INTEGER_PLUS_ONE_CHAR_AS_HEX,
  ],
  string: [
    'Hello!',
    '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
    '0xabcd',
    '0xabcde',
    '😁',
    10,
    MAX_SAFE_INTEGER_AS_HEX,
    MAX_SAFE_INTEGER_PLUS_ONE_CHAR_AS_HEX,
  ],
  address: [
    '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
    '0x0',
    '0x10',
    10,
    'bBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
    Number.MAX_SAFE_INTEGER,
    MAX_SAFE_INTEGER_AS_HEX,
    MAX_SAFE_INTEGER_PLUS_ONE_CHAR_AS_HEX,
  ],
  bool: [true, false, 'true', 'false', 0, 1, -1, Number.MAX_SAFE_INTEGER],
  bytes1: [
    '0x10',
    '0x101',
    10,
    0,
    1,
    -1,
    Number.MAX_SAFE_INTEGER,
    Buffer.from('10', 'utf8'),
    MAX_SAFE_INTEGER_AS_HEX,
    MAX_SAFE_INTEGER_PLUS_ONE_CHAR_AS_HEX,
  ],
  bytes32: [
    '0x10',
    '0x101',
    10,
    0,
    1,
    -1,
    Number.MAX_SAFE_INTEGER,
    Buffer.from('10', 'utf8'),
    MAX_SAFE_INTEGER_AS_HEX,
    MAX_SAFE_INTEGER_PLUS_ONE_CHAR_AS_HEX,
  ],
  int8: [0, '0', '0x0', 255, -255],
  int256: [0, '0', '0x0', Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER],
  uint8: [0, '0', '0x0', 255],
  uint256: [0, '0', '0x0', Number.MAX_SAFE_INTEGER],
  int: [0, '0', '0x0', Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER],
  uint: [0, '0', '0x0', Number.MAX_SAFE_INTEGER],
};

const encodeDataErrorExamples = {
  address: [
    {
      input: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB0',
      errorMessage: 'Supplied uint exceeds width: 160 vs 164',
    },
  ],
  int8: [{ input: '256', errorMessage: 'Supplied int exceeds width: 8 vs 9' }],
  uint: [{ input: -1, errorMessage: 'Supplied uint is negative' }],
  uint8: [{ input: -1, errorMessage: 'Supplied uint is negative' }],
  uint256: [{ input: -1, errorMessage: 'Supplied uint is negative' }],
  bytes1: [
    { input: 'a', errorMessage: 'Cannot convert string to buffer' },
    { input: 'test', errorMessage: 'Cannot convert string to buffer' },
  ],
  bytes32: [
    { input: 'a', errorMessage: 'Cannot convert string to buffer' },
    { input: 'test', errorMessage: 'Cannot convert string to buffer' },
  ],
};
const signTypedDataV1Examples: { [key: string]: any } = {
  bytes: [10, '10', '0x10', Buffer.from('10', 'utf8')],
  string: [
    'Hello!',
    '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
    '0xabcd',
    '😁',
  ],
  address: [
    '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
    '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbBbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
    '0x0',
    10,
    Number.MAX_SAFE_INTEGER,
  ],
  bool: [true, false, 'true', 'false', 0, 1, -1, Number.MAX_SAFE_INTEGER],
  bytes1: [
    '0x10',
    10,
    0,
    1,
    -1,
    Number.MAX_SAFE_INTEGER,
    Buffer.from('10', 'utf8'),
  ],
  bytes32: [
    '0x10',
    10,
    0,
    1,
    -1,
    Number.MAX_SAFE_INTEGER,
    Buffer.from('10', 'utf8'),
  ],
  int8: [0, '0', '0x0', 255, -255],
  int256: [0, '0', '0x0', Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER],
  uint8: [0, '0', '0x0', 255, -255],
  uint256: [0, '0', '0x0', Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER],
  int: [0, '0', '0x0', Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER],
  uint: [0, '0', '0x0', Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER],
};

const signTypedDataV1ErrorExamples: { [key: string]: any } = {
  string: [
    {
      // V1: Does not accept numbers as strings (arguably correctly).
      input: 10,
      errorMessage:
        'The first argument must be of type string or an instance of Buffer, ArrayBuffer, or Array or an Array-like Object. Received type number (10)',
    },
  ],
  address: [
    {
      // V1: Unprefixed addresses are not accepted.
      input: 'bBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
      errorMessage:
        'Cannot convert string to buffer. toBuffer only supports 0x-prefixed hex strings and this string was given:',
    },
  ],
  int8: [{ input: '256', errorMessage: 'Supplied int exceeds width: 8 vs 9' }],
  bytes1: [
    { input: 'a', errorMessage: 'Cannot convert string to buffer' },
    { input: 'test', errorMessage: 'Cannot convert string to buffer' },
  ],
  bytes32: [
    { input: 'a', errorMessage: 'Cannot convert string to buffer' },
    { input: 'test', errorMessage: 'Cannot convert string to buffer' },
  ],
};

const allSignTypedDataV1ExampleTypes = [
  ...new Set(
    Object.keys(encodeDataExamples).concat(
      Object.keys(encodeDataErrorExamples),
    ),
  ),
];

describe('hashMessage', () => {
  describe('ETH_SIGN', () => {
    const message =
      '0x879a053d4800c6354e76c7985a865d2922c82fb5b3f4577b2fe08b998954f2e0';
    test('should hash message', () => {
      expect(
        hashMessage({
          messageType: MessageTypes.ETH_SIGN,
          message,
        }),
      ).toMatchSnapshot();
    });
  });
  describe('PERSONAL_SIGN', () => {
    const message =
      '0x4578616d706c652060706572736f6e616c5f7369676e60206d657373616765';
    test('should hash message', () => {
      expect(
        hashMessage({
          messageType: MessageTypes.PERSONAL_SIGN,
          message,
        }),
      ).toMatchSnapshot();
    });
  });
  describe('TYPE_DATA_V1', () => {
    for (const type of allSignTypedDataV1ExampleTypes) {
      const inputs = signTypedDataV1Examples[type] || [];
      for (const input of inputs) {
        const inputType = input instanceof Buffer ? 'Buffer' : typeof input;
        test(`should hash "${String(input)}" (type "${inputType}")`, () => {
          const typedData = [{ type, name: 'message', value: input }];

          expect(
            hashMessage({
              messageType: MessageTypes.TYPE_DATA_V1,
              message: typedData,
            }),
          ).toMatchSnapshot();
        });
      }
      const errorInputs = signTypedDataV1ErrorExamples[type] || [];
      for (const { input, errorMessage } of errorInputs) {
        const inputType = input instanceof Buffer ? 'Buffer' : typeof input;
        test(`should fail to hash "${String(
          input,
        )}" (type "${inputType}")`, () => {
          const typedData = [{ type, name: 'message', value: input }];

          expect(() =>
            hashMessage({
              messageType: MessageTypes.TYPE_DATA_V1,
              message: typedData,
            }),
          ).toThrow(errorMessage);
        });
      }
    }

    const invalidTypedMessages = [
      {
        input: [],
        errorMessage: 'Expect argument to be non-empty array',
        label: 'an empty array',
      },
      {
        input: 42,
        errorMessage: 'Expect argument to be non-empty array',
        label: 'a number',
      },
      {
        input: null,
        errorMessage: "Cannot use 'in' operator to search for 'length' in null",
        label: 'null',
      },
      {
        input: undefined,
        errorMessage: 'Expect argument to be non-empty array',
        label: 'undefined',
      },
      {
        input: [
          {
            type: 'jocker',
            name: 'message',
            value: 'Hi, Alice!',
          },
        ],
        errorMessage: 'Unsupported or invalid type: jocker',
        label: 'an unrecognized type',
      },
      {
        input: [
          {
            name: 'message',
            value: 'Hi, Alice!',
          },
        ],
        errorMessage: 'Cannot read',
        label: 'no type',
      },
      {
        input: [
          {
            type: 'string',
            value: 'Hi, Alice!',
          },
        ],
        errorMessage: 'Expect argument to be non-empty array',
        label: 'no name',
      },
    ];

    for (const { input, label, errorMessage } of invalidTypedMessages) {
      test(`should throw when given ${label}`, () => {
        expect(() =>
          hashMessage({
            messageType: MessageTypes.TYPE_DATA_V1,
            message: input as Array<unknown>,
          }),
        ).toThrow(errorMessage);
      });
    }

    test('should hash a message with multiple entries', () => {
      const typedData = [
        {
          type: 'string',
          name: 'message',
          value: 'Hi, Alice!',
        },
        {
          type: 'uint8',
          name: 'value',
          value: 10,
        },
      ];
      expect(
        hashMessage({
          messageType: MessageTypes.TYPE_DATA_V1,
          message: typedData,
        }),
      ).toMatchInlineSnapshot(
        `"0xf7ad23226db5c1c00ca0ca1468fd49c8f8bbc1489bc1c382de5adc557a69c229"`,
      );
    });
  });
  describe('TYPE_DATA_V3', () => {
    test('should hash a minimal valid typed message', () => {
      const hash = hashMessage({
        messageType: MessageTypes.TYPE_DATA_V3,
        message: {
          types: {
            EIP712Domain: [],
          },
          primaryType: 'EIP712Domain',
          domain: {},
          message: {},
        },
      });

      expect(hash).toMatchSnapshot();
    });
    test('minimal typed message hash should be identical to minimal valid typed message hash', () => {
      const minimalHash = hashMessage({
        messageType: MessageTypes.TYPE_DATA_V3,
        message: {
          types: {},
          primaryType: 'EIP712Domain',
        },
      });

      const minimalValidHash = hashMessage({
        messageType: MessageTypes.TYPE_DATA_V3,
        message: {
          types: {
            EIP712Domain: [],
          },
          primaryType: 'EIP712Domain',
          domain: {},
          message: {},
        },
      });

      expect(minimalHash).toBe(minimalValidHash);
    });
    test('should ignore extra top-level properties', () => {
      const minimalValidHash = hashMessage({
        messageType: MessageTypes.TYPE_DATA_V3,
        message: {
          types: {
            EIP712Domain: [],
          },
          primaryType: 'EIP712Domain',
          domain: {},
          message: {},
        },
      });

      const extraPropertiesHash = hashMessage({
        messageType: MessageTypes.TYPE_DATA_V3,
        message: {
          types: {
            EIP712Domain: [],
          },
          primaryType: 'EIP712Domain',
          domain: {},
          message: {},
          extra: 'stuff',
          moreExtra: 1,
        },
      });

      expect(minimalValidHash).toBe(extraPropertiesHash);
    });
    test('should hash a typed message with a domain separator that uses all fields', () => {
      const hash = hashMessage({
        messageType: MessageTypes.TYPE_DATA_V3,
        message: {
          types: {
            EIP712Domain: [
              {
                name: 'name',
                type: 'string',
              },
              {
                name: 'version',
                type: 'string',
              },
              {
                name: 'chainId',
                type: 'uint256',
              },
              {
                name: 'verifyingContract',
                type: 'address',
              },
              {
                name: 'salt',
                type: 'bytes32',
              },
            ],
          },
          primaryType: 'EIP712Domain',
          domain: {
            name: 'example.metamask.io',
            version: '1',
            chainId: 1,
            verifyingContract: '0x0000000000000000000000000000000000000000',
            salt: Buffer.from(new Int32Array([1, 2, 3])),
          },
          message: {},
        },
      });

      expect(hash).toMatchSnapshot();
    });
    test('should hash a typed message with extra domain seperator fields', () => {
      const hash = hashMessage({
        messageType: MessageTypes.TYPE_DATA_V3,
        message: {
          types: {
            EIP712Domain: [
              {
                name: 'name',
                type: 'string',
              },
              {
                name: 'version',
                type: 'string',
              },
              {
                name: 'chainId',
                type: 'uint256',
              },
              {
                name: 'verifyingContract',
                type: 'address',
              },
              {
                name: 'salt',
                type: 'bytes32',
              },
              {
                name: 'extraField',
                type: 'string',
              },
            ],
          },
          primaryType: 'EIP712Domain',
          domain: {
            name: 'example.metamask.io',
            version: '1',
            chainId: 1,
            verifyingContract: '0x0000000000000000000000000000000000000000',
            salt: Buffer.from(new Int32Array([1, 2, 3])),
            extraField: 'stuff',
          },
          message: {},
        },
      });
      expect(hash).toMatchSnapshot();
    });
    test('should hash a typed message with only custom domain seperator fields', () => {
      const hash = hashMessage({
        messageType: MessageTypes.TYPE_DATA_V3,
        message: {
          types: {
            EIP712Domain: [
              {
                name: 'customName',
                type: 'string',
              },
              {
                name: 'customVersion',
                type: 'string',
              },
              {
                name: 'customChainId',
                type: 'uint256',
              },
              {
                name: 'customVerifyingContract',
                type: 'address',
              },
              {
                name: 'customSalt',
                type: 'bytes32',
              },
              {
                name: 'extraField',
                type: 'string',
              },
            ],
          },
          primaryType: 'EIP712Domain',
          domain: {
            customName: 'example.metamask.io',
            customVersion: '1',
            customChainId: 1,
            customVerifyingContract:
              '0x0000000000000000000000000000000000000000',
            customSalt: Buffer.from(new Int32Array([1, 2, 3])),
            extraField: 'stuff',
          },
          message: {},
        },
      });
      expect(hash).toMatchSnapshot();
    });
    test('should hash a typed message with data', () => {
      const hash = hashMessage({
        messageType: MessageTypes.TYPE_DATA_V3,
        message: {
          types: {
            EIP712Domain: [
              {
                name: 'name',
                type: 'string',
              },
              {
                name: 'version',
                type: 'string',
              },
              {
                name: 'chainId',
                type: 'uint256',
              },
              {
                name: 'verifyingContract',
                type: 'address',
              },
              {
                name: 'salt',
                type: 'bytes32',
              },
            ],
            Message: [{ name: 'data', type: 'string' }],
          },
          primaryType: 'Message',
          domain: {
            name: 'example.metamask.io',
            version: '1',
            chainId: 1,
            verifyingContract: '0x0000000000000000000000000000000000000000',
            salt: Buffer.from(new Int32Array([1, 2, 3])),
          },
          message: {
            data: 'Hello!',
          },
        },
      });
      expect(hash).toMatchSnapshot();
    });
    test('should ignore message if the primary type is EIP712Domain', () => {
      const hashWithMessage = hashMessage({
        messageType: MessageTypes.TYPE_DATA_V3,
        message: {
          types: {
            EIP712Domain: [
              {
                name: 'name',
                type: 'string',
              },
              {
                name: 'version',
                type: 'string',
              },
              {
                name: 'chainId',
                type: 'uint256',
              },
              {
                name: 'verifyingContract',
                type: 'address',
              },
              {
                name: 'salt',
                type: 'bytes32',
              },
            ],
            Message: [{ name: 'data', type: 'string' }],
          },
          primaryType: 'EIP712Domain',
          domain: {
            name: 'example.metamask.io',
            version: '1',
            chainId: 1,
            verifyingContract: '0x0000000000000000000000000000000000000000',
            salt: Buffer.from(new Int32Array([1, 2, 3])),
          },
          message: {
            data: 'Hello!',
          },
        },
      });
      const hashWithoutMessage = hashMessage({
        messageType: MessageTypes.TYPE_DATA_V3,
        message: {
          types: {
            EIP712Domain: [
              {
                name: 'name',
                type: 'string',
              },
              {
                name: 'version',
                type: 'string',
              },
              {
                name: 'chainId',
                type: 'uint256',
              },
              {
                name: 'verifyingContract',
                type: 'address',
              },
              {
                name: 'salt',
                type: 'bytes32',
              },
            ],
            Message: [{ name: 'data', type: 'string' }],
          },
          primaryType: 'EIP712Domain',
          domain: {
            name: 'example.metamask.io',
            version: '1',
            chainId: 1,
            verifyingContract: '0x0000000000000000000000000000000000000000',
            salt: Buffer.from(new Int32Array([1, 2, 3])),
          },
          message: {},
        },
      });
      expect(hashWithMessage).toBe(hashWithoutMessage);
    });
  });
  describe('TYPE_DATA_V4', () => {
    test('should hash a minimal valid typed message', () => {
      const hash = hashMessage({
        messageType: MessageTypes.TYPE_DATA_V4,
        message: {
          types: {
            EIP712Domain: [],
          },
          primaryType: 'EIP712Domain',
          domain: {},
          message: {},
        },
      });
      expect(hash).toMatchSnapshot();
    });
    test('minimal typed message hash should be identical to minimal valid typed message hash', () => {
      const minimalHash = hashMessage({
        messageType: MessageTypes.TYPE_DATA_V4,
        message: {
          types: {},
          primaryType: 'EIP712Domain',
        },
      });

      const minimalValidHash = hashMessage({
        messageType: MessageTypes.TYPE_DATA_V4,
        message: {
          types: {
            EIP712Domain: [],
          },
          primaryType: 'EIP712Domain',
          domain: {},
          message: {},
        },
      });

      expect(minimalHash).toBe(minimalValidHash);
    });
    test('should ignore extra top-level properties', () => {
      const minimalValidHash = hashMessage({
        messageType: MessageTypes.TYPE_DATA_V4,
        message: {
          types: {
            EIP712Domain: [],
          },
          primaryType: 'EIP712Domain',
          domain: {},
          message: {},
        },
      });

      const extraPropertiesHash = hashMessage({
        messageType: MessageTypes.TYPE_DATA_V4,
        message: {
          types: {
            EIP712Domain: [],
          },
          primaryType: 'EIP712Domain',
          domain: {},
          message: {},
          extra: 'stuff',
          moreExtra: 1,
        },
      });

      expect(minimalValidHash).toBe(extraPropertiesHash);
    });
    test('should hash a typed message with a domain separator that uses all fields', () => {
      const hash = hashMessage({
        messageType: MessageTypes.TYPE_DATA_V4,
        message: {
          types: {
            EIP712Domain: [
              {
                name: 'name',
                type: 'string',
              },
              {
                name: 'version',
                type: 'string',
              },
              {
                name: 'chainId',
                type: 'uint256',
              },
              {
                name: 'verifyingContract',
                type: 'address',
              },
              {
                name: 'salt',
                type: 'bytes32',
              },
            ],
          },
          primaryType: 'EIP712Domain',
          domain: {
            name: 'example.metamask.io',
            version: '1',
            chainId: 1,
            verifyingContract: '0x0000000000000000000000000000000000000000',
            salt: Buffer.from(new Int32Array([1, 2, 3])),
          },
          message: {},
        },
      });

      expect(hash).toMatchSnapshot();
    });
    test('should hash a typed message with extra domain seperator fields', () => {
      const hash = hashMessage({
        messageType: MessageTypes.TYPE_DATA_V4,
        message: {
          types: {
            EIP712Domain: [
              {
                name: 'name',
                type: 'string',
              },
              {
                name: 'version',
                type: 'string',
              },
              {
                name: 'chainId',
                type: 'uint256',
              },
              {
                name: 'verifyingContract',
                type: 'address',
              },
              {
                name: 'salt',
                type: 'bytes32',
              },
              {
                name: 'extraField',
                type: 'string',
              },
            ],
          },
          primaryType: 'EIP712Domain',
          domain: {
            name: 'example.metamask.io',
            version: '1',
            chainId: 1,
            verifyingContract: '0x0000000000000000000000000000000000000000',
            salt: Buffer.from(new Int32Array([1, 2, 3])),
            extraField: 'stuff',
          },
          message: {},
        },
      });
      expect(hash).toMatchSnapshot();
    });
    test('should hash a typed message with only custom domain seperator fields', () => {
      const hash = hashMessage({
        messageType: MessageTypes.TYPE_DATA_V4,
        message: {
          types: {
            EIP712Domain: [
              {
                name: 'customName',
                type: 'string',
              },
              {
                name: 'customVersion',
                type: 'string',
              },
              {
                name: 'customChainId',
                type: 'uint256',
              },
              {
                name: 'customVerifyingContract',
                type: 'address',
              },
              {
                name: 'customSalt',
                type: 'bytes32',
              },
              {
                name: 'extraField',
                type: 'string',
              },
            ],
          },
          primaryType: 'EIP712Domain',
          domain: {
            customName: 'example.metamask.io',
            customVersion: '1',
            customChainId: 1,
            customVerifyingContract:
              '0x0000000000000000000000000000000000000000',
            customSalt: Buffer.from(new Int32Array([1, 2, 3])),
            extraField: 'stuff',
          },
          message: {},
        },
      });
      expect(hash).toMatchSnapshot();
    });
    test('should hash a typed message with data', () => {
      const hash = hashMessage({
        messageType: MessageTypes.TYPE_DATA_V4,
        message: {
          types: {
            EIP712Domain: [
              {
                name: 'name',
                type: 'string',
              },
              {
                name: 'version',
                type: 'string',
              },
              {
                name: 'chainId',
                type: 'uint256',
              },
              {
                name: 'verifyingContract',
                type: 'address',
              },
              {
                name: 'salt',
                type: 'bytes32',
              },
            ],
            Message: [{ name: 'data', type: 'string' }],
          },
          primaryType: 'Message',
          domain: {
            name: 'example.metamask.io',
            version: '1',
            chainId: 1,
            verifyingContract: '0x0000000000000000000000000000000000000000',
            salt: Buffer.from(new Int32Array([1, 2, 3])),
          },
          message: {
            data: 'Hello!',
          },
        },
      });
      expect(hash).toMatchSnapshot();
    });
    test('should ignore message if the primary type is EIP712Domain', () => {
      const hashWithMessage = hashMessage({
        messageType: MessageTypes.TYPE_DATA_V4,
        message: {
          types: {
            EIP712Domain: [
              {
                name: 'name',
                type: 'string',
              },
              {
                name: 'version',
                type: 'string',
              },
              {
                name: 'chainId',
                type: 'uint256',
              },
              {
                name: 'verifyingContract',
                type: 'address',
              },
              {
                name: 'salt',
                type: 'bytes32',
              },
            ],
            Message: [{ name: 'data', type: 'string' }],
          },
          primaryType: 'EIP712Domain',
          domain: {
            name: 'example.metamask.io',
            version: '1',
            chainId: 1,
            verifyingContract: '0x0000000000000000000000000000000000000000',
            salt: Buffer.from(new Int32Array([1, 2, 3])),
          },
          message: {
            data: 'Hello!',
          },
        },
      });
      const hashWithoutMessage = hashMessage({
        messageType: MessageTypes.TYPE_DATA_V4,
        message: {
          types: {
            EIP712Domain: [
              {
                name: 'name',
                type: 'string',
              },
              {
                name: 'version',
                type: 'string',
              },
              {
                name: 'chainId',
                type: 'uint256',
              },
              {
                name: 'verifyingContract',
                type: 'address',
              },
              {
                name: 'salt',
                type: 'bytes32',
              },
            ],
            Message: [{ name: 'data', type: 'string' }],
          },
          primaryType: 'EIP712Domain',
          domain: {
            name: 'example.metamask.io',
            version: '1',
            chainId: 1,
            verifyingContract: '0x0000000000000000000000000000000000000000',
            salt: Buffer.from(new Int32Array([1, 2, 3])),
          },
          message: {},
        },
      });
      expect(hashWithMessage).toBe(hashWithoutMessage);
    });
  });
});
