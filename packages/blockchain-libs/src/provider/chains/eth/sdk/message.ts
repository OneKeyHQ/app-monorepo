import * as signUtil from '@metamask/eth-sig-util'; // TODO patch legacyToBuffer in app-monorepo
import * as ethUtil from 'ethereumjs-util';

enum MessageTypes {
  ETH_SIGN = 0,
  PERSONAL_SIGN = 1,
  TYPE_DATA_V1 = 2,
  TYPE_DATA_V3 = 3,
  TYPE_DATA_V4 = 4,
}

type HashMessageParams =
  | {
      messageType: MessageTypes.ETH_SIGN | MessageTypes.PERSONAL_SIGN;
      message: string;
    }
  | {
      messageType: MessageTypes.TYPE_DATA_V1;
      message: string | Array<unknown>;
    }
  | {
      messageType: MessageTypes.TYPE_DATA_V3 | MessageTypes.TYPE_DATA_V4;
      message: string | Record<string, unknown>;
    };

const hashMessage = ({ messageType, message }: HashMessageParams): string => {
  switch (messageType) {
    case MessageTypes.ETH_SIGN:
      return ethUtil.addHexPrefix(message);
    case MessageTypes.PERSONAL_SIGN:
      return ethUtil.addHexPrefix(
        ethUtil
          // @ts-ignore
          .hashPersonalMessage(signUtil.legacyToBuffer(message))
          .toString('hex'),
      );
    case MessageTypes.TYPE_DATA_V1:
      return ethUtil.addHexPrefix(
        signUtil.typedSignatureHash(
          typeof message === 'string' ? JSON.parse(message) : message,
        ),
      );
    case MessageTypes.TYPE_DATA_V3:
      return ethUtil.addHexPrefix(
        signUtil.TypedDataUtils.eip712Hash(
          typeof message === 'string' ? JSON.parse(message) : message,
          signUtil.SignTypedDataVersion.V3,
        ).toString('hex'),
      );
    case MessageTypes.TYPE_DATA_V4:
      return ethUtil.addHexPrefix(
        signUtil.TypedDataUtils.eip712Hash(
          typeof message === 'string' ? JSON.parse(message) : message,
          signUtil.SignTypedDataVersion.V4,
        ).toString('hex'),
      );

    default:
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new Error(`Invalid messageType: ${messageType}`);
  }
};

export { MessageTypes, hashMessage };
