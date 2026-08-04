/* cspell:ignore Infini */
import { useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IActionListItemProps } from '@onekeyhq/components';
import { Dialog, Skeleton, Stack, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import googlePlayService from '@onekeyhq/shared/src/googlePlayService/googlePlayService';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IPrimePaymentMethod } from '@onekeyhq/shared/src/logger/scopes/prime/scenes/subscription';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';

import { getPrimeInfiniPaymentEntryGuard } from '../../hooks/primeInfiniExternalCheckoutGuard';
import { usePrimeInfiniPurchase } from '../../hooks/usePrimeInfiniPurchase';
import { usePrimePayment } from '../../hooks/usePrimePayment';
import { showPrimeInfiniPaymentErrorToast } from '../../primeInfiniPaymentError';
import { logPrimeInfiniPaymentFlow } from '../../primeInfiniPaymentLogger';
import { ensurePrimePurchaseEligible } from '../../primePurchaseEligibility';
import {
  finishPrimeSubscriptionPurchaseSuccess,
  preparePrimeSubscriptionPurchaseSuccess,
} from '../../primeSubscriptionPurchaseSuccess';

import { PrimeSubscriptionPlans } from './PrimeSubscriptionPlans';
import { usePurchasePackageWebview } from './usePurchasePackageWebview';

import type {
  IPackageFreeTrial,
  ISubscriptionPeriod,
} from '../../hooks/usePrimePaymentTypes';
import type { IPrimeSubscriptionPurchaseSuccessPayload } from '../../primeSubscriptionPurchaseSuccess';

type IPrimePaymentMethodKey = 'native' | 'webview' | 'webStripe' | 'crypto';

type IPrimePaymentMethodOption = {
  key: IPrimePaymentMethodKey;
  label: ETranslations;
  icon?: IActionListItemProps['icon'];
  testID?: string;
};

const CRYPTO_PAYMENT_METHOD: IPrimePaymentMethodOption = {
  key: 'crypto',
  label: ETranslations.prime_crypto_payment__label,
  icon: 'CryptoCoinOutline',
  testID: 'prime-pay-with-crypto',
};

const WEB_PAYMENT_METHODS: IPrimePaymentMethodOption[] = [
  {
    key: 'webStripe',
    label: ETranslations.prime_credit_card__label,
    icon: 'CreditCardOutline',
    testID: 'prime-pay-with-card',
  },
  CRYPTO_PAYMENT_METHOD,
];

const ANDROID_PAYMENT_METHODS: IPrimePaymentMethodOption[] = [
  {
    key: 'webview',
    label: ETranslations.prime_credit_card__label,
    icon: 'CreditCardOutline',
  },
  CRYPTO_PAYMENT_METHOD,
];

const ANDROID_GOOGLE_PLAY_PAYMENT_METHODS: IPrimePaymentMethodOption[] = [
  {
    key: 'native',
    label: ETranslations.prime_google_play__label,
    icon: 'GooglePlayBrand',
  },
  ...ANDROID_PAYMENT_METHODS,
];

function getFreeTrialPaymentMethod(
  freeTrial: IPackageFreeTrial | undefined,
): IPrimePaymentMethodKey | undefined {
  if (freeTrial?.source === 'native') {
    return 'native';
  }
  if (freeTrial?.source === 'web') {
    return platformEnv.isNativeAndroid ? 'webview' : 'webStripe';
  }
  return undefined;
}

function PrimePaymentMethodItems({
  methods,
  freeTrial,
  onSelect,
}: {
  methods: IPrimePaymentMethodOption[];
  freeTrial?: IPackageFreeTrial;
  onSelect: (method: IPrimePaymentMethodKey) => Promise<boolean>;
}) {
  const intl = useIntl();
  const [pendingMethod, setPendingMethod] = useState<IPrimePaymentMethodKey>();
  const pendingMethodRef = useRef<IPrimePaymentMethodKey | undefined>(
    undefined,
  );
  // Android can show native and Web checkout together. A trial belongs only
  // to the offering source that reported it, so never copy it to both rows.
  const freeTrialMethod = getFreeTrialPaymentMethod(freeTrial);
  const hasFreeTrialMethod = methods.some(
    (method) => method.key === freeTrialMethod,
  );
  let trialIncludedSubtitle: string | undefined;
  if (freeTrial?.periodUnit === 'day') {
    trialIncludedSubtitle = intl.formatMessage(
      { id: ETranslations.prime_free_trial_included_days__desc },
      { count: freeTrial.periodNumber },
    );
  } else if (freeTrial) {
    trialIncludedSubtitle = intl.formatMessage({
      id: ETranslations.prime_free_trial_included__desc,
    });
  }
  const getMethodSubtitle = (method: IPrimePaymentMethodOption) => {
    if (!freeTrial || !hasFreeTrialMethod) {
      return undefined;
    }
    if (method.key === 'crypto') {
      return intl.formatMessage({
        id: ETranslations.prime_no_free_trial__desc,
      });
    }
    return method.key === freeTrialMethod ? trialIncludedSubtitle : undefined;
  };
  const handleSelect = useCallback(
    async (method: IPrimePaymentMethodKey) => {
      if (pendingMethodRef.current) {
        return;
      }
      pendingMethodRef.current = method;
      setPendingMethod(method);
      const clearPendingMethod = () => {
        pendingMethodRef.current = undefined;
        setPendingMethod(undefined);
      };
      try {
        const didStart = await onSelect(method);
        if (!didStart) {
          clearPendingMethod();
        }
      } catch (error) {
        // Keep the current picker retryable if validation or closing the picker
        // fails before the selected payment flow starts.
        clearPendingMethod();
        throw error;
      }
    },
    [onSelect],
  );
  return (
    <>
      {methods.map((method) => (
        <ListItem
          key={method.key}
          drillIn
          icon={method.icon}
          testID={method.testID ?? `prime-payment-method-${method.key}`}
          title={intl.formatMessage({ id: method.label })}
          subtitle={getMethodSubtitle(method)}
          disabled={Boolean(pendingMethod)}
          isLoading={pendingMethod === method.key}
          onPress={async () => {
            await handleSelect(method.key);
          }}
        />
      ))}
    </>
  );
}

export function usePrimePurchaseCallback({
  onPurchase,
}: {
  onPurchase?: () => void | Promise<void>;
} = {}) {
  const { purchasePackageNative, purchasePackageWeb } = usePrimePayment();
  const { supabaseUser, user } = useOneKeyAuth();
  const intl = useIntl();

  const purchaseByWebviewUnchecked = usePurchasePackageWebview();
  const { purchaseByCrypto: purchaseByCryptoUnchecked } =
    usePrimeInfiniPurchase();

  const purchaseByNativeUnchecked = useCallback(
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
      await purchasePackageNative?.({
        subscriptionPeriod: selectedSubscriptionPeriod,
        featureName,
      });
    },
    [purchasePackageNative],
  );

  const purchaseByWebStripeUnchecked = useCallback(
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

  const purchaseByNative = useCallback(
    async (params: {
      selectedSubscriptionPeriod: ISubscriptionPeriod;
      featureName?: EPrimeFeatures;
    }) => {
      if (
        !(await ensurePrimePurchaseEligible({
          expectedOneKeyUserId: user?.onekeyUserId,
          intl,
        }))
      ) {
        return;
      }
      await purchaseByNativeUnchecked(params);
    },
    [intl, purchaseByNativeUnchecked, user?.onekeyUserId],
  );

  const purchaseByWebview = useCallback(
    async (params: {
      selectedSubscriptionPeriod: ISubscriptionPeriod | undefined;
      currency?: string;
      featureName?: EPrimeFeatures;
    }) => {
      if (
        !(await ensurePrimePurchaseEligible({
          expectedOneKeyUserId: user?.onekeyUserId,
          intl,
        }))
      ) {
        return;
      }
      await purchaseByWebviewUnchecked(params);
    },
    [intl, purchaseByWebviewUnchecked, user?.onekeyUserId],
  );

  // TODO move to jotai context method
  const purchase = useCallback(
    async ({
      selectedSubscriptionPeriod,
      currency,
      featureName,
      freeTrial,
    }: {
      selectedSubscriptionPeriod: ISubscriptionPeriod;
      currency?: string;
      featureName?: EPrimeFeatures;
      freeTrial?: IPackageFreeTrial;
    }) => {
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
      const startCryptoPayment = async ({
        subscriptionPeriod,
      }: {
        subscriptionPeriod: ISubscriptionPeriod;
      }) => {
        try {
          await purchaseByCryptoUnchecked({
            selectedSubscriptionPeriod: subscriptionPeriod,
            featureName,
          });
        } catch (error) {
          showPrimeInfiniPaymentErrorToast({
            error,
            fallbackMessage: intl.formatMessage({
              id: ETranslations.global_failed,
            }),
          });
          throw error;
        }
      };
      const continuePendingCryptoPayment = async ({
        beforeContinue,
      }: {
        beforeContinue: () => void | Promise<void>;
      }) => {
        // The guard hits the network, so a failure means the active-payment
        // state is unknown. Block the attempt instead of falling through to a
        // second channel: a duplicate charge is worse than a retryable error.
        let entryGuard: Awaited<
          ReturnType<typeof getPrimeInfiniPaymentEntryGuard>
        >;
        try {
          entryGuard = await getPrimeInfiniPaymentEntryGuard();
        } catch (error) {
          logPrimeInfiniPaymentFlow({
            stage: 'paymentContext',
            status: 'failed',
            subscriptionPeriod: selectedSubscriptionPeriod,
            featureName,
            plan: selectedSubscriptionPeriod === 'P1Y' ? 'yearly' : 'monthly',
            reason: 'paymentEntryGuardFailed',
            error,
          });
          showPrimeInfiniPaymentErrorToast({
            error,
            fallbackMessage: intl.formatMessage({
              id: ETranslations.global_failed,
            }),
          });
          throw error;
        }
        if (!entryGuard.hasPendingPayment) {
          return false;
        }
        await beforeContinue();
        await startCryptoPayment({
          // Resume the in-flight invoice on its own period. Passing the period
          // the user just picked would restore a monthly invoice under a
          // yearly request, which the restore path tracks without complaint
          // once the payment is no longer replaceable.
          subscriptionPeriod:
            entryGuard.pendingSubscriptionPeriod ?? selectedSubscriptionPeriod,
        });
        return true;
      };

      // This gate is deliberately channel-wide and runs before the IAP and
      // Google Play branches, not only on the crypto path.
      // entryGuard.hasPendingPayment answers "is the user's money already
      // committed to an Infini invoice" (a broadcast was claimed, or the chain
      // and server report progress on it) — it does not answer "does the user
      // want to pay with crypto". Starting IAP, Stripe or the WebView checkout
      // while such an invoice is in flight charges for one subscription twice,
      // and the crypto leg cannot be cancelled once broadcast, so the in-flight
      // payment has to be resumed first. Narrowing this to the crypto channel
      // reintroduces exactly the double charge it exists to prevent.
      if (
        await continuePendingCryptoPayment({
          beforeContinue: async () => {
            await onPurchase?.();
          },
        })
      ) {
        return;
      }

      if (platformEnv.isNativeIOS || platformEnv.isNativeAndroidGooglePlay) {
        if (
          !(await ensurePrimePurchaseEligible({
            expectedOneKeyUserId: user?.onekeyUserId,
            intl,
          }))
        ) {
          return;
        }
        await onPurchase?.();
        logSubscribeIntent('iap');
        await purchaseByNativeUnchecked({
          selectedSubscriptionPeriod,
          featureName,
        });
        return;
      }

      await onPurchase?.();

      let paymentMethods = WEB_PAYMENT_METHODS;
      if (platformEnv.isNativeAndroid) {
        const isGooglePlayServiceAvailable =
          await googlePlayService.isAvailable();
        paymentMethods = isGooglePlayServiceAvailable
          ? ANDROID_GOOGLE_PLAY_PAYMENT_METHODS
          : ANDROID_PAYMENT_METHODS;
      }

      const paymentMethodDialog = Dialog.show({
        title: intl.formatMessage({
          id: ETranslations.prime_payment_method__title,
        }),
        showFooter: false,
        renderContent: (
          <YStack mx="$-5" mt="$-1" mb="$-3" $md={{ pb: '$3', mb: '$0' }}>
            <PrimePaymentMethodItems
              methods={paymentMethods}
              freeTrial={freeTrial}
              onSelect={async (method) => {
                if (
                  await continuePendingCryptoPayment({
                    beforeContinue: async () => {
                      await paymentMethodDialog.close();
                    },
                  })
                ) {
                  return true;
                }
                if (
                  !(await ensurePrimePurchaseEligible({
                    expectedOneKeyUserId: user?.onekeyUserId,
                    intl,
                  }))
                ) {
                  return false;
                }
                await paymentMethodDialog.close();

                if (method === 'native') {
                  logSubscribeIntent('iap');
                  void purchaseByNativeUnchecked({
                    selectedSubscriptionPeriod,
                    featureName,
                  });
                } else if (method === 'webview') {
                  logSubscribeIntent('stripe');
                  void purchaseByWebviewUnchecked({
                    selectedSubscriptionPeriod,
                    currency,
                    featureName,
                  });
                } else if (method === 'webStripe') {
                  logSubscribeIntent('stripe');
                  void purchaseByWebStripeUnchecked({
                    selectedSubscriptionPeriod,
                    currency,
                    featureName,
                  });
                } else {
                  logPrimeInfiniPaymentFlow({
                    stage: 'paymentMethod',
                    status: 'selected',
                    subscriptionPeriod: selectedSubscriptionPeriod,
                    featureName,
                    plan:
                      selectedSubscriptionPeriod === 'P1Y'
                        ? 'yearly'
                        : 'monthly',
                    checkoutType: 'internalWallet',
                  });
                  await startCryptoPayment({
                    subscriptionPeriod: selectedSubscriptionPeriod,
                  });
                }
                return true;
              }}
            />
          </YStack>
        ),
      });
    },
    [
      intl,
      onPurchase,
      purchaseByCryptoUnchecked,
      purchaseByNativeUnchecked,
      purchaseByWebStripeUnchecked,
      purchaseByWebviewUnchecked,
      user?.onekeyUserId,
    ],
  );

  return {
    purchase,
    purchaseByNative,
    purchaseByWebview,
  };
}

export const PrimePurchaseDialog = (props: {
  onPurchase: () => void | Promise<void>;
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
  const selectedPackage = packages?.find(
    (p) => p.subscriptionPeriod === selectedSubscriptionPeriod,
  );
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
          disabled: !selectedPackage,
        }}
        onConfirm={() => {
          if (!selectedPackage) {
            return undefined;
          }
          return purchase({
            selectedSubscriptionPeriod,
            currency: selectedPackage?.currencyCode,
            freeTrial: selectedPackage?.freeTrial,
            featureName,
          });
        }}
      />
    </Stack>
  );
};

export default PrimePurchaseDialog;
