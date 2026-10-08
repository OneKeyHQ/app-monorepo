import { useCallback, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  HeaderIconButton,
  Icon,
  InteractiveIcon,
  NavBackButton,
  Page,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  glassBarItem,
  useClipboard,
  useIsOverlayPage,
  useMedia,
  useSafeAreaInsets,
  useShare,
} from '@onekeyhq/components';
import { AccountSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useNetworkLogoUri } from '@onekeyhq/kit/src/hooks/useNetworkLogoUri';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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
import { EModalMarketRoutes } from '../../../router/types';
import { useMarketDetailBackNavigation } from '../../hooks/useMarketDetailBackNavigation';
import { useMarketDetailHeaderDisplayData } from '../../hooks/useMarketDetailDisplayData';
import { useMarketDetailWatchlistIdentity } from '../../hooks/useMarketDetailWatchlistIdentity';
import { ShareButton } from '../TokenDetailHeader/ShareButton';

import { TabPageHeaderContainer } from './TabPageHeaderContainer';

import type { NativeStackHeaderItem } from '@react-navigation/native-stack';

// Holds the address line while a stock route resolves its token, so the
// title does not re-center when the address arrives.
function AddressLineSkeleton() {
  return <Skeleton.BodySm w={96} />;
}

export function MarketDetailHeader({
  showFavoriteButton = true,
}: {
  showFavoriteButton?: boolean;
}) {
  const media = useMedia();
  const intl = useIntl();
  const { width: windowWidth } = useWindowDimensions();
  const { left: safeAreaLeft, right: safeAreaRight } = useSafeAreaInsets();
  const listingIdentity = useMarketDetailWatchlistIdentity();
  const { handleBackPress } = useMarketDetailBackNavigation();
  const navigation = useAppNavigation();
  const { tokenDetail, networkId, isNative } =
    useMarketDetailHeaderDisplayData();
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

  const handleCopyAddress = useCallback(() => {
    const address = tokenDetail?.address;
    if (!address) {
      return;
    }
    copyText(address);
    defaultLogger.dex.actions.dexCopyCA({
      copyFrom: ECopyFrom.Detail,
      copiedContent: address,
    });
  }, [copyText, tokenDetail?.address]);

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

  // Reserve the bar margins, back/action capsules, and the title's side gaps.
  // Custom bar items resist native compression, so constrain long identities
  // before UIKit lays out the left and right item groups.
  const nativeHeaderTitleMaxWidth = Math.max(
    0,
    windowWidth -
      safeAreaLeft -
      safeAreaRight -
      40 -
      44 -
      (showFavoriteButton ? 100 : 44) -
      32,
  );

  const renderNativeHeaderTitle = useCallback(
    () => (
      <XStack
        testID="market-detail-native-header-title"
        ai="center"
        gap="$2"
        flexShrink={1}
        minWidth={0}
        width={nativeHeaderTitleMaxWidth}
        maxWidth={nativeHeaderTitleMaxWidth}
      >
        <Token
          size="sm"
          tokenImageUri={tokenDetail?.logoUrl}
          tokenImageUris={stableLogoUrls}
          networkImageUri={networkLogoUri}
          fallbackIcon="CryptoCoinOutline"
        />
        <YStack flexShrink={1} minWidth={0}>
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
            <SizableText size="$headingLg" numberOfLines={1} flexShrink={1}>
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

          {tokenDetail?.communityRecognized ||
          tokenDetail?.address ||
          !isNative ? (
            <XStack ai="center" gap="$1" minWidth={0}>
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
                <XStack ai="center" gap="$1" flexShrink={1} minWidth={0}>
                  <SizableText
                    size="$bodySm"
                    color="$textSubdued"
                    numberOfLines={1}
                    flexShrink={1}
                    cursor="pointer"
                    hoverStyle={{ opacity: 0.8 }}
                    pressStyle={{ opacity: 0.6 }}
                    onPress={handleCopyAddress}
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
                    onPress={handleCopyAddress}
                  />
                </XStack>
              ) : null}
              {!tokenDetail?.address && !isNative ? (
                <AddressLineSkeleton />
              ) : null}
            </XStack>
          ) : null}
        </YStack>
      </XStack>
    ),
    [
      tokenDetail?.logoUrl,
      tokenDetail?.symbol,
      tokenDetail?.communityRecognized,
      tokenDetail?.stock,
      tokenDetail?.address,
      isNative,
      stableLogoUrls,
      networkLogoUri,
      isOverlayPage,
      onPressTokenSelector,
      handleCopyAddress,
      nativeHeaderTitleMaxWidth,
    ],
  );

  // The native bar buttons render OneKey SVG icon buttons (custom items)
  // driven by the parent's React state. MarketDetailHeader is rendered
  // inside MarketWatchListProviderMirrorV2 so useStarV2Checked has access to
  // the watchlist store; the checked flag + onPress are captured here and
  // passed into the bar-item elements as plain props, so those elements
  // don't consume the watchlist store directly and need no Mirror wrap.
  const { checked: starChecked, onPress: onStarPress } = useStarV2Checked({
    ...listingIdentity,
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
  // working under iOS 26's native bar. Keep this as a native bar item so
  // UIKit does not expose a React custom-view frame during pop transitions.
  const buildNativeHeaderLeftItems = useCallback(
    (): NativeStackHeaderItem[] => [
      {
        type: 'button',
        label: intl.formatMessage({ id: ETranslations.global_back }),
        accessibilityLabel: intl.formatMessage({
          id: ETranslations.global_back,
        }),
        icon: { type: 'sfSymbol', name: 'chevron.backward' },
        identifier: 'market-detail-back',
        onPress: handleBackPress,
      },
    ],
    [handleBackPress, intl],
  );

  if (media.md && platformEnv.isNativeIOS26Plus) {
    // Explicit headerShown is required because this route can also be
    // reached as a modal where the parent stack defaults headerShown to
    // false; without it the bar wouldn't render and the page body would
    // sit under the status bar.
    return (
      <Page.Header
        headerShown
        // A fixed-width titleView avoids the initial intrinsic-size growth that
        // previously let long identities overlap the bar items. Keeping it in
        // the native title slot also avoids a custom left-item snapshot on pop.
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
                      onPress={handleCopyAddress}
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
                      onPress={handleCopyAddress}
                    />
                  </XStack>
                ) : null}
                {!tokenDetail?.address && !isNative ? (
                  <AddressLineSkeleton />
                ) : null}
              </XStack>
            </YStack>
          </XStack>

          {networkId || listingIdentity.assetId || listingIdentity.stockId ? (
            <XStack gap="$3" ai="center">
              {showFavoriteButton ? (
                <MarketStarV2
                  {...listingIdentity}
                  chainId={networkId ?? ''}
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
