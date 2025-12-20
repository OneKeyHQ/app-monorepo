import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';

import type { ILightningNetworkValue, IQRCodeHandler } from '../type';

const lightningNetwork: IQRCodeHandler<ILightningNetworkValue> = async (
  value,
  options,
) => {
  if (value && value.startsWith('lnurl')) {
    const network = await options?.backgroundApi?.serviceNetwork?.getNetwork?.({
      networkId: getNetworkIdsMap().lightning,
    });

    const lnurlDetails =
      await options?.backgroundApi?.serviceLightning?.findAndValidateLnurl?.({
        toVal: value,
        networkId: network?.id ?? '',
      });
    return {
      type: EQRCodeHandlerType.LIGHTNING_NETWORK,
      data: {
        address: value,
        network,
        tag: lnurlDetails?.tag,
        k1: lnurlDetails?.url,
      },
    };
  }
  return null;
};

export default lightningNetwork;
