import platformEnv from '@onekeyhq/shared/src/platformEnv';
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
) => {
  if (!value || typeof value !== 'string') {
    return null;
  }
  // Pay on extension is deferred (MV3 wasm CSP); let payment links fall
  // through to the regular handlers there.
  if (platformEnv.isExtension) {
    return null;
  }
  // Recognition only — platform capability (durable progress) is NOT
  // checked here: a wc: pay URI falling through to the pairing handler
  // would silently fail pair(), so an unsupported platform must still
  // recognize the link and surface an explicit refusal at the entry
  // decision point (useParseQRCode / deeplink) instead
  let matched = false;
  try {
    // cheap shape/domain filter first so unrelated QR codes (bare addresses,
    // plain URLs) never pay the cost of loading walletkit — which bundles
    // the whole @walletconnect/pay stack and must stay out of the background
    // startup graph; load it on demand only for plausible payment links
    if (validateWcPayLinkDomain(value)) {
      const { isPaymentLink } = await import('@reown/walletkit');
      matched = isPaymentLink(value);
    }
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
