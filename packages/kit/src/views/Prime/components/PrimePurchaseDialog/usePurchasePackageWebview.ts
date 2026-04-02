import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EWebEmbedRoutePath } from '@onekeyhq/shared/src/consts/webEmbedConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';

import { getPrimePaymentApiKey } from '../../hooks/getPrimePaymentApiKey';

import type { ISubscriptionPeriod } from '../../hooks/usePrimePaymentTypes';

export function usePurchasePackageWebview() {
  const navigation = useAppNavigation();
  const { user, supabaseUser } = useOneKeyAuth();
  const intl = useIntl();

  const purchasePackageWebview = useCallback(
    async ({
      selectedSubscriptionPeriod,
      currency,
      featureName,
    }: {
      selectedSubscriptionPeriod: ISubscriptionPeriod | undefined;
      currency?: string;
      featureName?: EPrimeFeatures;
    }) => {
      if (!selectedSubscriptionPeriod) {
        return;
      }
      navigation.popStack();
      const { apiKey } = await getPrimePaymentApiKey({
        apiKeyType: 'web',
      });

      openUrlUtils.openUrlByWebviewPro({
        url: '',
        title: 'WebView',
        isWebEmbed: true,
        hashRoutePath: EWebEmbedRoutePath.primePurchase,
        hashRouteQueryParams: {
          primeUserId: user?.onekeyUserId || '',
          primeUserEmail: supabaseUser?.email || '',
          subscriptionPeriod: selectedSubscriptionPeriod,
          locale: intl.locale,
          mode: platformEnv.isDev ? 'dev' : 'prod',
          apiKey: apiKey || '',
          ...(currency ? { currency } : {}),
          ...(featureName ? { featureName } : {}),
        },
      });
    },
    [navigation, user?.onekeyUserId, supabaseUser?.email, intl.locale],
  );

  return purchasePackageWebview;
}
