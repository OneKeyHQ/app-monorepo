import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { EOneKeyDeepLinkPath } from '@onekeyhq/shared/src/consts/deeplinkConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  type ETabHomeRoutes as ETabHomeRoutesType,
  type ITabHomeParamList,
} from '@onekeyhq/shared/src/routes';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

import { DeepLinkLanding } from '../../components/DeepLinkLanding';
import { HomeTestIDs } from '../../testIDs';
import {
  openAppViaDeepLink,
  scheduleDeepLinkFallbackHint,
} from '../../utils/deepLinkLaunchUtils';

const AUTO_OPEN_DELAY_MS = 300;
const REDEEM_DEEP_LINK_FALLBACK_DELAY_MS = 3000;

function getStringQueryParam(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.find((item): item is string => typeof item === 'string');
  }
  return undefined;
}

function RedeemBitcoinVoucherLandingPage() {
  const intl = useIntl();
  const route = useAppRoute<
    ITabHomeParamList,
    ETabHomeRoutesType.TabHomeRedeemBitcoinVoucher
  >();
  const code = getStringQueryParam(route.params?.code)?.trim() || undefined;

  const [isFallbackVisible, setIsFallbackVisible] = useState(false);
  const fallbackCleanupRef = useRef<(() => void) | null>(null);
  const lastAutoOpenedDeepLinkRef = useRef<string | null>(null);

  const deepLink = useMemo(
    () =>
      uriUtils.buildDeepLinkUrl({
        path: EOneKeyDeepLinkPath.redeem_bitcoin_voucher,
        query: code ? { code } : undefined,
      }),
    [code],
  );

  const clearFallbackTimer = useCallback(() => {
    fallbackCleanupRef.current?.();
    fallbackCleanupRef.current = null;
  }, []);

  const handleOpenApp = useCallback(() => {
    clearFallbackTimer();
    setIsFallbackVisible(false);
    fallbackCleanupRef.current = scheduleDeepLinkFallbackHint({
      delay: REDEEM_DEEP_LINK_FALLBACK_DELAY_MS,
      onFallback: () => setIsFallbackVisible(true),
    });
    openAppViaDeepLink(deepLink);
  }, [clearFallbackTimer, deepLink]);

  useEffect(
    () => () => {
      clearFallbackTimer();
    },
    [clearFallbackTimer],
  );

  useEffect(() => {
    if (!platformEnv.isWeb || lastAutoOpenedDeepLinkRef.current === deepLink) {
      return undefined;
    }
    lastAutoOpenedDeepLinkRef.current = deepLink;
    const timerId = setTimeout(() => {
      handleOpenApp();
    }, AUTO_OPEN_DELAY_MS);
    return () => clearTimeout(timerId);
  }, [deepLink, handleOpenApp]);

  return (
    <DeepLinkLanding
      loadingTitle={intl.formatMessage({
        id: ETranslations.redemption_center_title,
      })}
      fallbackDescription={intl.formatMessage({
        id: ETranslations.redemption_center_description,
      })}
      isFallbackVisible={isFallbackVisible}
      onOpenApp={handleOpenApp}
      openAppTestID={HomeTestIDs.redeemBitcoinVoucherOpenAppFallbackBtn}
      downloadTestID={HomeTestIDs.redeemBitcoinVoucherDownloadFallbackBtn}
    />
  );
}

export { RedeemBitcoinVoucherLandingPage };
