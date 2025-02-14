import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EWebEmbedRoutePath } from '@onekeyhq/shared/src/consts/webEmbedConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';

import { usePrimeAuthV2 } from '../../hooks/usePrimeAuthV2';
import { usePrimePaymentWebApiKey } from '../../hooks/usePrimePaymentWebApiKey';

import type { IPackageId } from '../../hooks/usePrimePaymentTypes';

export function usePurchasePackageWebview({
  selectedPackageId,
}: {
  selectedPackageId: IPackageId;
}) {
  const navigation = useAppNavigation();
  const { user } = usePrimeAuthV2();
  const intl = useIntl();
  const apiKey = usePrimePaymentWebApiKey();

  const purchasePackageWebview = useCallback(async () => {
    navigation.popStack();

    openUrlUtils.openUrlByWebviewPro({
      url: '',
      title: 'WebView',
      isWebEmbed: true,
      hashRoutePath: EWebEmbedRoutePath.primePurchase,
      hashRouteQueryParams: {
        primeUserId: user?.privyUserId || '',
        primeUserEmail: user?.email || '',
        packageId: selectedPackageId,
        locale: intl.locale,
        mode: platformEnv.isDev ? 'dev' : 'prod',
        apiKey: apiKey || '',
      },
    });
  }, [
    navigation,
    user?.privyUserId,
    user?.email,
    selectedPackageId,
    intl.locale,
    apiKey,
  ]);

  return purchasePackageWebview;
}
