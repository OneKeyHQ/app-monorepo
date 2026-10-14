import { Toast } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { whenAppUnlocked } from '../../../utils/passwordUtils';
import { openWcPayDialog } from '../../../views/WalletConnectPay/dialog/wcPayDialogStore';

export type IWalletConnectPayLinkResult = {
  type: 'walletConnectPay';
  url: string;
  urlExtracted: string;
};

// The pay flow is a global dialog driven by wcPayDialogStore, not a
// navigation route. The store holds state (not an event), so a deep link
// drained at desktop cold start — before the dialog container has mounted —
// is not lost: the container reads the current state on mount. No
// navigation-retry loop needed anymore.
function openWalletConnectPayModal({ paymentLink }: { paymentLink: string }) {
  // Unlock gate: on native the dialog is a SYSTEM sheet that presents above
  // the RN lock screen (the routed modal it replaced rendered under it), so
  // the link waits for unlock. The payment's absolute deadline keeps ticking
  // meanwhile; an expired link lands on the expired terminal, which is the
  // correct outcome.
  void whenAppUnlocked()
    .then(() => {
      const { opened } = openWcPayDialog({ paymentLink });
      if (!opened) {
        // an in-flight payment is non-dismissible; a second link must not
        // silently replace it (see wcPayDialogStore.openWcPayDialog)
        Toast.error({
          // deep links are handled outside any React tree; the toast fires at
          // event time, long after the locale is initialized
          // eslint-disable-next-line onekey/no-app-locale-main-thread
          title: appLocale.intl.formatMessage({
            id: ETranslations.wc_pay_payment_in_progress__msg,
          }),
        });
      }
    })
    .catch((error) => {
      // whenAppUnlocked itself never rejects; this surfaces a throw from the
      // store listeners or the toast instead of leaving it unhandled
      console.error('openWalletConnectPayModal ERROR: ', error);
    });
}

/**
 * Routes a WalletConnect Pay link (wc:...?pay=..., an extracted ?uri=, or a
 * direct https payment link) into the payment flow. Returns undefined when
 * the strict isPaymentLink verdict rejects the candidate so the deep link
 * handler falls through to dapp pairing.
 *
 * Loaded on demand by the deep link handler: the pay entry (dialog store,
 * copy, toasts) must stay off the main startup graph.
 */
export async function handleWalletConnectPayLink({
  url,
  payLinkCandidate,
}: {
  url: string;
  payLinkCandidate: string;
}): Promise<IWalletConnectPayLinkResult | undefined> {
  if (
    !(await backgroundApiProxy.serviceWalletConnectPay.isPaymentLink({
      uri: payLinkCandidate,
    }))
  ) {
    return undefined;
  }
  // entry decision point: without durable progress no payment can complete,
  // so refuse explicitly. The link was recognized as a payment link, so it
  // must still be consumed here — falling through would hand a pay URI to
  // dapp pairing, which fails silently
  if (
    !(await backgroundApiProxy.serviceWalletConnectPay.supportsDurableProgress())
  ) {
    Toast.error({
      // same as openWalletConnectPayModal: no React tree here, event-time
      // eslint-disable-next-line onekey/no-app-locale-main-thread
      title: appLocale.intl.formatMessage({
        id: ETranslations.wc_pay_onchain_unsupported_platform__msg,
      }),
    });
    return { type: 'walletConnectPay', url, urlExtracted: payLinkCandidate };
  }
  openWalletConnectPayModal({ paymentLink: payLinkCandidate });
  return { type: 'walletConnectPay', url, urlExtracted: payLinkCandidate };
}
