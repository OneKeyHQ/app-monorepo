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
    const result = parsePayUrl(urlValue.data.url);
    if (result) {
      const { address, targetAddress } = result;
      return {
        type: EQRCodeHandlerType.SUI,
        data: {
          network,
          address,
          targetAddress,
        },
      };
    }
    const [, address] = urlValue.data.url.split('sui:');
    const validateResult =
      await options?.backgroundApi?.serviceValidator?.localValidateAddress?.({
        networkId: getNetworkIdsMap().sui,
        address,
      });
    if (validateResult?.isValid) {
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
