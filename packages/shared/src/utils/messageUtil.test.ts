import { ETHMessageTypes } from '@onekeyhq/engine/src/types/message';

import * as messageUtils from './messageUtils';

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
