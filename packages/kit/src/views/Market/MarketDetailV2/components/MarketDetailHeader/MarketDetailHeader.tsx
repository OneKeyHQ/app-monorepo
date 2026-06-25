import { useCallback, useMemo, useRef } from 'react';

import {
  HeaderIconButton,
  Icon,
  InteractiveIcon,
  NavBackButton,
  Page,
  SizableText,
  XStack,
  YStack,
  glassBarItem,
  useClipboard,
  useIsOverlayPage,
  useMedia,
  useShare,
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
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  MarketStarV2,
  useStarV2Checked,
} from '../../../components/MarketStarV2';
import { TokenTagsPopover } from '../../../components/TokenTagsPopover';
import { buildMarketFullUrlV2 } from '../../../marketUtils';
import { EModalMarketRoutes } from '../../../router';
import { useMarketDetailBackNavigation } from '../../hooks/useMarketDetailBackNavigation';
import { useTokenDetail } from '../../hooks/useTokenDetail';
import { ShareButton } from '../TokenDetailHeader/ShareButton';

import { TabPageHeaderContainer } from './TabPageHeaderContainer';

export function MarketDetailHeader({
  showFavoriteButton = true,
}: {
  showFavoriteButton?: boolean;
}) {
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
      params: {
        showFavoriteButton,
      },
    });
  }, [navigation, showFavoriteButton]);

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

  // iOS 26+ mobile: render via the native UINavigationBar so the header
  // gets the system Liquid Glass material and the back chevron sits in
  // its proper iOS 26 circular glass container. The token symbol +
  // dropdown chevron live in headerTitle; Star + Share live in
  // headerRight. The address-copy secondary label that the custom pill
  // used to render below the symbol is dropped here — single-row
  // navigation bars can't host it cleanly. Pages that need the address
  // can surface it in the body content.
  const renderNativeHeaderTitle = useCallback(
    () => (
      <XStack ai="center" gap="$2" flex={1}>
        <Token
          size="sm"
          tokenImageUri={tokenDetail?.logoUrl}
          tokenImageUris={stableLogoUrls}
          networkImageUri={networkLogoUri}
          fallbackIcon="CryptoCoinOutline"
        />
        <XStack
          ai="center"
          gap="$1"
          flexShrink={1}
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
      </XStack>
    ),
    [
      tokenDetail?.logoUrl,
      tokenDetail?.symbol,
      stableLogoUrls,
      networkLogoUri,
      isOverlayPage,
      onPressTokenSelector,
    ],
  );

  // The native bar buttons render OneKey SVG icon buttons (custom items)
  // driven by the parent's React state. MarketDetailHeader is rendered
  // inside MarketWatchListProviderMirrorV2 so useStarV2Checked has access to
  // the watchlist store; the checked flag + onPress are captured here and
  // passed into the bar-item elements as plain props, so those elements
  // don't consume the watchlist store directly and need no Mirror wrap.
  const { checked: starChecked, onPress: onStarPress } = useStarV2Checked({
    chainId: networkId ?? '',
    contractAddress: tokenDetail?.address ?? '',
    from: EWatchlistFrom.Detail,
    tokenSymbol: tokenDetail?.symbol ?? '',
    isNative,
  });

  const { shareText } = useShare();

  const handleShareNative = useCallback(() => {
    if (!networkId) return;
    const shortCode =
      networkUtils.getNetworkShortCode({ networkId }) || networkId;
    const url = buildMarketFullUrlV2({
      network: shortCode,
      address: tokenDetail?.address ?? '',
      isNative,
    });
    void shareText(url);
  }, [networkId, tokenDetail?.address, isNative, shareText]);

  const handleStarNative = useCallback(() => {
    void onStarPress();
  }, [onStarPress]);

  const buildNativeHeaderRightItems = useCallback(
    () => [
      ...(showFavoriteButton
        ? [
            glassBarItem(
              <HeaderIconButton
                icon={starChecked ? 'StarSolid' : 'StarOutline'}
                onPress={handleStarNative}
              />,
            ),
          ]
        : []),
      glassBarItem(
        <HeaderIconButton icon="ShareOutline" onPress={handleShareNative} />,
      ),
    ],
    [showFavoriteButton, starChecked, handleStarNative, handleShareNative],
  );

  // Drive the back button through useMarketDetailBackNavigation so the
  // detail-specific routing (Search → Discovery, single-route stacks
  // resetting to Market home, split-view pop, SwapPro return) keeps
  // working under iOS 26's native bar. The default system back would
  // only pop the current stack and would render no entry at all when
  // state.index === 0.
  const buildNativeHeaderLeftItems = useCallback(
    () => [glassBarItem(<NavBackButton onPress={handleBackPress} />)],
    [handleBackPress],
  );

  if (media.md && platformEnv.isNativeIOS26Plus) {
    // Explicit headerShown is required because this route can also be
    // reached as a modal where the parent stack defaults headerShown to
    // false; without it the bar wouldn't render and the page body would
    // sit under the status bar.
    return (
      <Page.Header
        headerShown
        headerTitle={renderNativeHeaderTitle}
        unstable_headerLeftItems={buildNativeHeaderLeftItems}
        unstable_headerRightItems={buildNativeHeaderRightItems}
      />
    );
  }

  return (
    <>
      {media.md ? (
        <TabPageHeaderContainer>
          <NavBackButton onPress={handleBackPress} />

          <XStack flex={1} ai="center" gap="$2">
            <Token
              size="md"
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
                      testID="market-icon"
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
              {showFavoriteButton ? (
                <MarketStarV2
                  chainId={networkId}
                  contractAddress={tokenDetail?.address ?? ''}
                  size="large"
                  from={EWatchlistFrom.Detail}
                  tokenSymbol={tokenDetail?.symbol ?? ''}
                  isNative={isNative}
                />
              ) : null}
              <ShareButton
                networkId={networkId}
                address={tokenDetail?.address ?? ''}
                isNative={isNative}
                useIconButton
                size="large"
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
