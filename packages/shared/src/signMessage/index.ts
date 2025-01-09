import type { IUnsignedMessage } from '@onekeyhq/core/src/types';

import { EMessageTypesEth } from '../../types/message';

import { PRIMARY_TYPES_ORDER, PRIMARY_TYPES_PERMIT } from './constants';

export const isEthSignType = ({
  unsignedMessage,
}: {
  unsignedMessage: IUnsignedMessage;
}) => unsignedMessage.type === EMessageTypesEth.ETH_SIGN;

const isPrimaryTypeSign = (
  unsignedMessage: IUnsignedMessage,
  primaryTypes: string[],
): boolean => {
  if (
    unsignedMessage.type !== EMessageTypesEth.TYPED_DATA_V3 &&
    unsignedMessage.type !== EMessageTypesEth.TYPED_DATA_V4
  ) {
    return false;
  }

  const { message } = unsignedMessage;

  try {
    const result = JSON.parse(message) as { primaryType?: string };
    return (
      result.primaryType !== undefined &&
      primaryTypes.includes(result.primaryType)
    );
  } catch {
    return false;
  }
};

export const isPrimaryTypePermitSign = ({
  unsignedMessage,
}: {
  unsignedMessage: IUnsignedMessage;
}) => isPrimaryTypeSign(unsignedMessage, PRIMARY_TYPES_PERMIT);

export const isPrimaryTypeOrderSign = ({
  unsignedMessage,
}: {
  unsignedMessage: IUnsignedMessage;
}) => isPrimaryTypeSign(unsignedMessage, PRIMARY_TYPES_ORDER);

export const parsePrimaryType = ({
  unsignedMessage,
}: {
  unsignedMessage: IUnsignedMessage;
}): string | null => {
  if (
    unsignedMessage.type !== EMessageTypesEth.TYPED_DATA_V3 &&
    unsignedMessage.type !== EMessageTypesEth.TYPED_DATA_V4
  ) {
    return null;
  }

  try {
    const { message } = unsignedMessage;
    const result = JSON.parse(message) as { primaryType?: string };

    if (result.primaryType) {
      return result.primaryType;
    }
  } catch {
    // ignore
  }

  return null;
};
