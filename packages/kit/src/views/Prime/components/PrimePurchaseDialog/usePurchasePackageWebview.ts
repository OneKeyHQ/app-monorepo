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
  const { user } = useOneKeyAuth();
  const intl = useIntl();

  const purchasePackageWebview = useCallback(
    async ({
      selectedSubscriptionPeriod,
      featureName,
    }: {
      selectedSubscriptionPeriod: ISubscriptionPeriod | undefined;
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
          primeUserEmail: user?.email || '',
          subscriptionPeriod: selectedSubscriptionPeriod,
          locale: intl.locale,
          mode: platformEnv.isDev ? 'dev' : 'prod',
          apiKey: apiKey || '',
          ...(featureName ? { featureName } : {}),
        },
      });
    },
    [navigation, user?.onekeyUserId, user?.email, intl.locale],
  );

  return purchasePackageWebview;
}
