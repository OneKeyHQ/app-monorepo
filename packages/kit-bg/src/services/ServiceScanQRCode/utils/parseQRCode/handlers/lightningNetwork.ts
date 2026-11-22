import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  getLightningInvoiceNetwork,
  hasLightningUriScheme,
  isLightningAddress,
  isLnurlCode,
  normalizeLightningInput,
} from '@onekeyhq/shared/src/utils/lnUrlUtils';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';

import type { ILightningNetworkValue, IQRCodeHandler } from '../type';

const lightningNetwork: IQRCodeHandler<ILightningNetworkValue> = async (
  value,
  options,
) => {
  if (!value) {
    return null;
  }
  const address = normalizeLightningInput(value);
  const invoiceNetwork = getLightningInvoiceNetwork(address);
  const isLnurl = isLnurlCode(address);
  // A bare `name@host` cannot be told from an email address, so a lightning
  // address is only taken when the code says `lightning:`.
  const isAddress = hasLightningUriScheme(value) && isLightningAddress(address);
  if (!invoiceNetwork && !isLnurl && !isAddress) {
    return null;
  }

  const networkIds = getNetworkIdsMap();
  const network = await options?.backgroundApi?.serviceNetwork?.getNetwork?.({
    networkId:
      invoiceNetwork === 'testnet'
        ? networkIds.tlightning
        : networkIds.lightning,
  });

  // An invoice is decoded by the send page; only an LNURL or a lightning
  // address resolves to a tag here.
  const lnurlDetails = invoiceNetwork
    ? undefined
    : await options?.backgroundApi?.serviceLightning?.findAndValidateLnurl?.({
        toVal: address,
        networkId: network?.id ?? '',
      });
  return {
    type: EQRCodeHandlerType.LIGHTNING_NETWORK,
    data: {
      address,
      network,
      tag: lnurlDetails?.tag,
      k1: lnurlDetails?.url,
    },
  };
};

export default lightningNetwork;
