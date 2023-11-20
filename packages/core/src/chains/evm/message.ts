import { toBuffer } from '@ethereumjs/util';
import * as signUtil from '@metamask/eth-sig-util';
import * as ethUtil from 'ethereumjs-util';
import { isHexString } from 'ethjs-util';

import { EMessageTypesEth } from '../../types';

import type { ToBufferInputTypes } from '@ethereumjs/util';

// https://github.com/MetaMask/eth-sig-util/blob/main/src/utils.ts#L59C13-L59C13
// import { legacyToBuffer } from '@metamask/eth-sig-util/dist/utils';
function legacyToBuffer(value: ToBufferInputTypes) {
  return typeof value === 'string' && !isHexString(value)
    ? Buffer.from(value)
    : toBuffer(value);
}

export type IEvmHashMessageParams =
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

const hashMessage = ({
  messageType,
  message,
}: IEvmHashMessageParams): string => {
  switch (messageType) {
    case EMessageTypesEth.ETH_SIGN:
      return ethUtil.addHexPrefix(message);
    case EMessageTypesEth.PERSONAL_SIGN:
      return ethUtil.addHexPrefix(
        ethUtil.hashPersonalMessage(legacyToBuffer(message)).toString('hex'),
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
