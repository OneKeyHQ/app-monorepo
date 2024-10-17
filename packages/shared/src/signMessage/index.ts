import type { IUnsignedMessage } from '@onekeyhq/core/src/types';

import { EMessageTypesEth } from '../../types/message';

import { PRIMARY_TYPES_PERMIT } from './constants';

import type { EPrimaryTypePermit } from './constants';

export const isEthSignType = ({
  unsignedMessage,
}: {
  unsignedMessage: IUnsignedMessage;
}) => unsignedMessage.type === EMessageTypesEth.ETH_SIGN;

export const isPermitSignType = ({
  unsignedMessage,
}: {
  unsignedMessage: IUnsignedMessage;
}) => {
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
      PRIMARY_TYPES_PERMIT.includes(result.primaryType as EPrimaryTypePermit)
    );
  } catch {
    return false;
  }
};
