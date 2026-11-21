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
import systemTimeUtils from '@onekeyhq/shared/src/utils/systemTimeUtils';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';

import type { ILightningNetworkValue, IQRCodeHandler } from '../type';

const DEFAULT_INVOICE_EXPIRY_SECONDS = 3600;

export async function assertLightningInvoiceIsCurrent(expiresAt: number) {
  const serverTime = await systemTimeUtils
    .getFreshEstimatedServerTime()
    .catch(() => undefined);
  assertLightningInvoiceIsCurrentAt(expiresAt, serverTime);
}

export function assertLightningInvoiceIsCurrentAt(
  expiresAt: number,
  serverTime: number | undefined,
) {
  if (serverTime === undefined) {
    throw new RetryableLightningScanError({
      message: 'Lightning invoice time check temporarily unavailable',
      autoToast: false,
    });
  }
  if (expiresAt <= serverTime / 1000) {
    throw new InvoiceExpiredError({ autoToast: false });
  }
}

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
  let expiresAt: number | undefined;
  if (!lnurl && !isAddress) {
    const invoiceNetwork = getLightningInvoiceNetwork(address);
    if (!invoiceNetwork) {
      return null;
    }

    const isTestnet = invoiceNetwork === 'testnet';
    networkId = isTestnet ? networkIds.tlightning : networkIds.lightning;
    // Decode before the scan action can offer to create a Lightning account.
    // The decoder needs the invoice only and does not require a payer.
    const decodedInvoice = await backgroundApi.serviceLightning
      .getLnClient(isTestnet)
      .then((client) => client.decodedInvoice(address))
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
    expiresAt =
      timeExpireDate ??
      (timestamp === undefined
        ? undefined
        : timestamp +
          (tagsObject?.expire_time ?? DEFAULT_INVOICE_EXPIRY_SECONDS));
    if (expiresAt !== undefined)
      await assertLightningInvoiceIsCurrent(expiresAt);
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
      expiresAt,
      tag: lnurlDetails?.tag,
      k1: lnurlDetails?.url,
    },
  };
};

export default lightningNetwork;
