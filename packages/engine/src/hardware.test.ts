import { ethereumSignMessage } from './hardware';
import { ETHMessageTypes } from './types/message';

import type { IUnsignedMessageEvm } from './vaults/impl/evm/Vault';

let messageHashResult = '';
let messageHexResult = '';
const mockHardwareSDK = {
  evmSignTypedData: (
    _connectId: string,
    _deviceId: string,
    { messageHash }: { messageHash: string },
  ) => {
    messageHashResult = messageHash;
    return Promise.resolve({
      success: true,
      signature: '',
    });
  },
  evmSignMessage: (
    _connectId: string,
    _deviceId: string,
    { messageHex }: { messageHex: string },
  ) => {
    messageHexResult = messageHex;
    return Promise.resolve({
      success: true,
      signature: '',
    });
  },
};

const ethereumSignMessageWrapper = async (message: IUnsignedMessageEvm) =>
  ethereumSignMessage({
    HardwareSDK: mockHardwareSDK as any,
    connectId: 'connectId',
    deviceId: 'deviceId',
    path: 'path',
    message,
    chainId: 1,
  });

describe('ethereumSignMessage', () => {
  describe('ETH_SIGN', () => {
    test('should hash message', async () => {
      const message =
        '0x879a053d4800c6354e76c7985a865d2922c82fb5b3f4577b2fe08b998954f2e0';
      await ethereumSignMessageWrapper({
        type: ETHMessageTypes.ETH_SIGN,
        message,
      });

      expect(messageHexResult).toMatchSnapshot();
    });
  });

  describe('PERSONAL_SIGN', () => {
    test('should hash message', async () => {
      const message =
        '0x4578616d706c652060706572736f6e616c5f7369676e60206d657373616765';
      await ethereumSignMessageWrapper({
        type: ETHMessageTypes.PERSONAL_SIGN,
        message,
      });

      expect(messageHexResult).toMatchSnapshot();
    });
  });

  describe('TYPED_DATA_V1', () => {
    test('should throw not supported error', async () => {
      await expect(
        ethereumSignMessageWrapper({
          type: ETHMessageTypes.TYPED_DATA_V1,
          message: '',
        }),
      ).rejects.toThrow(
        `Sign message method=${ETHMessageTypes.TYPED_DATA_V1} not supported for this device`,
      );
    });
  });

  describe('TYPED_DATA_V3', () => {
    test('should hash data with custom type', async () => {
      const types = {
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'address' },
        ],
        Mail: [
          { name: 'from', type: 'Person' },
          { name: 'to', type: 'Person' },
          { name: 'contents', type: 'string' },
        ],
      };
      const primaryType = 'Mail';
      const message = {
        from: {
          name: 'Cow',
          wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
        },
        to: {
          name: 'Bob',
          wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
        },
        contents: 'Hello, Bob!',
      };

      await ethereumSignMessageWrapper({
        type: ETHMessageTypes.TYPED_DATA_V3,
        message: JSON.stringify({
          types,
          primaryType,
          message,
        }),
      });

      expect(messageHashResult).toMatchSnapshot();
    });

    test('should hash data with a recursive data type', async () => {
      const types = {
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'address' },
        ],
        Mail: [
          { name: 'from', type: 'Person' },
          { name: 'to', type: 'Person' },
          { name: 'contents', type: 'string' },
          { name: 'replyTo', type: 'Mail' },
        ],
      };
      const primaryType = 'Mail';
      const message = {
        from: {
          name: 'Cow',
          wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
        },
        to: {
          name: 'Bob',
          wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
        },
        contents: 'Hello, Bob!',
        replyTo: {
          to: {
            name: 'Cow',
            wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
          },
          from: {
            name: 'Bob',
            wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
          },
          contents: 'Hello!',
        },
      };
      await ethereumSignMessageWrapper({
        type: ETHMessageTypes.TYPED_DATA_V3,
        message: JSON.stringify({
          types,
          primaryType,
          message,
        }),
      });

      expect(messageHashResult).toMatchSnapshot();
    });

    test('should throw an error when trying to hash a custom type array', async () => {
      const types = {
        Message: [{ name: 'data', type: 'string[]' }],
      };
      const primaryType = 'Message';
      const message = { data: ['1', '2', '3'] };

      await expect(
        ethereumSignMessageWrapper({
          type: ETHMessageTypes.TYPED_DATA_V3,
          message: JSON.stringify({
            types,
            primaryType,
            message,
          }),
        }),
      ).rejects.toThrow(
        'Arrays are unimplemented in encodeData; use V4 extension',
      );
    });
    test('should ignore extra unspecified message properties', async () => {
      const types = {
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'address' },
        ],
        Mail: [
          { name: 'from', type: 'Person' },
          { name: 'to', type: 'Person' },
          { name: 'contents', type: 'string' },
        ],
      };
      const primaryType = 'Mail';
      const message = {
        from: {
          name: 'Cow',
          wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
        },
        to: {
          name: 'Bob',
          wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
        },
        contents: 'Hello, Bob!',
      };

      await ethereumSignMessageWrapper({
        type: ETHMessageTypes.TYPED_DATA_V3,
        message: JSON.stringify({
          types,
          primaryType,
          message,
        }),
      });

      const originalSignature = messageHashResult;
      const messageWithExtraProperties = { ...message, foo: 'bar' };
      await ethereumSignMessageWrapper({
        type: ETHMessageTypes.TYPED_DATA_V3,
        message: JSON.stringify({
          types,
          primaryType,
          message: messageWithExtraProperties,
        }),
      });

      const signatureWithExtraProperties = messageHashResult;

      expect(originalSignature).toBe(signatureWithExtraProperties);
    });

    test('should throw an error when an atomic property is set to null', async () => {
      const types = {
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'address' },
        ],
        Mail: [
          { name: 'from', type: 'Person' },
          { name: 'to', type: 'Person' },
          { name: 'contents', type: 'string' },
          { name: 'length', type: 'int32' },
        ],
      };
      const primaryType = 'Mail';
      const message = {
        from: {
          name: 'Cow',
          wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
        },
        to: {
          name: 'Bob',
          wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
        },
        contents: 'Hello!',
        length: null,
      };

      await expect(
        ethereumSignMessageWrapper({
          type: ETHMessageTypes.TYPED_DATA_V3,
          message: JSON.stringify({
            types,
            primaryType,
            message,
          }),
        }),
      ).rejects.toThrow("Cannot read properties of null (reading 'toArray')");
    });

    test('should hash data with an atomic property set to undefined', async () => {
      const types = {
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'address' },
        ],
        Mail: [
          { name: 'from', type: 'Person' },
          { name: 'to', type: 'Person' },
          { name: 'contents', type: 'string' },
          { name: 'length', type: 'int32' },
        ],
      };
      const primaryType = 'Mail';
      const message = {
        from: {
          name: 'Cow',
          wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
        },
        to: {
          name: 'Bob',
          wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
        },
        contents: 'Hello!',
        length: undefined,
      };

      await ethereumSignMessageWrapper({
        type: ETHMessageTypes.TYPED_DATA_V3,
        message: JSON.stringify({
          types,
          primaryType,
          message,
        }),
      });

      expect(messageHashResult).toMatchSnapshot();
    });

    test('should hash data with a dynamic property set to null', async () => {
      const types = {
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'address' },
        ],
        Mail: [
          { name: 'from', type: 'Person' },
          { name: 'to', type: 'Person' },
          { name: 'contents', type: 'string' },
        ],
      };
      const primaryType = 'Mail';
      const message = {
        from: {
          name: 'Cow',
          wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
        },
        to: {
          name: 'Bob',
          wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
        },
        contents: null,
      };

      await ethereumSignMessageWrapper({
        type: ETHMessageTypes.TYPED_DATA_V3,
        message: JSON.stringify({
          types,
          primaryType,
          message,
        }),
      });

      expect(messageHashResult).toMatchSnapshot();
    });

    test('should hash data with a dynamic property set to undefined', async () => {
      const types = {
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'address' },
        ],
        Mail: [
          { name: 'from', type: 'Person' },
          { name: 'to', type: 'Person' },
          { name: 'contents', type: 'string' },
        ],
      };
      const primaryType = 'Mail';
      const message = {
        from: {
          name: 'Cow',
          wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
        },
        to: {
          name: 'Bob',
          wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
        },
        contents: undefined,
      };
      await ethereumSignMessageWrapper({
        type: ETHMessageTypes.TYPED_DATA_V3,
        message: JSON.stringify({
          types,
          primaryType,
          message,
        }),
      });

      expect(messageHashResult).toMatchSnapshot();
    });

    test('should throw an error when a custom type property is set to null', async () => {
      const types = {
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'address' },
        ],
        Mail: [
          { name: 'from', type: 'Person' },
          { name: 'to', type: 'Person' },
          { name: 'contents', type: 'string' },
        ],
      };
      const primaryType = 'Mail';
      const message = {
        to: null,
        from: {
          name: 'Cow',
          wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
        },
        contents: 'Hello, Bob!',
      };
      await expect(
        ethereumSignMessageWrapper({
          type: ETHMessageTypes.TYPED_DATA_V3,
          message: JSON.stringify({
            types,
            primaryType,
            message,
          }),
        }),
      ).rejects.toThrow("Cannot read properties of null (reading 'name')");
    });

    test('should hash data with a custom type property set to undefined', async () => {
      const types = {
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'address' },
        ],
        Mail: [
          { name: 'from', type: 'Person' },
          { name: 'to', type: 'Person' },
          { name: 'contents', type: 'string' },
        ],
      };
      const primaryType = 'Mail';
      const message = {
        from: {
          name: 'Cow',
          wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
        },
        to: undefined,
        contents: 'Hello, Bob!',
      };

      await ethereumSignMessageWrapper({
        type: ETHMessageTypes.TYPED_DATA_V3,
        message: JSON.stringify({
          types,
          primaryType,
          message,
        }),
      });

      expect(messageHashResult).toMatchSnapshot();
    });

    test('should throw an error when trying to hash a function', async () => {
      const types = {
        Message: [{ name: 'data', type: 'function' }],
      };
      const primaryType = 'Message';
      const message = { data: 'test' };

      await expect(
        ethereumSignMessageWrapper({
          type: ETHMessageTypes.TYPED_DATA_V3,
          message: JSON.stringify({
            types,
            primaryType,
            message,
          }),
        }),
      ).rejects.toThrow('Unsupported or invalid type: function');
    });

    test('should throw an error when trying to hash with a missing primary type definition', async () => {
      const types = {};
      const message = { data: 'test' };
      const primaryType = 'Message';

      await expect(
        ethereumSignMessageWrapper({
          type: ETHMessageTypes.TYPED_DATA_V3,
          message: JSON.stringify({
            types,
            primaryType,
            message,
          }),
        }),
      ).rejects.toThrow('No type definition specified: Message');
    });

    test('should throw an error when trying to hash an unrecognized type', async () => {
      const types = {
        Message: [{ name: 'data', type: 'foo' }],
      };
      const message = { data: 'test' };
      const primaryType = 'Message';

      await expect(
        ethereumSignMessageWrapper({
          type: ETHMessageTypes.TYPED_DATA_V3,
          message: JSON.stringify({
            types,
            primaryType,
            message,
          }),
        }),
      ).rejects.toThrow('Unsupported or invalid type: foo');
    });

    test('should hash data when given extraneous types', async () => {
      const types = {
        Message: [{ name: 'data', type: 'string' }],
        Extra: [{ name: 'data', type: 'string' }],
      };
      const message = { data: 'Hello!' };
      const primaryType = 'Message';

      await ethereumSignMessageWrapper({
        type: ETHMessageTypes.TYPED_DATA_V3,
        message: JSON.stringify({
          types,
          primaryType,
          message,
        }),
      });

      expect(messageHashResult).toMatchSnapshot();
    });
  });

  describe('TYPE_DATA_V4', () => {
    test('should hash data with custom type', async () => {
      const types = {
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'address' },
        ],
        Mail: [
          { name: 'from', type: 'Person' },
          { name: 'to', type: 'Person' },
          { name: 'contents', type: 'string' },
        ],
      };
      const primaryType = 'Mail';
      const message = {
        from: {
          name: 'Cow',
          wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
        },
        to: {
          name: 'Bob',
          wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
        },
        contents: 'Hello, Bob!',
      };
      await ethereumSignMessageWrapper({
        type: ETHMessageTypes.TYPED_DATA_V4,
        message: JSON.stringify({
          types,
          primaryType,
          message,
        }),
      });

      expect(messageHashResult).toMatchSnapshot();
    });

    test('should hash data with a recursive data type', async () => {
      const types = {
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'address' },
        ],
        Mail: [
          { name: 'from', type: 'Person' },
          { name: 'to', type: 'Person' },
          { name: 'contents', type: 'string' },
          { name: 'replyTo', type: 'Mail' },
        ],
      };
      const primaryType = 'Mail';
      const message = {
        from: {
          name: 'Cow',
          wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
        },
        to: {
          name: 'Bob',
          wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
        },
        contents: 'Hello, Bob!',
        replyTo: {
          to: {
            name: 'Cow',
            wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
          },
          from: {
            name: 'Bob',
            wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
          },
          contents: 'Hello!',
        },
      };

      await ethereumSignMessageWrapper({
        type: ETHMessageTypes.TYPED_DATA_V4,
        message: JSON.stringify({
          types,
          primaryType,
          message,
        }),
      });

      expect(messageHashResult).toMatchSnapshot();
    });

    test('should hash data with a custom data type array', async () => {
      const types = {
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'address[]' },
        ],
        Mail: [
          { name: 'from', type: 'Person' },
          { name: 'to', type: 'Person[]' },
          { name: 'contents', type: 'string' },
        ],
      };
      const primaryType = 'Mail';
      const message = {
        from: {
          name: 'Cow',
          wallet: [
            '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
            '0xDD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
          ],
        },
        to: [
          {
            name: 'Bob',
            wallet: ['0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB'],
          },
        ],
        contents: 'Hello, Bob!',
      };

      await ethereumSignMessageWrapper({
        type: ETHMessageTypes.TYPED_DATA_V4,
        message: JSON.stringify({
          types,
          primaryType,
          message,
        }),
      });

      expect(messageHashResult).toMatchSnapshot();
    });

    test('should ignore extra unspecified message properties', async () => {
      const types = {
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'address' },
        ],
        Mail: [
          { name: 'from', type: 'Person' },
          { name: 'to', type: 'Person' },
          { name: 'contents', type: 'string' },
        ],
      };
      const primaryType = 'Mail';
      const message = {
        from: {
          name: 'Cow',
          wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
        },
        to: {
          name: 'Bob',
          wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
        },
        contents: 'Hello, Bob!',
      };

      await ethereumSignMessageWrapper({
        type: ETHMessageTypes.TYPED_DATA_V4,
        message: JSON.stringify({
          types,
          primaryType,
          message,
        }),
      });

      const originalSignature = messageHashResult;
      const messageWithExtraProperties = { ...message, foo: 'bar' };
      await ethereumSignMessageWrapper({
        type: ETHMessageTypes.TYPED_DATA_V4,
        message: JSON.stringify({
          types,
          primaryType,
          message: messageWithExtraProperties,
        }),
      });

      const signatureWithExtraProperties = messageHashResult;

      expect(originalSignature).toBe(signatureWithExtraProperties);
    });

    test('should throw an error when an atomic property is set to null', async () => {
      const types = {
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'address' },
        ],
        Mail: [
          { name: 'from', type: 'Person' },
          { name: 'to', type: 'Person' },
          { name: 'contents', type: 'string' },
          { name: 'length', type: 'int32' },
        ],
      };
      const primaryType = 'Mail';
      const message = {
        from: {
          name: 'Cow',
          wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
        },
        to: {
          name: 'Bob',
          wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
        },
        contents: 'Hello!',
        length: null,
      };

      await expect(
        ethereumSignMessageWrapper({
          type: ETHMessageTypes.TYPED_DATA_V4,
          message: JSON.stringify({
            types,
            primaryType,
            message,
          }),
        }),
      ).rejects.toThrow("Cannot read properties of null (reading 'toArray')");
    });

    test('should throw an error when an atomic property is set to undefined', async () => {
      const types = {
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'address' },
        ],
        Mail: [
          { name: 'from', type: 'Person' },
          { name: 'to', type: 'Person' },
          { name: 'contents', type: 'string' },
          { name: 'length', type: 'int32' },
        ],
      };
      const primaryType = 'Mail';
      const message = {
        from: {
          name: 'Cow',
          wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
        },
        to: {
          name: 'Bob',
          wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
        },
        contents: 'Hello!',
        length: undefined,
      };

      await expect(
        ethereumSignMessageWrapper({
          type: ETHMessageTypes.TYPED_DATA_V4,
          message: JSON.stringify({
            types,
            primaryType,
            message,
          }),
        }),
      ).rejects.toThrow('missing value for field length of type int32');
    });

    test('should hash data with a dynamic property set to null', async () => {
      const types = {
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'address' },
        ],
        Mail: [
          { name: 'from', type: 'Person' },
          { name: 'to', type: 'Person' },
          { name: 'contents', type: 'string' },
        ],
      };
      const primaryType = 'Mail';
      const message = {
        from: {
          name: 'Cow',
          wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
        },
        to: {
          name: 'Bob',
          wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
        },
        contents: null,
      };
      await ethereumSignMessageWrapper({
        type: ETHMessageTypes.TYPED_DATA_V4,
        message: JSON.stringify({
          types,
          primaryType,
          message,
        }),
      });

      expect(messageHashResult).toMatchSnapshot();
    });

    test('should throw an error when a dynamic property is set to undefined', async () => {
      const types = {
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'address' },
        ],
        Mail: [
          { name: 'from', type: 'Person' },
          { name: 'to', type: 'Person' },
          { name: 'contents', type: 'string' },
        ],
      };
      const primaryType = 'Mail';
      const message = {
        from: {
          name: 'Cow',
          wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
        },
        to: {
          name: 'Bob',
          wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
        },
        contents: undefined,
      };

      await expect(
        ethereumSignMessageWrapper({
          type: ETHMessageTypes.TYPED_DATA_V4,
          message: JSON.stringify({
            types,
            primaryType,
            message,
          }),
        }),
      ).rejects.toThrow('missing value for field contents of type string');
    });

    test('should hash data with a custom type property set to null', async () => {
      const types = {
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'address' },
        ],
        Mail: [
          { name: 'from', type: 'Person' },
          { name: 'to', type: 'Person' },
          { name: 'contents', type: 'string' },
        ],
      };
      const primaryType = 'Mail';
      const message = {
        to: null,
        from: {
          name: 'Cow',
          wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
        },
        contents: 'Hello, Bob!',
      };

      await ethereumSignMessageWrapper({
        type: ETHMessageTypes.TYPED_DATA_V4,
        message: JSON.stringify({
          types,
          primaryType,
          message,
        }),
      });

      expect(messageHashResult).toMatchSnapshot();
    });

    test('should hash data with a custom type property set to undefined', async () => {
      const types = {
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'address' },
        ],
        Mail: [
          { name: 'from', type: 'Person' },
          { name: 'to', type: 'Person' },
          { name: 'contents', type: 'string' },
        ],
      };
      const primaryType = 'Mail';
      const message = {
        from: {
          name: 'Cow',
          wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
        },
        to: undefined,
        contents: 'Hello, Bob!',
      };

      await ethereumSignMessageWrapper({
        type: ETHMessageTypes.TYPED_DATA_V4,
        message: JSON.stringify({
          types,
          primaryType,
          message,
        }),
      });

      expect(messageHashResult).toMatchSnapshot();
    });

    test('should throw an error when trying to hash a function', async () => {
      const types = {
        Message: [{ name: 'data', type: 'function' }],
      };
      const message = { data: 'test' };
      const primaryType = 'Message';

      await expect(
        ethereumSignMessageWrapper({
          type: ETHMessageTypes.TYPED_DATA_V4,
          message: JSON.stringify({
            types,
            primaryType,
            message,
          }),
        }),
      ).rejects.toThrow('Unsupported or invalid type: function');
    });

    test('should throw an error when trying to hash with a missing primary type definition', async () => {
      const types = {};
      const message = { data: 'test' };
      const primaryType = 'Message';

      await expect(
        ethereumSignMessageWrapper({
          type: ETHMessageTypes.TYPED_DATA_V4,
          message: JSON.stringify({
            types,
            primaryType,
            message,
          }),
        }),
      ).rejects.toThrow('No type definition specified: Message');
    });

    test('should throw an error when trying to hash an unrecognized type', async () => {
      const types = {
        Message: [{ name: 'data', type: 'foo' }],
      };
      const message = { data: 'test' };
      const primaryType = 'Message';

      await expect(
        ethereumSignMessageWrapper({
          type: ETHMessageTypes.TYPED_DATA_V4,
          message: JSON.stringify({
            types,
            primaryType,
            message,
          }),
        }),
      ).rejects.toThrow('Unsupported or invalid type: foo');
    });

    test('should hash data when given extraneous types', async () => {
      const types = {
        Message: [{ name: 'data', type: 'string' }],
        Extra: [{ name: 'data', type: 'string' }],
      };
      const message = { data: 'Hello!' };
      const primaryType = 'Message';

      await ethereumSignMessageWrapper({
        type: ETHMessageTypes.TYPED_DATA_V4,
        message: JSON.stringify({
          types,
          primaryType,
          message,
        }),
      });

      expect(messageHashResult).toMatchSnapshot();
    });
  });

  describe('TYPE_DATA_V3/V4 identical encodings', () => {
    test('should hash data with custom type', async () => {
      const types = {
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'address' },
        ],
        Mail: [
          { name: 'from', type: 'Person' },
          { name: 'to', type: 'Person' },
          { name: 'contents', type: 'string' },
        ],
      };
      const primaryType = 'Mail';
      const message = {
        from: {
          name: 'Cow',
          wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
        },
        to: {
          name: 'Bob',
          wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
        },
        contents: 'Hello, Bob!',
      };

      await ethereumSignMessageWrapper({
        type: ETHMessageTypes.TYPED_DATA_V3,
        message: JSON.stringify({
          types,
          primaryType,
          message,
        }),
      });

      const v3Signature = messageHashResult;

      await ethereumSignMessageWrapper({
        type: ETHMessageTypes.TYPED_DATA_V4,
        message: JSON.stringify({
          types,
          primaryType,
          message,
        }),
      });

      const v4Signature = messageHashResult;

      expect(v3Signature).toBe(v4Signature);
    });
    test('should ignore extra unspecified message properties', async () => {
      const types = {
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'address' },
        ],
        Mail: [
          { name: 'from', type: 'Person' },
          { name: 'to', type: 'Person' },
          { name: 'contents', type: 'string' },
        ],
      };
      const primaryType = 'Mail';
      const message = {
        from: {
          name: 'Cow',
          wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
        },
        to: {
          name: 'Bob',
          wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
        },
        contents: 'Hello, Bob!',
      };

      await ethereumSignMessageWrapper({
        type: ETHMessageTypes.TYPED_DATA_V3,
        message: JSON.stringify({
          types,
          primaryType,
          message,
        }),
      });

      const originalV3Signature = messageHashResult;

      await ethereumSignMessageWrapper({
        type: ETHMessageTypes.TYPED_DATA_V4,
        message: JSON.stringify({
          types,
          primaryType,
          message,
        }),
      });

      const originalV4Signature = messageHashResult;

      const messageWithExtraProperties = { ...message, foo: 'bar' };

      await ethereumSignMessageWrapper({
        type: ETHMessageTypes.TYPED_DATA_V3,
        message: JSON.stringify({
          types,
          primaryType,
          message: messageWithExtraProperties,
        }),
      });

      const v3signatureWithExtraProperties = messageHashResult;

      await ethereumSignMessageWrapper({
        type: ETHMessageTypes.TYPED_DATA_V4,
        message: JSON.stringify({
          types,
          primaryType,
          message: messageWithExtraProperties,
        }),
      });

      const v4signatureWithExtraProperties = messageHashResult;

      expect(originalV3Signature).toBe(originalV4Signature);
      expect(v3signatureWithExtraProperties).toBe(
        v4signatureWithExtraProperties,
      );
    });
    test('should hash data with a dynamic property set to null', async () => {
      const types = {
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'address' },
        ],
        Mail: [
          { name: 'from', type: 'Person' },
          { name: 'to', type: 'Person' },
          { name: 'contents', type: 'string' },
        ],
      };
      const primaryType = 'Mail';
      const message = {
        from: {
          name: 'Cow',
          wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
        },
        to: {
          name: 'Bob',
          wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
        },
        contents: null,
      };

      await ethereumSignMessageWrapper({
        type: ETHMessageTypes.TYPED_DATA_V3,
        message: JSON.stringify({
          types,
          primaryType,
          message,
        }),
      });

      const v3Signature = messageHashResult;

      await ethereumSignMessageWrapper({
        type: ETHMessageTypes.TYPED_DATA_V4,
        message: JSON.stringify({
          types,
          primaryType,
          message,
        }),
      });

      const v4Signature = messageHashResult;

      expect(v3Signature).toBe(v4Signature);
    });
    test('should hash data when given extraneous types', async () => {
      const types = {
        Message: [{ name: 'data', type: 'string' }],
        Extra: [{ name: 'data', type: 'string' }],
      };
      const message = { data: 'Hello!' };
      const primaryType = 'Message';

      await ethereumSignMessageWrapper({
        type: ETHMessageTypes.TYPED_DATA_V3,
        message: JSON.stringify({
          types,
          primaryType,
          message,
        }),
      });

      const v3Signature = messageHashResult;

      await ethereumSignMessageWrapper({
        type: ETHMessageTypes.TYPED_DATA_V4,
        message: JSON.stringify({
          types,
          primaryType,
          message,
        }),
      });

      const v4Signature = messageHashResult;

      expect(v3Signature).toBe(v4Signature);
    });
  });

  describe('TYPE_DATA_V3/V4 encoding differences', () => {
    test('should hash data with recursive data differently', async () => {
      const types = {
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'address' },
        ],
        Mail: [
          { name: 'from', type: 'Person' },
          { name: 'to', type: 'Person' },
          { name: 'contents', type: 'string' },
          { name: 'replyTo', type: 'Mail' },
        ],
      };
      const primaryType = 'Mail';
      const message = {
        from: {
          name: 'Cow',
          wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
        },
        to: {
          name: 'Bob',
          wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
        },
        contents: 'Hello, Bob!',
        replyTo: {
          to: {
            name: 'Cow',
            wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
          },
          from: {
            name: 'Bob',
            wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
          },
          contents: 'Hello!',
        },
      };

      await ethereumSignMessageWrapper({
        type: ETHMessageTypes.TYPED_DATA_V3,
        message: JSON.stringify({
          types,
          primaryType,
          message,
        }),
      });

      const v3Signature = messageHashResult;

      await ethereumSignMessageWrapper({
        type: ETHMessageTypes.TYPED_DATA_V4,
        message: JSON.stringify({
          types,
          primaryType,
          message,
        }),
      });

      const v4Signature = messageHashResult;

      expect(v3Signature).not.toBe(v4Signature);
    });
    test('should hash missing custom type properties differently', async () => {
      const types = {
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'address' },
        ],
        Mail: [
          { name: 'from', type: 'Person' },
          { name: 'to', type: 'Person' },
          { name: 'contents', type: 'string' },
        ],
      };
      const primaryType = 'Mail';
      const message = {
        from: {
          name: 'Cow',
          wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
        },
        contents: 'Hello, Bob!',
      };

      await ethereumSignMessageWrapper({
        type: ETHMessageTypes.TYPED_DATA_V3,
        message: JSON.stringify({
          types,
          primaryType,
          message,
        }),
      });

      const v3Signature = messageHashResult;

      await ethereumSignMessageWrapper({
        type: ETHMessageTypes.TYPED_DATA_V4,
        message: JSON.stringify({
          types,
          primaryType,
          message,
        }),
      });

      const v4Signature = messageHashResult;

      expect(v3Signature).not.toBe(v4Signature);
    });
  });
});
