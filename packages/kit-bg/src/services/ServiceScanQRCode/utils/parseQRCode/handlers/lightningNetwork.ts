import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  InvoiceExpiredError,
  RetryableLightningScanError,
  isRetryableLightningInvoiceDecodeFailure,
} from '@onekeyhq/shared/src/errors';
import {
  findLnurl,
  getLightningInvoiceNetwork,
  hasLightningUriScheme,
  isLightningAddress,
  normalizeLightningInput,
} from '@onekeyhq/shared/src/utils/lnUrlUtils';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';

import type { ILightningNetworkValue, IQRCodeHandler } from '../type';

const DEFAULT_INVOICE_EXPIRY_SECONDS = 3600;

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
    const invoiceNetwork = getLightningInvoiceNetwork(address);
    if (!invoiceNetwork) {
      return null;
    }

    const isTestnet = invoiceNetwork === 'testnet';
    networkId = isTestnet ? networkIds.tlightning : networkIds.lightning;
    // Decode before the scan action can offer to create a Lightning account.
    // The decoder needs the invoice only and does not require a payer.
    const client = await backgroundApi.serviceLightning.getLnClient(isTestnet);
    const decodedInvoice = await client
      .decodedInvoice(address)
      .catch((error: unknown) => {
        if (isRetryableLightningInvoiceDecodeFailure(error)) {
          throw new RetryableLightningScanError({
            message: 'Lightning invoice decoding temporarily unavailable',
            autoToast: false,
          });
        }
        return undefined;
      });
    if (!decodedInvoice?.paymentRequest) {
      return null;
    }
    const { timeExpireDate, timestamp, tagsObject } = decodedInvoice;
    const expiresAt =
      timeExpireDate ??
      (timestamp === undefined
        ? undefined
        : timestamp +
          (tagsObject?.expire_time ?? DEFAULT_INVOICE_EXPIRY_SECONDS));
    if (expiresAt !== undefined && expiresAt <= Date.now() / 1000) {
      throw new InvoiceExpiredError({ autoToast: false });
    }
  }

  const network = await backgroundApi.serviceNetwork.getNetwork({ networkId });
  const lnurlDetails =
    lnurl || isAddress
      ? await backgroundApi.serviceLightning.findAndValidateLnurl({
          toVal: address,
          networkId: network.id,
          forScan: true,
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
