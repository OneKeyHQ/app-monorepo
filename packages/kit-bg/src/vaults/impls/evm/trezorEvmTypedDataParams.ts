import { TypedDataUtils } from 'eth-sig-util';

import type { IUnsignedMessageEth } from '@onekeyhq/core/src/types';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

// Trezor-only. Builds the EIP-712 hashes the Trezor SDK's evmSignTypedData
// expects. Domain-only typed data (primaryType === 'EIP712Domain') omits
// messageHash — the device signs the domain separator alone (matches MetaMask,
// which drops the message-struct hash in that case). Kept fully separate from
// the OneKey hardware path so Trezor changes never touch OneKey signing.
export function buildTrezorEvmTypedDataParams(message: IUnsignedMessageEth) {
  const metamaskV4Compat = message.type === EMessageTypesEth.TYPED_DATA_V4;
  const data = JSON.parse(message.message);
  const typedData = TypedDataUtils.sanitizeData(data);
  const domainSeparatorHash = TypedDataUtils.hashStruct(
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

  return { data, metamaskV4Compat, domainSeparatorHash, messageHash };
}
