import type {
  IBaseValue,
  IChainValue,
  IEthereumValue,
} from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import chainValueUtils from '@onekeyhq/shared/src/utils/chainValueUtils';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';
import type { IToken } from '@onekeyhq/shared/types/token';

export const parseOnChainAmount = async (
  value: {
    type: EQRCodeHandlerType;
    data: IBaseValue;
  },
  token: IToken | null,
): Promise<string> => {
  const data = value.data as IChainValue;
  if (
    data.network &&
    data.network.id &&
    value.type === EQRCodeHandlerType.ETHEREUM
  ) {
    const chainValue = value.data as IEthereumValue;
    if (token?.isNative === false) {
      if (chainValue.uint256) {
        return chainValueUtils.convertTokenChainValueToAmount({
          value: chainValue.uint256,
          token,
        });
      }
      return '';
    }

    if (chainValue.value && token) {
      return chainValueUtils.convertTokenChainValueToAmount({
        value: chainValue.value,
        token,
      });
    }

    if (chainValue.amount) {
      return String(chainValue.amount);
    }
  }
  return data.amount ? String(data.amount) : '';
};
