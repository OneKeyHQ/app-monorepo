import { useCallback, useMemo, useRef } from 'react';

import {
  Icon,
  InteractiveIcon,
  NavBackButton,
  SizableText,
  XStack,
  YStack,
  useClipboard,
  useIsOverlayPage,
  useMedia,
} from '@onekeyhq/components';
import { AccountSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useNetworkLogoUri } from '@onekeyhq/kit/src/hooks/useNetworkLogoUri';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  ECopyFrom,
  EWatchlistFrom,
} from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { MarketStarV2 } from '../../../components/MarketStarV2';
import { TokenTagsPopover } from '../../../components/TokenTagsPopover';
import { EModalMarketRoutes } from '../../../router';
import { useMarketDetailBackNavigation } from '../../hooks/useMarketDetailBackNavigation';
import { useTokenDetail } from '../../hooks/useTokenDetail';
import { ShareButton } from '../TokenDetailHeader/ShareButton';

import { TabPageHeaderContainer } from './TabPageHeaderContainer';

export function MarketDetailHeader() {
  const media = useMedia();
  const { handleBackPress } = useMarketDetailBackNavigation();
  const navigation = useAppNavigation();
  const { tokenDetail, networkId, isNative } = useTokenDetail();
  const { copyText } = useClipboard();
  const isOverlayPage = useIsOverlayPage();

  const networkLogoUri = useNetworkLogoUri({ networkId });

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

          <XStack flex={1} ai="center" gap="$2">
            <Token
              size="sm"
              tokenImageUri={tokenDetail?.logoUrl}
              tokenImageUris={stableLogoUrls}
              networkImageUri={networkLogoUri}
              fallbackIcon="CryptoCoinOutline"
            />
            <YStack>
              <XStack
                alignItems="center"
                gap="$2"
                {...(!isOverlayPage && {
                  onPress: onPressTokenSelector,
                  hoverStyle: { opacity: 0.8 },
                  pressStyle: { opacity: 0.6 },
                  cursor: 'pointer',
                })}
              >
                <SizableText size="$headingLg" numberOfLines={1}>
                  {tokenDetail?.symbol || ''}
                </SizableText>
                {!isOverlayPage ? (
                  <Icon
                    name="ChevronDownSmallOutline"
                    size="$4"
                    color="$iconSubdued"
                  />
                ) : null}
              </XStack>

              <XStack ai="center" gap="$1">
                {tokenDetail?.communityRecognized ? (
                  <TokenTagsPopover
                    communityRecognized={tokenDetail.communityRecognized}
                    stock={tokenDetail.stock}
                    customTrigger={
                      <Icon
                        name="BadgeRecognizedSolid"
                        size="$4"
                        color="$iconSuccess"
                      />
                    }
                  />
                ) : null}
                {tokenDetail?.address ? (
                  <XStack ai="center" gap="$1">
                    <SizableText
                      size="$bodySm"
                      color="$textSubdued"
                      numberOfLines={1}
                      cursor="pointer"
                      hoverStyle={{ opacity: 0.8 }}
                      pressStyle={{ opacity: 0.6 }}
                      onPress={() => {
                        copyText(tokenDetail.address);
                        defaultLogger.dex.actions.dexCopyCA({
                          copyFrom: ECopyFrom.Detail,
                          copiedContent: tokenDetail.address,
                        });
                      }}
                    >
                      {accountUtils.shortenAddress({
                        address: tokenDetail.address,
                        leadingLength: 6,
                        trailingLength: 4,
                      })}
                    </SizableText>
                    <InteractiveIcon
                      icon="Copy3Outline"
                      size="$4"
                      onPress={() => {
                        copyText(tokenDetail.address);
                        defaultLogger.dex.actions.dexCopyCA({
                          copyFrom: ECopyFrom.Detail,
                          copiedContent: tokenDetail.address,
                        });
                      }}
                    />
                  </XStack>
                ) : null}
              </XStack>
            </YStack>
          </XStack>

          {networkId ? (
            <XStack gap="$3" ai="center">
              <MarketStarV2
                chainId={networkId}
                contractAddress={tokenDetail?.address ?? ''}
                size="small"
                from={EWatchlistFrom.Detail}
                tokenSymbol={tokenDetail?.symbol ?? ''}
                isNative={isNative}
              />
              <ShareButton
                networkId={networkId}
                address={tokenDetail?.address ?? ''}
                isNative={isNative}
                useIconButton
              />
            </XStack>
          ) : null}
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
