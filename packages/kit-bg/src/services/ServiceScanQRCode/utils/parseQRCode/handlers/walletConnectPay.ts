import { isPaymentLink } from '@reown/walletkit';

import { validateWcPayLinkDomain } from '@onekeyhq/shared/src/walletConnect/payConstant';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';

import type { IQRCodeHandler, IWalletConnectPayValue } from '../type';

/*
WalletConnect Pay link forms:
- https://pay.walletconnect.com/pay_123
- https://pay.walletconnect.com/?pid=pay_123
- wc:...@2?...&pay=...
The SDK's isPaymentLink matches loosely, so URL forms are additionally
restricted to the pay.walletconnect.com host. Must be registered BEFORE the
`walletconnect` handler so payment links are not treated as pairing URIs.
*/
const walletConnectPay: IQRCodeHandler<IWalletConnectPayValue> = async (
  value,
  options,
) => {
  if (!value || typeof value !== 'string') {
    return null;
  }
  // feature-gated in the app runtime; unit tests exercise the matching
  // logic without a backgroundApi
  if (options?.backgroundApi) {
    const enabled =
      await options.backgroundApi.serviceWalletConnectPay.isPayFeatureEnabled();
    if (!enabled) {
      return null;
    }
  }
  let matched = false;
  try {
    matched = isPaymentLink(value) && validateWcPayLinkDomain(value);
  } catch {
    matched = false;
  }
  if (!matched) {
    return null;
  }
  return {
    type: EQRCodeHandlerType.WALLET_CONNECT_PAY,
    data: {
      paymentLink: value,
    },
  };
};

export default walletConnectPay;
