import { bech32 } from 'bech32';

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  findLnurl,
  hasLightningUriScheme,
  isLightningAddress,
  normalizeLightningInput,
} from '@onekeyhq/shared/src/utils/lnUrlUtils';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';

import type { ILightningNetworkValue, IQRCodeHandler } from '../type';

const SUPPORTED_INVOICE_PREFIX = /^ln(bc|tb)(\d+[munp]?)?$/;

const lightningNetwork: IQRCodeHandler<ILightningNetworkValue> = async (
  value,
  options,
) => {
  const backgroundApi = options?.backgroundApi;
  if (!value || !backgroundApi) {
    return null;
  }

  const address = normalizeLightningInput(value);
  const lnurl = findLnurl(address);
  // A bare Lightning Address is indistinguishable from an email address.
  const isAddress = hasLightningUriScheme(value) && isLightningAddress(address);
  const networkIds = getNetworkIdsMap();
  let networkId = networkIds.lightning;
  if (!lnurl && !isAddress) {
    const invoice = bech32.decodeUnsafe(address, address.length);
    const supportedPrefix = SUPPORTED_INVOICE_PREFIX.exec(
      invoice?.prefix ?? '',
    );
    if (!supportedPrefix) {
      return null;
    }

    const isTestnet = supportedPrefix[1] === 'tb';
    networkId = isTestnet ? networkIds.tlightning : networkIds.lightning;
    // Decode before the scan action can offer to create a Lightning account.
    // The decoder needs the invoice only and does not require a payer.
    const client = await backgroundApi.serviceLightning.getLnClient(isTestnet);
    const decodedInvoice = await client.decodedInvoice(address);
    if (!decodedInvoice?.paymentRequest) {
      return null;
    }
  }

  const network = await backgroundApi.serviceNetwork.getNetwork({ networkId });
  const lnurlDetails =
    lnurl || isAddress
      ? await backgroundApi.serviceLightning.findAndValidateLnurl({
          toVal: address,
          networkId: network.id,
        })
      : undefined;

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
