import * as signUtil from '@metamask/eth-sig-util'; // TODO patch legacyToBuffer in app-monorepo
import * as ethUtil from 'ethereumjs-util';

import { EMessageTypesEth } from '@onekeyhq/engine/src/types/message';

export type HashMessageParams =
  | {
      messageType: EMessageTypesEth.ETH_SIGN | EMessageTypesEth.PERSONAL_SIGN;
      message: string;
    }
  | {
      messageType: EMessageTypesEth.TYPED_DATA_V1;
      message: string | Array<unknown>;
    }
  | {
      messageType:
        | EMessageTypesEth.TYPED_DATA_V3
        | EMessageTypesEth.TYPED_DATA_V4;
      message: string | Record<string, unknown>;
    };

const hashMessage = ({ messageType, message }: HashMessageParams): string => {
  switch (messageType) {
    case EMessageTypesEth.ETH_SIGN:
      return ethUtil.addHexPrefix(message);
    case EMessageTypesEth.PERSONAL_SIGN:
      return ethUtil.addHexPrefix(
        ethUtil
          // @ts-ignore
          .hashPersonalMessage(signUtil.legacyToBuffer(message))
          .toString('hex'),
      );
    case EMessageTypesEth.TYPED_DATA_V1:
      return ethUtil.addHexPrefix(
        signUtil.typedSignatureHash(
          typeof message === 'string' ? JSON.parse(message) : message,
        ),
      );
    case EMessageTypesEth.TYPED_DATA_V3:
      return ethUtil.addHexPrefix(
        signUtil.TypedDataUtils.eip712Hash(
          typeof message === 'string' ? JSON.parse(message) : message,
          signUtil.SignTypedDataVersion.V3,
        ).toString('hex'),
      );
    case EMessageTypesEth.TYPED_DATA_V4:
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

export { hashMessage };
