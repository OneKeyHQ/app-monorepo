import { useCallback } from 'react';

import {
  CommonActions,
  StackActions,
  type StackNavigationState,
} from '@react-navigation/native';

import {
  HeaderIconButton,
  NavBackButton,
  Page,
  SizableText,
  XStack,
  useShare,
} from '@onekeyhq/components';
import { OpenInAppButton } from '@onekeyhq/kit/src/components/OpenInAppButton';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { MarketHomeHeaderSearchBar } from '@onekeyhq/kit/src/views/Market/components/MarketHomeHeaderSearchBar';
import { MarketTokenIcon } from '@onekeyhq/kit/src/views/Market/components/MarketTokenIcon';
import { buildMarketFullUrl as buildMarketFullUrlUtil } from '@onekeyhq/kit/src/views/Market/marketUtils';
import { EOneKeyDeepLinkPath } from '@onekeyhq/shared/src/consts/deeplinkConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/market';

interface IMarketDetailHeaderProps {
  tokenDetail: IMarketTokenDetail | undefined;
  coinGeckoId: string;
  gtMd: boolean;
}

export function MarketDetailHeader({
  tokenDetail,
  coinGeckoId,
  gtMd,
}: IMarketDetailHeaderProps) {
  const navigation = useAppNavigation();

  const renderHeaderTitle = useCallback(
    () => (
      <XStack gap="$2" alignItems="center">
        <MarketTokenIcon uri={tokenDetail?.image || ''} size="sm" />
        <SizableText>{tokenDetail?.symbol?.toUpperCase()}</SizableText>
      </XStack>
    ),
    [tokenDetail?.image, tokenDetail?.symbol],
  );

  const { shareText } = useShare();

  const buildDeepLinkUrl = useCallback(
    () =>
      uriUtils.buildDeepLinkUrl({
        path: EOneKeyDeepLinkPath.market_detail,
        query: {
          coinGeckoId,
        },
      }),
    [coinGeckoId],
  );

  const buildFullUrl = useCallback(
    async () => buildMarketFullUrlUtil({ coinGeckoId }),
    [coinGeckoId],
  );

  const renderHeaderRight = useCallback(
    () => (
      <XStack gap="$6" ai="center">
        {!platformEnv.isExtensionUiPopup && !platformEnv.isNative ? (
          <OpenInAppButton
            buildDeepLinkUrl={buildDeepLinkUrl}
            buildFullUrl={buildFullUrl}
          />
        ) : null}
        <HeaderIconButton
          icon="ShareOutline"
          onPress={async () => {
            const url = buildMarketFullUrlUtil({ coinGeckoId });
            await shareText(url);
          }}
        />
        {gtMd ? <MarketHomeHeaderSearchBar /> : null}
      </XStack>
    ),
    [buildDeepLinkUrl, buildFullUrl, coinGeckoId, gtMd, shareText],
  );

  const popPage = useCallback(() => {
    navigation.dispatch((state: StackNavigationState<any>) => {
      if (state.routes.length > 1) {
        return StackActions.pop(state.routes.length);
      }
      return CommonActions.reset({
        index: 0,
        routes: [
          {
            name: ETabMarketRoutes.TabMarket,
          },
        ],
      });
    });
  }, [navigation]);

  const renderHeaderLeft = useCallback(
    () => <NavBackButton onPress={popPage} />,
    [popPage],
  );

  return (
    <Page.Header
      headerTitle={renderHeaderTitle}
      headerRight={renderHeaderRight}
      headerLeft={renderHeaderLeft}
    />
  );
}
