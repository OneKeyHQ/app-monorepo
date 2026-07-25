/* cspell:ignore Infini */
import { useCallback, useState } from 'react';

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

import { usePrimeInfiniPurchase } from '../../hooks/usePrimeInfiniPurchase';
import { usePrimePayment } from '../../hooks/usePrimePayment';
import { logPrimeInfiniPaymentFlow } from '../../primeInfiniPaymentLogger';
import { ensurePrimePurchaseEligible } from '../../primePurchaseEligibility';
import {
  finishPrimeSubscriptionPurchaseSuccess,
  preparePrimeSubscriptionPurchaseSuccess,
} from '../../primeSubscriptionPurchaseSuccess';

import { PrimeSubscriptionPlans } from './PrimeSubscriptionPlans';
import { usePurchasePackageWebview } from './usePurchasePackageWebview';

import type { ISubscriptionPeriod } from '../../hooks/usePrimePaymentTypes';
import type { IPrimeSubscriptionPurchaseSuccessPayload } from '../../primeSubscriptionPurchaseSuccess';

type IPrimePaymentMethodKey = 'native' | 'webview' | 'webStripe' | 'crypto';

type IPrimePaymentMethodOption = {
  key: IPrimePaymentMethodKey;
  label: string;
  icon?: IActionListItemProps['icon'];
  testID?: string;
};

const CRYPTO_PAYMENT_METHOD: IPrimePaymentMethodOption = {
  key: 'crypto',
  label: 'Crypto',
  icon: 'CryptoCoinOutline',
  testID: 'prime-pay-with-crypto',
};

const WEB_PAYMENT_METHODS: IPrimePaymentMethodOption[] = [
  {
    key: 'webStripe',
    label: 'Credit card',
    icon: 'CreditCardOutline',
    testID: 'prime-pay-with-card',
  },
  CRYPTO_PAYMENT_METHOD,
];

const ANDROID_PAYMENT_METHODS: IPrimePaymentMethodOption[] = [
  {
    key: 'webview',
    label: 'Purchase by Webview',
    icon: 'CreditCardOutline',
  },
  CRYPTO_PAYMENT_METHOD,
];

const ANDROID_GOOGLE_PLAY_PAYMENT_METHODS: IPrimePaymentMethodOption[] = [
  {
    key: 'native',
    label: 'Purchase by GooglePlay',
    icon: 'GooglePlayBrand',
  },
  ...ANDROID_PAYMENT_METHODS,
];

function PrimePaymentMethodItems({
  methods,
  onSelect,
}: {
  methods: IPrimePaymentMethodOption[];
  onSelect: (method: IPrimePaymentMethodKey) => Promise<boolean>;
}) {
  const [pendingMethod, setPendingMethod] = useState<IPrimePaymentMethodKey>();
  const handleSelect = useCallback(
    async (method: IPrimePaymentMethodKey) => {
      if (pendingMethod) {
        return;
      }
      setPendingMethod(method);
      try {
        const didStart = await onSelect(method);
        if (!didStart) {
          setPendingMethod(undefined);
        }
      } catch (error) {
        // Keep the current picker retryable if validation or closing the picker
        // fails before the selected payment flow starts.
        setPendingMethod(undefined);
        throw error;
      }
    },
    [onSelect, pendingMethod],
  );
  return (
    <>
      {methods.map((method) => (
        <ListItem
          key={method.key}
          drillIn
          icon={method.icon}
          testID={method.testID ?? `prime-payment-method-${method.key}`}
          title={method.label}
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
      const result = await purchasePackageNative?.({
        subscriptionPeriod: selectedSubscriptionPeriod,
        featureName,
      });
      console.log('purchasePackageNative result >>>>>>', result);
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
        }))
      ) {
        return;
      }
      await purchaseByNativeUnchecked(params);
    },
    [purchaseByNativeUnchecked, user?.onekeyUserId],
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
        }))
      ) {
        return;
      }
      await purchaseByWebviewUnchecked(params);
    },
    [purchaseByWebviewUnchecked, user?.onekeyUserId],
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
        if (
          !(await ensurePrimePurchaseEligible({
            expectedOneKeyUserId: user?.onekeyUserId,
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
        // TODO: i18n pending translation key
        title: 'Payment method',
        showFooter: false,
        renderContent: (
          <YStack mx="$-5" mt="$-1" mb="$-3" $md={{ pb: '$3', mb: '$0' }}>
            <PrimePaymentMethodItems
              methods={paymentMethods}
              onSelect={async (method) => {
                if (
                  !(await ensurePrimePurchaseEligible({
                    expectedOneKeyUserId: user?.onekeyUserId,
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
                  void purchaseByCryptoUnchecked({
                    selectedSubscriptionPeriod,
                    featureName,
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
