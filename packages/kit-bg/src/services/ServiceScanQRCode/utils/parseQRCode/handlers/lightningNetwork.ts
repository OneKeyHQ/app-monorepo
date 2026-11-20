import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  isLightningAddress,
  normalizeLightningInput,
} from '@onekeyhq/shared/src/utils/lnUrlUtils';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';

import type { ILightningNetworkValue, IQRCodeHandler } from '../type';

// `ln` + network + optional amount, then the bech32 separator and data part.
const BOLT11_INVOICE = /^ln(bcrt|bc|tbs|tb)(\d+[munp]?)?1[02-9ac-hj-np-z]+$/;
const LIGHTNING_URI = /^\s*lightning:/i;

const lightningNetwork: IQRCodeHandler<ILightningNetworkValue> = async (
  value,
  options,
) => {
  if (!value) {
    return null;
  }
  const address = normalizeLightningInput(value);
  const invoice = BOLT11_INVOICE.exec(address);
  const isLnurl = /^lnurl/i.test(address);
  // A bare `name@host` cannot be told from an email address, so a lightning
  // address is only taken when the code says `lightning:`.
  const isAddress = LIGHTNING_URI.test(value) && isLightningAddress(address);
  if (!invoice && !isLnurl && !isAddress) {
    return null;
  }

  const networkIds = getNetworkIdsMap();
  const network = await options?.backgroundApi?.serviceNetwork?.getNetwork?.({
    networkId:
      invoice && invoice[1] !== 'bc'
        ? networkIds.tlightning
        : networkIds.lightning,
  });

  // An invoice is decoded by the send page; only an LNURL or a lightning
  // address resolves to a tag here.
  const lnurlDetails = invoice
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
