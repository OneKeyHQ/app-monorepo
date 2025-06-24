import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';

import { parsePayUrl } from './utils';

import type { IQRCodeHandler, ISuiValue } from '../type';

const sui: IQRCodeHandler<ISuiValue> = async (value, options) => {
  const urlValue = options?.urlResult;
  if (urlValue && /sui/i.test(urlValue.data.urlSchema)) {
    const network = await options?.backgroundApi?.serviceNetwork?.getNetwork?.({
      networkId: getNetworkIdsMap().sui,
    });
    const checkAddress = async (addr: string) => {
      const validateResult =
        await options?.backgroundApi?.serviceValidator?.localValidateAddress?.({
          networkId: network?.id ?? '',
          address: addr,
        });
      return validateResult?.isValid;
    };
    const result = parsePayUrl(urlValue.data.url);
    if (result && (await checkAddress(result.address))) {
      const { address, tokenAddress } = result;
      return {
        type: EQRCodeHandlerType.SUI,
        data: {
          network,
          address,
          tokenAddress,
        },
      };
    }
    const splits = urlValue.data.url.split('sui:');
    if (splits.length < 2) {
      return null;
    }
    const address = splits.pop();
    if (address && (await checkAddress(address))) {
      return {
        type: EQRCodeHandlerType.SUI,
        data: {
          address,
          network,
        },
      };
    }
  }
  return null;
};

export default sui;
