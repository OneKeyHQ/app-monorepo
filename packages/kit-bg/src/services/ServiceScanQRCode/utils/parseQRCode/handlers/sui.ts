import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';

import { parsePayUrl } from './utils';

import type { IQRCodeHandler, ISuiValue } from '../type';

const sui: IQRCodeHandler<ISuiValue> = async (value, options) => {
  const urlValue = options?.urlResult;
  if (urlValue && /sui/i.test(urlValue.data.urlSchema)) {
    const { address, targetAddress } = parsePayUrl(urlValue.data.url);
    return {
      type: EQRCodeHandlerType.SUI,
      data: {
        network: await options?.backgroundApi?.serviceNetwork?.getNetwork?.({
          networkId: getNetworkIdsMap().sui,
        }),
        address,
        targetAddress,
      },
    };
  }
  return null;
};

export default sui;
