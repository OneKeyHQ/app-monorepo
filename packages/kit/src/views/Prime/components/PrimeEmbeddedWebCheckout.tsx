import { useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, Dialog, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { createPrimeEmbeddedCheckoutSession } from '../purchasesSdk/primeEmbeddedCheckoutSession';
import { purchaseWithStripeLoadingGuard } from '../purchasesSdk/purchaseWithStripeLoadingGuard';

import type { IPrimeEmbeddedCheckoutSession } from '../purchasesSdk/primeEmbeddedCheckoutSession';
import type { PurchaseResult } from '@revenuecat/purchases-js';

type IEmbeddedPurchase = (htmlTarget: HTMLElement) => Promise<PurchaseResult>;
type IEmbeddedPurchaseOutcome =
  | { status: 'fulfilled'; value: PurchaseResult }
  | { status: 'rejected'; error: unknown };

// The SDK uses viewport widths even with htmlTarget; contain its inline UI.
const EMBEDDED_CHECKOUT_STYLES = `
  .onekey-prime-checkout-container {
    display: flex; flex-direction: column; gap: 16px;
    padding: 20px; box-sizing: border-box; max-height: 90dvh;
  }
  .onekey-prime-embedded-checkout {
    container-type: inline-size; container-name: prime-checkout;
    width: 100%; min-width: 0; min-height: 0;
    max-height: calc(90dvh - 86px); overflow-y: auto;
    overscroll-behavior: contain;
  }
  .onekey-prime-embedded-checkout .rcb-ui-layout {
    width: 100%; min-width: 0; height: auto; padding: 0;
    flex-direction: column; align-items: stretch; justify-content: flex-start;
    overflow: visible;
  }
  .onekey-prime-embedded-checkout .rcb-ui-aside,
  .onekey-prime-embedded-checkout .rcb-ui-main {
    width: 100%; min-width: 0; max-width: none; flex: none;
  }
  .onekey-prime-embedded-checkout .rcb-ui-aside { margin: 0 0 16px; }
  .onekey-prime-embedded-checkout .rcb-modal-container,
  .onekey-prime-embedded-checkout .rcb-modal-main {
    width: 100%; min-width: 0; max-width: none; margin: 0;
  }
  .onekey-prime-embedded-checkout .rcb-modal-main { padding: 24px; }
  .onekey-prime-embedded-checkout .rcb-pricing-info { margin-top: 24px; }
  @container prime-checkout (min-width: 760px) {
    .onekey-prime-embedded-checkout .rcb-ui-layout {
      flex-direction: row; gap: 16px;
    }
    .onekey-prime-embedded-checkout .rcb-ui-aside {
      width: auto; flex: 2 1 0; margin: 0;
    }
    .onekey-prime-embedded-checkout .rcb-ui-main { width: auto; flex: 3 1 0; }
  }
  @media (max-width: 767px) {
    [data-testid="prime-embedded-checkout-dialog"] { border-radius: 0; }
    .onekey-prime-checkout-container {
      width: 100%; height: 100dvh; max-height: 100dvh;
      padding: max(16px, env(safe-area-inset-top)) 16px
        max(16px, env(safe-area-inset-bottom));
    }
    .onekey-prime-embedded-checkout { flex: 1 1 0; max-height: none; }
  }
`;

function PrimeEmbeddedWebCheckoutContent({
  purchase,
  onSettled,
}: {
  purchase: IEmbeddedPurchase;
  onSettled: (outcome: IEmbeddedPurchaseOutcome) => Promise<void>;
}) {
  const intl = useIntl();
  const targetRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<IPrimeEmbeddedCheckoutSession | undefined>(
    undefined,
  );
  const startedRef = useRef(false);
  const confirmationRef = useRef<ReturnType<typeof Dialog.show> | undefined>(
    undefined,
  );
  const [canSwitch, setCanSwitch] = useState(false);

  useEffect(() => {
    const target = targetRef.current;
    if (!target || startedRef.current) return;
    startedRef.current = true;
    const session = createPrimeEmbeddedCheckoutSession(target);
    sessionRef.current = session;
    const unsubscribe = session.subscribe(() => {
      setCanSwitch(session.canSwitchToHosted());
    });
    void (async () => {
      let outcome: IEmbeddedPurchaseOutcome;
      try {
        const value = await purchaseWithStripeLoadingGuard(
          () => purchase(target),
          session,
        );
        outcome = { status: 'fulfilled', value };
      } catch (error) {
        outcome = { status: 'rejected', error };
      }
      unsubscribe();
      session.finish();
      await confirmationRef.current?.close();
      await onSettled(outcome);
    })();
  }, [onSettled, purchase]);

  return (
    <div
      className="onekey-prime-checkout-container"
      data-testid="prime-embedded-checkout-container"
    >
      <style>{EMBEDDED_CHECKOUT_STYLES}</style>
      <div
        ref={targetRef}
        className="rcb-ui-root onekey-prime-embedded-checkout"
        data-testid="prime-embedded-checkout-target"
      />
      <YStack gap="$2" alignItems="center" flexShrink={0}>
        <Button
          variant="link"
          size="small"
          iconAfter="ArrowTopRightOutline"
          testID="prime-embedded-checkout-open-browser"
          disabled={!canSwitch}
          onPress={() => {
            const session = sessionRef.current;
            if (!session?.canSwitchToHosted() || confirmationRef.current) {
              return;
            }
            confirmationRef.current = Dialog.show({
              title: intl.formatMessage({
                id: ETranslations.explore_open_in_browser,
              }),
              description: intl.formatMessage({
                id: ETranslations.prime_external_wallet_checkout__desc,
              }),
              testID: 'prime-embedded-checkout-browser-confirmation',
              showFooter: true,
              showCancelButton: true,
              showConfirmButton: true,
              onConfirmText: intl.formatMessage({
                id: ETranslations.global_continue,
              }),
              onClose: () => {
                confirmationRef.current = undefined;
              },
              onConfirm: async ({ close }) => {
                await close();
                session.cancel('hostedCheckout');
              },
            });
          }}
        >
          {intl.formatMessage({ id: ETranslations.explore_open_in_browser })}
        </Button>
      </YStack>
    </div>
  );
}

export function purchaseWithPrimeEmbeddedWebCheckout(
  purchase: IEmbeddedPurchase,
) {
  return new Promise<PurchaseResult>((resolve, reject) => {
    const dialog = Dialog.show({
      testID: 'prime-embedded-checkout-dialog',
      showHeader: false,
      showFooter: false,
      disableDrag: true,
      disableSystemClose: true,
      dismissOnOverlayPress: false,
      floatingPanelProps: { width: 880, maxWidth: '95%', maxHeight: '90%' },
      sheetProps: { snapPoints: [100], snapPointsMode: 'percent' },
      contentContainerProps: { p: '$0' },
      renderContent: (
        <PrimeEmbeddedWebCheckoutContent
          purchase={purchase}
          onSettled={async (outcome) => {
            // Close our container before the caller opens another checkout.
            await dialog.close();
            if (outcome.status === 'fulfilled') resolve(outcome.value);
            else reject(outcome.error);
          }}
        />
      ),
    });
  });
}
