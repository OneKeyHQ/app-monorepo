import { ETHMessageTypes } from '@onekeyhq/engine/src/types/message';

import * as messageUtils from './messageUtils';

const MAX_SAFE_INTEGER_AS_HEX = `0x${Number.MAX_SAFE_INTEGER.toString(16)}`; // 0x1fffffffffffff - contains an even number of characters (16)
const MAX_SAFE_INTEGER_PLUS_ONE_CHAR_AS_HEX = `0x${Number.MAX_SAFE_INTEGER.toString(
  16,
)}1`; // 0x1fffffffffffff1 or 144115188075855860 - contains an odd number of characters in hexadecimal format (17) and is greater than MAX_SAFE_INTEGER

/*
  we test both even and odd length hex values because Node's Buffer.from() method does not buffer hex numbers correctly
 so we conditionally prepend hexstrings with a zero before buffering them depending on whether the string contains an 
 even or odd number of characters 
 */

const encodeDataExamples = {
  // dynamic types supported by EIP-712:
  bytes: [
    10,
    '10',
    '0x10', // even
    '0x101', // odd
    Buffer.from('10', 'utf8'),
    '0xa22cb465000000000000000000000000a9079d872d10185b54c5db2c36cc978cbd3f72b70000000000000000000000000000000000000000000000000000000000000001', // even number of characters hex string with value greater than MAX_SAFE_INTEGER
    MAX_SAFE_INTEGER_AS_HEX,
    MAX_SAFE_INTEGER_PLUS_ONE_CHAR_AS_HEX,
  ],
  string: [
    'Hello!',
    '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
    '0xabcd', // even
    '0xabcde', // odd
    '😁',
    10,
    MAX_SAFE_INTEGER_AS_HEX,
    MAX_SAFE_INTEGER_PLUS_ONE_CHAR_AS_HEX,
  ],
  // atomic types supported by EIP-712:
  address: [
    '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
    '0x0', // odd
    '0x10', // even
    10,
    'bBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
    Number.MAX_SAFE_INTEGER,
    MAX_SAFE_INTEGER_AS_HEX,
    MAX_SAFE_INTEGER_PLUS_ONE_CHAR_AS_HEX,
  ],
  bool: [true, false, 'true', 'false', 0, 1, -1, Number.MAX_SAFE_INTEGER],
  bytes1: [
    '0x10', // even
    '0x101', // odd
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
    '0x10', // even
    '0x101', // odd
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
  // atomic types not supported by EIP-712:
  int: [0, '0', '0x0', Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER], // interpreted as `int256` by `ethereumjs-abi`
  uint: [0, '0', '0x0', Number.MAX_SAFE_INTEGER], // interpreted as `uint256` by `ethereumjs-abi`
  // `fixed` and `ufixed` types omitted because their encoding in `ethereumjs-abi` is very broken at the moment.
  // `function` type omitted because it is not supported by `ethereumjs-abi`.
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
  // dynamic types supported by EIP-712:
  bytes: [10, '10', '0x10', Buffer.from('10', 'utf8')],
  string: [
    'Hello!',
    '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
    '0xabcd',
    '😁',
  ],
  // atomic types supported by EIP-712:
  address: [
    '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
    // V1: No apparent maximum address length
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
  uint256: [
    0,
    '0',
    '0x0',
    Number.MAX_SAFE_INTEGER,
    // V1: Negative unsigned integers
    Number.MIN_SAFE_INTEGER,
  ],
  // atomic types not supported by EIP-712:
  int: [0, '0', '0x0', Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER], // interpreted as `int256` by `ethereumjs-abi`
  uint: [0, '0', '0x0', Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER], // interpreted as `uint256` by `ethereumjs-abi`
  // `fixed` and `ufixed` types omitted because their encoding in `ethereumjs-abi` is very broken at the moment.
  // `function` type omitted because it is not supported by `ethereumjs-abi`.
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

// Union of all types from both sets of examples
const allSignTypedDataV1ExampleTypes = [
  ...new Set(
    Object.keys(encodeDataExamples).concat(
      Object.keys(encodeDataErrorExamples),
    ),
  ),
];

function getEip712SolidityTypes() {
  const types = ['bool', 'address', 'string', 'bytes'];
  const ints = Array.from(new Array(32)).map(
    (_, index) => `int${(index + 1) * 8}`,
  );
  const uints = Array.from(new Array(32)).map(
    (_, index) => `uint${(index + 1) * 8}`,
  );
  const bytes = Array.from(new Array(32)).map(
    (_, index) => `bytes${index + 1}`,
  );

  return [...types, ...ints, ...uints, ...bytes];
}

const eip712SolidityTypes = getEip712SolidityTypes();

describe('messageUtils', () => {
  describe('validateSignMessageData', () => {
    test('should throw if no from address', () => {
      const message = '0x879a05';
      expect(() =>
        messageUtils.validateSignMessageData({
          type: ETHMessageTypes.PERSONAL_SIGN,
          message,
          payload: [message],
        } as any),
      ).toThrow(`Invalid "from" address: undefined must be a valid string.`);
    });

    test('should throw if invalid from address', () => {
      const from = '01';
      const message = '0x879a05';
      expect(() =>
        messageUtils.validateSignMessageData({
          type: ETHMessageTypes.PERSONAL_SIGN,
          message,
          payload: [message, from],
        } as any),
      ).toThrow(`Invalid "from" address: ${from} must be a valid string.`);
    });

    test('should throw if invalid type from address', () => {
      const from = 123;
      const message = '0x879a05';
      expect(() =>
        messageUtils.validateSignMessageData({
          type: ETHMessageTypes.PERSONAL_SIGN,
          message,
          payload: [message, from],
        } as any),
      ).toThrow(`Invalid "from" address: ${from} must be a valid string.`);
    });

    test('should throw if no message', () => {
      const from = '0x3244e191f1b4903970224322180f1fbbc415696b';
      expect(() =>
        messageUtils.validateSignMessageData({
          type: ETHMessageTypes.PERSONAL_SIGN,
          payload: [undefined, from],
        } as any),
      ).toThrow(`Invalid message: undefined must be a valid string.`);
    });

    test('should throw if invalid typed message', () => {
      const message = 123;
      const from = '0x3244e191f1b4903970224322180f1fbbc415696b';
      expect(() =>
        messageUtils.validateSignMessageData({
          type: ETHMessageTypes.PERSONAL_SIGN,
          message,
          payload: [message, from],
        } as any),
      ).toThrow('Invalid message: 123 must be a valid string.');
    });

    test('should not throw if message is correct ', () => {
      const message = 'test message';
      const from = '0x3244e191f1b4903970224322180f1fbbc415696b';
      expect(() =>
        messageUtils.validateSignMessageData({
          type: ETHMessageTypes.PERSONAL_SIGN,
          message,
          payload: [message, from],
        } as any),
      ).not.toThrow();
    });
  });

  describe('validateTypedMessageDataV1', () => {
    test('should throw if no from address legacy', () => {
      const message = [{}];
      expect(() =>
        messageUtils.validateTypedSignMessageDataV1({
          type: ETHMessageTypes.TYPED_DATA_V1,
          message,
        } as any),
      ).toThrow(`Invalid "from" address: undefined must be a valid string.`);
    });

    test('should throw if invalid from address', () => {
      const from = '3244e191f1b4903970224322180f1';
      const message = [{}];
      expect(() =>
        messageUtils.validateTypedSignMessageDataV1({
          type: ETHMessageTypes.TYPED_DATA_V1,
          message: [],
          payload: [message, from],
        } as any),
      ).toThrow(`Invalid "from" address: ${from} must be a valid string.`);
    });

    test('should throw if invalid type from address', () => {
      const from = 123;
      const message = [{}];
      expect(() =>
        messageUtils.validateTypedSignMessageDataV1({
          type: ETHMessageTypes.TYPED_DATA_V1,
          message: [],
          payload: [message, from],
        } as any),
      ).toThrow(`Invalid "from" address: ${from} must be a valid string.`);
    });

    test('should throw if incorrect message', () => {
      const from = '0x3244e191f1b4903970224322180f1fbbc415696b';
      const message = '0x879a05';
      expect(() =>
        messageUtils.validateTypedSignMessageDataV1({
          type: ETHMessageTypes.TYPED_DATA_V1,
          message,
          payload: [message, from],
        } as any),
      ).toThrow(`Invalid message: ${message} must be a valid array.`);
    });

    test('should throw if no message', () => {
      const from = '0x3244e191f1b4903970224322180f1fbbc415696b';
      expect(() =>
        messageUtils.validateTypedSignMessageDataV1({
          type: ETHMessageTypes.TYPED_DATA_V1,
          payload: [undefined, from],
        } as any),
      ).toThrow('Invalid message: undefined must be a valid array.');
    });

    test('should throw if invalid type message', () => {
      const from = '0x3244e191f1b4903970224322180f1fbbc415696b';
      const message = [{ name: 'test', type: 'string', value: 123 }];
      expect(() =>
        messageUtils.validateTypedSignMessageDataV1({
          type: ETHMessageTypes.TYPED_DATA_V1,
          message,
          payload: [message, from],
        } as any),
      ).toThrow('Expected EIP712 typed data.');
    });

    test('should not throw if message is correct', () => {
      const from = '0x3244e191f1b4903970224322180f1fbbc415696b';
      const message = [{ name: 'test', type: 'string', value: 'test' }];
      expect(() =>
        messageUtils.validateTypedSignMessageDataV1({
          type: ETHMessageTypes.TYPED_DATA_V1,
          message,
          payload: [message, from],
        } as any),
      ).not.toThrow();
    });

    for (const type of allSignTypedDataV1ExampleTypes) {
      const inputs = signTypedDataV1Examples[type] || [];
      for (const input of inputs) {
        const inputType = input instanceof Buffer ? 'Buffer' : typeof input;
        it(`should hash "${String(input)}" (type "${inputType}")`, () => {
          const typedData = [{ type, name: 'message', value: input }];

          expect(() =>
            messageUtils.validateTypedSignMessageDataV1({
              type: ETHMessageTypes.TYPED_DATA_V1,
              message: typedData,
              payload: [
                typedData,
                '0x3244e191f1b4903970224322180f1fbbc415696b',
              ],
            } as any),
          ).not.toThrow();
        });
      }
      const errorInputs = signTypedDataV1ErrorExamples[type] || [];
      for (const { input } of errorInputs) {
        const inputType = input instanceof Buffer ? 'Buffer' : typeof input;
        it(`should fail to hash "${String(
          input,
        )}" (type "${inputType}")`, () => {
          const typedData = [{ type, name: 'message', value: input }];

          expect(() =>
            messageUtils.validateTypedSignMessageDataV1({
              type: ETHMessageTypes.TYPED_DATA_V1,
              message: typedData,
              payload: [
                typedData,
                '0x3244e191f1b4903970224322180f1fbbc415696b',
              ],
            } as any),
          ).toThrow('Expected EIP712 typed data.');
        });
      }
    }

    const invalidTypedMessages = [
      {
        input: [],
        label: 'an empty array',
      },
      {
        input: 42,
        label: 'a number',
      },
      {
        input: null,
        label: 'null',
      },
      {
        input: undefined,
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
        label: 'an unrecognized type',
      },
      {
        input: [
          {
            name: 'message',
            value: 'Hi, Alice!',
          },
        ],
        label: 'no type',
      },
      {
        input: [
          {
            type: 'string',
            value: 'Hi, Alice!',
          },
        ],
        label: 'no name',
      },
    ];

    for (const { input, label } of invalidTypedMessages) {
      it(`should throw when given ${label}`, () => {
        expect(() =>
          messageUtils.validateTypedSignMessageDataV1({
            type: ETHMessageTypes.TYPED_DATA_V1,
            message: input,
            payload: [input, '0x3244e191f1b4903970224322180f1fbbc415696b'],
          } as any),
        ).toThrow();
      });
    }

    it('should hash a message with multiple entries', () => {
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

      expect(() =>
        messageUtils.validateTypedSignMessageDataV1({
          type: ETHMessageTypes.TYPED_DATA_V1,
          message: typedData,
          payload: [typedData, '0x3244e191f1b4903970224322180f1fbbc415696b'],
        } as any),
      ).not.toThrow();
    });
  });

  describe('validateTypedSignMessageDataV3V4', () => {
    const dataTyped =
      '{"types":{"EIP712Domain":[{"name":"name","type":"string"},{"name":"version","type":"string"},{"name":"chainId","type":"uint256"},{"name":"verifyingContract","type":"address"}],"Person":[{"name":"name","type":"string"},{"name":"wallet","type":"address"}],"Mail":[{"name":"from","type":"Person"},{"name":"to","type":"Person"},{"name":"contents","type":"string"}]},"primaryType":"Mail","domain":{"name":"Ether Mail","version":"1","chainId":1,"verifyingContract":"0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC"},"message":{"from":{"name":"Cow","wallet":"0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826"},"to":{"name":"Bob","wallet":"0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB"},"contents":"Hello, Bob!"}}';
    const mockedCurrentChainId = '1';
    test('should throw if no from address', () => {
      expect(() =>
        messageUtils.validateTypedSignMessageDataV3V4(
          {
            type: ETHMessageTypes.TYPED_DATA_V4,
            message: '0x879a05',
          } as any,
          mockedCurrentChainId,
        ),
      ).toThrow(`Invalid "from" address: undefined must be a valid string.`);
    });

    test('should throw if invalid from address', () => {
      const from = '3244e191f1b4903970224322180f1fb';
      const message = '0x879a05';
      expect(() =>
        messageUtils.validateTypedSignMessageDataV3V4(
          {
            type: ETHMessageTypes.TYPED_DATA_V4,
            message,
            payload: [from, message],
          } as any,
          mockedCurrentChainId,
        ),
      ).toThrow(`Invalid "from" address: ${from} must be a valid string.`);
    });

    test('should throw if invalid type from address', () => {
      const from = 123;
      const message = '0x879a05';
      expect(() =>
        messageUtils.validateTypedSignMessageDataV3V4(
          {
            type: ETHMessageTypes.TYPED_DATA_V4,
            message,
            payload: [from, message],
          } as any,
          mockedCurrentChainId,
        ),
      ).toThrow(`Invalid "from" address: ${from} must be a valid string.`);
    });

    test('should throw if array message', () => {
      const from = '0x3244e191f1b4903970224322180f1fbbc415696b';
      const message: [] = [];
      expect(() =>
        messageUtils.validateTypedSignMessageDataV3V4(
          {
            type: ETHMessageTypes.TYPED_DATA_V4,
            message,
            payload: [from, message],
          } as any,
          mockedCurrentChainId,
        ),
      ).toThrow('Invalid message:');
    });

    test('should throw if no message', () => {
      const from = '0x3244e191f1b4903970224322180f1fbbc415696b';
      expect(() =>
        messageUtils.validateTypedSignMessageDataV3V4(
          {
            type: ETHMessageTypes.TYPED_DATA_V4,
            payload: [from],
          } as any,
          mockedCurrentChainId,
        ),
      ).toThrow('Invalid message:');
    });

    test('should throw if no json valid message', () => {
      const from = '0x3244e191f1b4903970224322180f1fbbc415696b';
      const message = 'uh oh';
      expect(() =>
        messageUtils.validateTypedSignMessageDataV3V4(
          {
            type: ETHMessageTypes.TYPED_DATA_V4,
            message,
            payload: [from, message],
          } as any,
          mockedCurrentChainId,
        ),
      ).toThrow('Message data must be passed as a valid JSON string.');
    });

    test('should throw if current chain id is not present', () => {
      const from = '0x3244e191f1b4903970224322180f1fbbc415696b';
      expect(() =>
        messageUtils.validateTypedSignMessageDataV3V4(
          {
            type: ETHMessageTypes.TYPED_DATA_V4,
            message: dataTyped,
            payload: [from, dataTyped],
          } as any,
          undefined,
        ),
      ).toThrow('Current chainId cannot be null or undefined.');
    });

    test('should throw if current chain id is not convertable to integer', () => {
      const unexpectedChainId = 'unexpected chain id';
      const from = '0x3244e191f1b4903970224322180f1fbbc415696b';
      expect(() =>
        messageUtils.validateTypedSignMessageDataV3V4(
          {
            type: ETHMessageTypes.TYPED_DATA_V4,
            message: dataTyped.replace(`"chainId":1`, `"chainId":"0x1"`),
            payload: [
              from,
              dataTyped.replace(`"chainId":1`, `"chainId":"0x1"`),
            ],
          } as any,
          unexpectedChainId,
        ),
      ).toThrow(
        `Cannot sign messages for chainId "${mockedCurrentChainId}", because OneKey is switching networks.`,
      );
    });

    test('should throw if current chain id is not matched with provided in message message', () => {
      const chainId = '2';
      const from = '0x3244e191f1b4903970224322180f1fbbc415696b';
      expect(() =>
        messageUtils.validateTypedSignMessageDataV3V4(
          {
            type: ETHMessageTypes.TYPED_DATA_V4,
            message: dataTyped,
            payload: [from, dataTyped],
          } as any,
          chainId,
        ),
      ).toThrow(
        `Provided chainId "${mockedCurrentChainId}" must match the active chainId "${chainId}"`,
      );
    });

    test('should throw if message not in typed message schema', () => {
      const from = '0x3244e191f1b4903970224322180f1fbbc415696b';
      const message = '{"greetings":"I am Alice"}';
      expect(() =>
        messageUtils.validateTypedSignMessageDataV3V4(
          {
            type: ETHMessageTypes.TYPED_DATA_V4,
            message,
            payload: [from, message],
          } as any,
          mockedCurrentChainId,
        ),
      ).toThrow('Message Data must conform to EIP-712 schema.');
    });

    test('should not throw if message is correct', () => {
      const from = '0x3244e191f1b4903970224322180f1fbbc415696b';
      expect(() =>
        messageUtils.validateTypedSignMessageDataV3V4(
          {
            type: ETHMessageTypes.TYPED_DATA_V4,
            message: dataTyped,
            payload: [from, dataTyped],
          } as any,
          mockedCurrentChainId,
        ),
      ).not.toThrow();
    });

    test('should not throw if message is correct (object format)', () => {
      const from = '0x3244e191f1b4903970224322180f1fbbc415696b';
      const message = JSON.parse(dataTyped);
      expect(() =>
        messageUtils.validateTypedSignMessageDataV3V4(
          {
            type: ETHMessageTypes.TYPED_DATA_V4,
            message,
            payload: [from, message],
          } as any,
          mockedCurrentChainId,
        ),
      ).not.toThrow();
    });

    test('should match valid typed message', () => {
      const typedMessage = {
        domain: {},
        message: {},
        primaryType: 'object',
        types: {
          EIP712Domain: [],
        },
      };

      expect(() =>
        messageUtils.validateTypedSignMessageDataV3V4(
          {
            type: ETHMessageTypes.TYPED_DATA_V4,
            message: typedMessage,
            payload: [
              '0x3244e191f1b4903970224322180f1fbbc415696b',
              typedMessage,
            ],
          } as any,
          mockedCurrentChainId,
        ),
      ).not.toThrow();
    });
    test('should allow custom types in addition to domain', () => {
      const typedMessage = {
        domain: {},
        message: {},
        primaryType: 'Message',
        types: {
          EIP712Domain: [],
          Message: [],
        },
      };

      expect(() =>
        messageUtils.validateTypedSignMessageDataV3V4(
          {
            type: ETHMessageTypes.TYPED_DATA_V4,
            message: typedMessage,
            payload: [
              '0x3244e191f1b4903970224322180f1fbbc415696b',
              typedMessage,
            ],
          } as any,
          mockedCurrentChainId,
        ),
      ).not.toThrow();
    });

    eip712SolidityTypes.forEach((solidityType) => {
      test(`should allow custom type to have type of '${solidityType}'`, () => {
        const typedMessage = {
          domain: {},
          message: {},
          primaryType: 'Message',
          types: {
            EIP712Domain: [],
            Message: [{ name: 'data', type: solidityType }],
          },
        };
        expect(() =>
          messageUtils.validateTypedSignMessageDataV3V4(
            {
              type: ETHMessageTypes.TYPED_DATA_V4,
              message: typedMessage,
              payload: [
                '0x3244e191f1b4903970224322180f1fbbc415696b',
                typedMessage,
              ],
            } as any,
            mockedCurrentChainId,
          ),
        ).not.toThrow();
      });
    });

    test('should allow custom type to have a custom type', () => {
      const typedMessage = {
        domain: {},
        message: {},
        primaryType: 'Message',
        types: {
          CustomValue: [{ name: 'value', type: 'string' }],
          EIP712Domain: [],
          Message: [{ name: 'data', type: 'CustomValue' }],
        },
      };

      expect(() =>
        messageUtils.validateTypedSignMessageDataV3V4(
          {
            type: ETHMessageTypes.TYPED_DATA_V4,
            message: typedMessage,
            payload: [
              '0x3244e191f1b4903970224322180f1fbbc415696b',
              typedMessage,
            ],
          } as any,
          mockedCurrentChainId,
        ),
      ).not.toThrow();
    });

    const invalidStrings = [undefined, null, 0, 1, [], {}];

    for (const invalidString of invalidStrings) {
      test(`should disallow a primary type with value '${String(
        invalidString,
      )}'`, () => {
        const typedMessage = {
          domain: {},
          message: {},
          primaryType: invalidString,
          types: {
            EIP712Domain: [],
          },
        };

        expect(() =>
          messageUtils.validateTypedSignMessageDataV3V4(
            {
              type: ETHMessageTypes.TYPED_DATA_V4,
              message: typedMessage,
              payload: [
                '0x3244e191f1b4903970224322180f1fbbc415696b',
                typedMessage,
              ],
            } as any,
            mockedCurrentChainId,
          ),
        ).toThrow('Message Data must conform to EIP-712 schema.');
      });
    }

    const invalidObjects = [undefined, null, 0, 1, [], '', 'test'];
    for (const invalidObject of invalidObjects) {
      test(`should disallow a typed message with value'${String(
        invalidObject,
      )}'`, () => {
        expect(() =>
          messageUtils.validateTypedSignMessageDataV3V4(
            {
              type: ETHMessageTypes.TYPED_DATA_V4,
              message: invalidObject,
              payload: [
                '0x3244e191f1b4903970224322180f1fbbc415696b',
                invalidObject,
              ],
            } as any,
            mockedCurrentChainId,
          ),
        ).toThrow();
      });

      test(`should disallow a domain with value '${String(
        invalidObject,
      )}'`, () => {
        const typedMessage = {
          domain: invalidObject,
          message: {},
          primaryType: 'object',
          types: {
            EIP712Domain: [],
          },
        };

        expect(() =>
          messageUtils.validateTypedSignMessageDataV3V4(
            {
              type: ETHMessageTypes.TYPED_DATA_V4,
              message: typedMessage,
              payload: [
                '0x3244e191f1b4903970224322180f1fbbc415696b',
                typedMessage,
              ],
            } as any,
            mockedCurrentChainId,
          ),
        ).toThrow('Message Data must conform to EIP-712 schema.');
      });
      test(`should disallow a message with value '${String(
        invalidObject,
      )}'`, () => {
        const typedMessage = {
          domain: {},
          message: invalidObject,
          primaryType: 'object',
          types: {
            EIP712Domain: [],
          },
        };

        expect(() =>
          messageUtils.validateTypedSignMessageDataV3V4(
            {
              type: ETHMessageTypes.TYPED_DATA_V4,
              message: typedMessage,
              payload: [
                '0x3244e191f1b4903970224322180f1fbbc415696b',
                typedMessage,
              ],
            } as any,
            mockedCurrentChainId,
          ),
        ).toThrow('Message Data must conform to EIP-712 schema.');
      });

      test(`should disallow types with value '${String(
        invalidObject,
      )}'`, () => {
        const typedMessage = {
          domain: {},
          message: {},
          primaryType: 'object',
          types: invalidObject,
        };

        expect(() =>
          messageUtils.validateTypedSignMessageDataV3V4(
            {
              type: ETHMessageTypes.TYPED_DATA_V4,
              message: typedMessage,
              payload: [
                '0x3244e191f1b4903970224322180f1fbbc415696b',
                typedMessage,
              ],
            } as any,
            mockedCurrentChainId,
          ),
        ).toThrow('Message Data must conform to EIP-712 schema.');
      });
    }
    test('should require custom type properties to have a name', () => {
      const typedMessage = {
        domain: {},
        message: {},
        primaryType: 'Message',
        types: {
          EIP712Domain: [],
          Message: [{ type: 'string' }],
        },
      };

      expect(() =>
        messageUtils.validateTypedSignMessageDataV3V4(
          {
            type: ETHMessageTypes.TYPED_DATA_V4,
            message: typedMessage,
            payload: [
              '0x3244e191f1b4903970224322180f1fbbc415696b',
              typedMessage,
            ],
          } as any,
          mockedCurrentChainId,
        ),
      ).toThrow('Message Data must conform to EIP-712 schema.');
    });

    test('should require custom type properties to have a type', () => {
      const typedMessage = {
        domain: {},
        message: {},
        primaryType: 'Message',
        types: {
          EIP712Domain: [],
          Message: [{ name: 'name' }],
        },
      };

      expect(() =>
        messageUtils.validateTypedSignMessageDataV3V4(
          {
            type: ETHMessageTypes.TYPED_DATA_V4,
            message: typedMessage,
            payload: [
              '0x3244e191f1b4903970224322180f1fbbc415696b',
              typedMessage,
            ],
          } as any,
          mockedCurrentChainId,
        ),
      ).toThrow('Message Data must conform to EIP-712 schema.');
    });

    const invalidTypes = [undefined, null, 0, 1, [], {}];

    for (const invalidType of invalidTypes) {
      it(`should disallow a type of '${String(invalidType)}'`, () => {
        const typedMessage = {
          domain: {},
          message: {},
          primaryType: 'Message',
          types: {
            EIP712Domain: [],
            Message: [{ name: 'name', type: invalidType }],
          },
        };
        expect(() =>
          messageUtils.validateTypedSignMessageDataV3V4(
            {
              type: ETHMessageTypes.TYPED_DATA_V4,
              message: typedMessage,
              payload: [
                '0x3244e191f1b4903970224322180f1fbbc415696b',
                typedMessage,
              ],
            } as any,
            mockedCurrentChainId,
          ),
        ).toThrow('Message Data must conform to EIP-712 schema.');
      });
    }
  });

  describe('getValidUnsignedMessage', () => {
    const typedData =
      '{"types":{"EIP712Domain":[{"name":"name","type":"string"},{"name":"version","type":"string"},{"name":"chainId","type":"uint256"},{"name":"verifyingContract","type":"address"}],"Person":[{"name":"name","type":"string"},{"name":"wallet","type":"address"}],"Mail":[{"name":"from","type":"Person"},{"name":"to","type":"Person"},{"name":"contents","type":"string"}]},"primaryType":"Mail","domain":{"name":"Ether Mail","version":"1","chainId":1,"verifyingContract":"0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC"},"message":{"from":{"name":"Cow","wallet":"0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826"},"to":{"name":"Bob","wallet":"0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB"},"contents":"Hello, Bob!"}}';

    test('should return original data if no json valid message', () => {
      const from = '0x3244e191f1b4903970224322180f1fbbc415696b';
      const message = 'uh oh';
      const unsignedMessage = {
        type: ETHMessageTypes.TYPED_DATA_V4,
        message,
        payload: [from, message],
      };

      expect(messageUtils.getValidUnsignedMessage(unsignedMessage)).toBe(
        unsignedMessage,
      );
    });
    test('should return original data if message is correct', () => {
      const from = '0x3244e191f1b4903970224322180f1fbbc415696b';
      const message = typedData;
      const unsignedMessage = {
        type: ETHMessageTypes.TYPED_DATA_V4,
        message,
        payload: [from, message],
      };

      expect(messageUtils.getValidUnsignedMessage(unsignedMessage)).toBe(
        unsignedMessage,
      );
    });

    test('should return the sanitized message if fake message in the data', () => {
      const from = '0x3244e191f1b4903970224322180f1fbbc415696b';
      const data = JSON.parse(typedData);
      data.message[''] = {
        'target': 'THIS IS THE FAKE TARGET',
        'message': 'THIS IS A FAKE MESSAGE',
      };
      const unsignedMessage = {
        type: ETHMessageTypes.TYPED_DATA_V4,
        message: JSON.stringify(data),
        payload: [from, JSON.stringify(data)],
      };

      expect(messageUtils.getValidUnsignedMessage(unsignedMessage)).toBe(
        unsignedMessage,
      );
    });
  });
});
