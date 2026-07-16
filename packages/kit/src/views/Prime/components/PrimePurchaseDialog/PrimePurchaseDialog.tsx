/* cspell:ignore Infini */
import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IActionListItemProps } from '@onekeyhq/components';
import {
  ActionList,
  Dialog,
  Skeleton,
  Stack,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import googlePlayService from '@onekeyhq/shared/src/googlePlayService/googlePlayService';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IPrimePaymentMethod } from '@onekeyhq/shared/src/logger/scopes/prime/scenes/subscription';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';

import { usePrimeInfiniPurchase } from '../../hooks/usePrimeInfiniPurchase';
import { usePrimePayment } from '../../hooks/usePrimePayment';
import {
  finishPrimeSubscriptionPurchaseSuccess,
  preparePrimeSubscriptionPurchaseSuccess,
} from '../../primeSubscriptionPurchaseSuccess';

import { PrimeSubscriptionPlans } from './PrimeSubscriptionPlans';
import { usePurchasePackageWebview } from './usePurchasePackageWebview';

import type { ISubscriptionPeriod } from '../../hooks/usePrimePaymentTypes';
import type { IPrimeSubscriptionPurchaseSuccessPayload } from '../../primeSubscriptionPurchaseSuccess';

export function usePrimePurchaseCallback({
  onPurchase,
}: {
  onPurchase?: () => void;
} = {}) {
  const { purchasePackageNative, purchasePackageWeb } = usePrimePayment();
  const { supabaseUser, user } = useOneKeyAuth();
  const intl = useIntl();

  const purchaseByWebview = usePurchasePackageWebview();
  const { purchaseByCrypto } = usePrimeInfiniPurchase();

  const purchaseByNative = useCallback(
    async ({
      selectedSubscriptionPeriod,
      featureName,
    }: {
      selectedSubscriptionPeriod: ISubscriptionPeriod;
      featureName?: EPrimeFeatures;
    }) => {
      // purchasePackageNative owns the post-purchase refresh for both
      // outcomes (claim -> refresh -> emit on success, one defensive refresh
      // on failure); refreshing here again would duplicate it.
      const result = await purchasePackageNative?.({
        subscriptionPeriod: selectedSubscriptionPeriod,
        featureName,
      });
      console.log('purchasePackageNative result >>>>>>', result);
    },
    [purchasePackageNative],
  );

  const purchaseByWebStripe = useCallback(
    async ({
      selectedSubscriptionPeriod,
      currency,
      featureName,
    }: {
      selectedSubscriptionPeriod: ISubscriptionPeriod;
      currency?: string;
      featureName?: EPrimeFeatures;
    }) => {
      let successfulPurchase:
        | IPrimeSubscriptionPurchaseSuccessPayload
        | undefined;
      try {
        const purchaseUserId = user?.onekeyUserId;
        const purchaseResult = await purchasePackageWeb?.({
          subscriptionPeriod: selectedSubscriptionPeriod,
          email: supabaseUser?.email || '',
          locale: intl.locale,
          currency,
          featureName,
        });
        if (
          purchaseUserId &&
          purchaseResult?.customerInfo.entitlements.active.Prime?.isActive
        ) {
          successfulPurchase =
            await preparePrimeSubscriptionPurchaseSuccess(purchaseUserId);
        }
        // await backgroundApiProxy.servicePrime.initRevenuecatPurchases({
        //   onekeyUserId: user.onekeyUserId || '',
        // });
        // await backgroundApiProxy.servicePrime.purchasePaywallPackage({
        //   packageId: selectedPackageId,
        //   email: user?.email || '',
        // });
      } finally {
        await finishPrimeSubscriptionPurchaseSuccess(successfulPurchase);
      }
    },
    [intl.locale, purchasePackageWeb, supabaseUser?.email, user?.onekeyUserId],
  );

  // TODO move to jotai context method
  const purchase = useCallback(
    async ({
      selectedSubscriptionPeriod,
      currency,
      featureName,
    }: {
      selectedSubscriptionPeriod: ISubscriptionPeriod;
      currency?: string;
      featureName?: EPrimeFeatures;
    }) => {
      onPurchase?.();

      // primeSubscribeIntent must fire exactly once per actual payment
      // attempt with its channel (see the scene doc: it pairs with
      // primeSubscribeSuccess to measure attempt → success rate), so it is
      // logged in each concrete channel branch instead of when the payment
      // method picker is shown. The crypto path logs it inside
      // usePrimeInfiniPurchase with paymentMethod: 'crypto'.
      const logSubscribeIntent = (paymentMethod: IPrimePaymentMethod) => {
        defaultLogger.prime.subscription.primeSubscribeIntent({
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          currency,
          paymentMethod,
        });
      };

      if (platformEnv.isNativeIOS || platformEnv.isNativeAndroidGooglePlay) {
        logSubscribeIntent('iap');
        void purchaseByNative({
          selectedSubscriptionPeriod,
          featureName,
        });
        return;
      }

      // Crypto pay (Infini) is visible on every remaining branch:
      // !isNativeIOS && !isNativeAndroidGooglePlay
      if (platformEnv.isNativeAndroid) {
        const isGooglePlayServiceAvailable =
          await googlePlayService.isAvailable();
        const payWithCryptoItem: IActionListItemProps = {
          // TODO: i18n pending translation key
          label: 'Pay with crypto',
          onPress: () => {
            void purchaseByCrypto({
              selectedSubscriptionPeriod,
              featureName,
            });
          },
        };
        const purchaseByWebviewItem: IActionListItemProps = {
          label: 'Purchase by Webview',
          onPress: () => {
            // The webview flow is RevenueCat web billing (Stripe) hosted in
            // an in-app webview
            logSubscribeIntent('stripe');
            void purchaseByWebview({
              selectedSubscriptionPeriod,
              currency,
              featureName,
            });
          },
        };
        const androidItems: IActionListItemProps[] =
          isGooglePlayServiceAvailable
            ? [
                {
                  label: 'Purchase by GooglePlay',
                  onPress: () => {
                    logSubscribeIntent('iap');
                    void purchaseByNative({
                      selectedSubscriptionPeriod,
                      featureName,
                    });
                  },
                },
                purchaseByWebviewItem,
                payWithCryptoItem,
              ]
            : [purchaseByWebviewItem, payWithCryptoItem];
        // Native Android only: ActionList.show renders as a bottom Sheet on
        // native, so no popover trigger anchor is needed here
        ActionList.show({
          title: intl.formatMessage({
            id: ETranslations.prime_subscribe,
          }),
          onClose: () => {},
          sections: [
            {
              items: androidItems,
            },
          ],
        });
        return;
      }

      // Desktop / Web / Extension: ActionList.show() has no trigger anchor
      // here, and on gtMd its Popover never adapts to a Sheet, so it would
      // render detached at the window corner. Use an imperative Dialog as
      // the payment method picker instead.
      const paymentMethodDialog = Dialog.show({
        title: intl.formatMessage({
          id: ETranslations.prime_subscribe,
        }),
        showFooter: false,
        renderContent: (
          <YStack mx="$-5" mt="$-1" mb="$-3" $md={{ pb: '$3', mb: '$0' }}>
            <ListItem
              drillIn
              testID="prime-pay-with-card"
              // TODO: i18n pending translation key
              title="Pay with card"
              onPress={() => {
                void paymentMethodDialog.close();
                logSubscribeIntent('stripe');
                void purchaseByWebStripe({
                  selectedSubscriptionPeriod,
                  currency,
                  featureName,
                });
              }}
            />
            <ListItem
              drillIn
              testID="prime-pay-with-crypto"
              // TODO: i18n pending translation key
              title="Pay with crypto"
              onPress={() => {
                void paymentMethodDialog.close();
                void purchaseByCrypto({
                  selectedSubscriptionPeriod,
                  featureName,
                });
              }}
            />
          </YStack>
        ),
      });
    },
    [
      onPurchase,
      purchaseByNative,
      purchaseByCrypto,
      intl,
      purchaseByWebview,
      purchaseByWebStripe,
    ],
  );

  return {
    purchase,
    purchaseByNative,
    purchaseByWebview,
  };
}

export const PrimePurchaseDialog = (props: {
  onPurchase: () => void;
  featureName?: EPrimeFeatures;
  // Preselected plan, e.g. the renew flow defaults to the plan of the
  // current Infini subscription (integration plan §7.2)
  defaultSelectedSubscriptionPeriod?: ISubscriptionPeriod;
}) => {
  const { onPurchase, featureName, defaultSelectedSubscriptionPeriod } = props;
  const intl = useIntl();
  const [selectedSubscriptionPeriod, setSelectedSubscriptionPeriod] =
    useState<ISubscriptionPeriod>(defaultSelectedSubscriptionPeriod ?? 'P1Y');

  const { getPackagesNative, getPackagesWeb } = usePrimePayment();

  const { result: packages } = usePromiseResult(
    async () =>
      platformEnv.isNative ? getPackagesNative?.() : getPackagesWeb?.(),
    [getPackagesNative, getPackagesWeb],
  );

  const { purchase } = usePrimePurchaseCallback({
    onPurchase,
  });
  return (
    <Stack mt="$8">
      {packages ? (
        <PrimeSubscriptionPlans
          packages={packages}
          selectedSubscriptionPeriod={selectedSubscriptionPeriod}
          onSubscriptionPeriodSelected={setSelectedSubscriptionPeriod}
        />
      ) : (
        <YStack gap="$2.5">
          <Skeleton width="100%" height={100} />
          <Skeleton width="100%" height={100} />
        </YStack>
      )}

      <Dialog.Footer
        showCancelButton={false}
        onConfirmText={intl.formatMessage({
          id: ETranslations.prime_subscribe,
        })}
        confirmButtonProps={{
          disabled: !packages,
        }}
        onConfirm={() => {
          const currency = packages?.find(
            (p) => p.subscriptionPeriod === selectedSubscriptionPeriod,
          )?.currencyCode;
          return purchase({
            selectedSubscriptionPeriod,
            currency,
            featureName,
          });
        }}
      />
    </Stack>
  );
};

export default PrimePurchaseDialog;
