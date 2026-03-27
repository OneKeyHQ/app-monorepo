import { useCallback, useMemo, useRef } from 'react';

import {
  Icon,
  NavBackButton,
  SizableText,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { AccountSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { EModalMarketRoutes } from '../../../router';
import { useMarketDetailBackNavigation } from '../../hooks/useMarketDetailBackNavigation';
import { useTokenDetail } from '../../hooks/useTokenDetail';

import { TabPageHeaderContainer } from './TabPageHeaderContainer';

export function MarketDetailHeader() {
  const media = useMedia();
  const { handleBackPress } = useMarketDetailBackNavigation();
  const navigation = useAppNavigation();
  const { tokenDetail } = useTokenDetail();

  const onPressTokenSelector = useCallback(() => {
    navigation.pushModal(EModalRoutes.MarketModal, {
      screen: EModalMarketRoutes.MobileTokenSelector,
    });
  }, [navigation]);

  // Stabilize logoUrls to prevent re-renders from polling returning fresh array references
  const logoUrls = tokenDetail?.logoUrls;
  const logoUrlsCacheKey = useMemo(() => logoUrls?.join('|') ?? '', [logoUrls]);
  const stableLogoUrlsRef = useRef(logoUrls);
  const stableLogoUrlsKeyRef = useRef(logoUrlsCacheKey);
  if (stableLogoUrlsKeyRef.current !== logoUrlsCacheKey) {
    stableLogoUrlsRef.current = logoUrls;
    stableLogoUrlsKeyRef.current = logoUrlsCacheKey;
  }
  const stableLogoUrls = stableLogoUrlsRef.current;

  const customHeaderLeft = useMemo(
    () => (
      <XStack gap="$3" ai="center">
        <NavBackButton onPress={handleBackPress} />
        {platformEnv.isWeb || platformEnv.isExtensionUiExpandTab ? null : (
          <AccountSelectorTriggerHome num={0} />
        )}
      </XStack>
    ),
    [handleBackPress],
  );

  const customHeaderRight = useMemo(() => null, []);

  return (
    <>
      {media.md ? (
        <TabPageHeaderContainer>
          <NavBackButton onPress={handleBackPress} />

          <XStack
            alignItems="center"
            gap="$2"
            onPress={onPressTokenSelector}
            hoverStyle={{ opacity: 0.8 }}
            pressStyle={{ opacity: 0.6 }}
            cursor="pointer"
            flex={1}
          >
            <Token
              size="sm"
              tokenImageUri={tokenDetail?.logoUrl}
              tokenImageUris={stableLogoUrls}
              fallbackIcon="CryptoCoinOutline"
            />
            <SizableText size="$headingLg" numberOfLines={1}>
              {tokenDetail?.symbol || ''}
            </SizableText>
            <Icon
              name="ChevronDownSmallOutline"
              size="$4"
              color="$iconSubdued"
            />
          </XStack>
        </TabPageHeaderContainer>
      ) : (
        <TabPageHeader
          sceneName={EAccountSelectorSceneName.home}
          tabRoute={ETabRoutes.Market}
          customHeaderLeftItems={customHeaderLeft}
          customHeaderRightItems={
            platformEnv.isNative ? customHeaderRight : null
          }
          hideSearch={!media.gtMd}
        />
      )}
    </>
  );
}
