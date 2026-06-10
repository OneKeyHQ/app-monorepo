import { TypedDataUtils } from 'eth-sig-util';

import type { IUnsignedMessageEth } from '@onekeyhq/core/src/types';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

export function buildEvmTypedDataHardwareParams(message: IUnsignedMessageEth) {
  const metamaskV4Compat = message.type === EMessageTypesEth.TYPED_DATA_V4;
  const data = JSON.parse(message.message);
  const typedData = TypedDataUtils.sanitizeData(data);
  const domainHash = TypedDataUtils.hashStruct(
    'EIP712Domain',
    typedData.domain,
    typedData.types,
    metamaskV4Compat,
  ).toString('hex');
  const messageHash =
    typedData.primaryType === 'EIP712Domain'
      ? undefined
      : TypedDataUtils.hashStruct(
          // @ts-expect-error eth-sig-util accepts the sanitized primary type here.
          typedData.primaryType,
          typedData.message,
          typedData.types,
          metamaskV4Compat,
        ).toString('hex');

  return {
    data,
    metamaskV4Compat,
    domainHash,
    domainSeparatorHash: domainHash,
    messageHash,
  };
}
