import { useMemo, useRef } from 'react';

import { SUI_TYPE_ARG } from '@mysten/sui/utils';

import {
  Divider,
  Icon,
  InteractiveIcon,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useNetworkLogoUri } from '@onekeyhq/kit/src/hooks/useNetworkLogoUri';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import { CommunityRecognizedBadge } from '../../../components/CommunityRecognizedBadge';
import { MarketStarV2 } from '../../../components/MarketStarV2';
import {
  StockMarketStatusBadge,
  StockSourceLogo,
  SubtitleBadge,
} from '../../../components/PerpsBadges';
import { TokenTagsPopover } from '../../../components/TokenTagsPopover';
import { TokenSecurityAlert } from '../TokenSecurityAlert';
import { MarketTokenSelector } from '../TokenSelector/MarketTokenSelector';

import { useTokenDetailHeaderLeftActions } from './hooks/useTokenDetailHeaderLeftActions';
import { ShareButton } from './ShareButton';

interface ITokenDetailHeaderLeftProps {
  tokenDetail?: IMarketTokenDetail;
  networkId?: string;
  networkLogoUri?: string;
  showMediaAndSecurity?: boolean;
  isNative?: boolean;
  showFavoriteButton?: boolean;
  desktopRedesign?: boolean;
  desktopDetailVariant?: 'trending' | 'topCoins';
}

export function TokenDetailHeaderLeft({
  tokenDetail,
  networkId,
  networkLogoUri,
  showMediaAndSecurity = true,
  isNative = false,
  showFavoriteButton = true,
  desktopRedesign = false,
  desktopDetailVariant = 'trending',
}: ITokenDetailHeaderLeftProps) {
  const { md } = useMedia();

  // Use hook to get network logo with async fallback
  const effectiveNetworkLogoUri = useNetworkLogoUri({
    logoUri: networkLogoUri,
    networkId,
  });

  const {
    handleCopyAddress,
    handleOpenWebsite,
    handleOpenTwitter,
    handleOpenXSearch,
  } = useTokenDetailHeaderLeftActions({
    tokenDetail,
  });

  const {
    symbol = '',
    address = '',
    logoUrl = '',
    logoUrls,
    extraData,
    communityRecognized,
    stock,
  } = tokenDetail || {};

  const { website, twitter } = extraData || {};

  // Token detail polling hands back a brand new `logoUrls` array on every
  // refresh even when its contents are unchanged. Cache it behind its joined
  // value so the trigger element below keeps a stable identity, mirroring what
  // MarketTokenSelector does for its own default trigger.
  const logoUrlsCacheKey = useMemo(() => logoUrls?.join('|') ?? '', [logoUrls]);
  const stableLogoUrlsRef = useRef(logoUrls);
  const stableLogoUrlsKeyRef = useRef(logoUrlsCacheKey);

  if (stableLogoUrlsKeyRef.current !== logoUrlsCacheKey) {
    stableLogoUrlsRef.current = logoUrls;
    stableLogoUrlsKeyRef.current = logoUrlsCacheKey;
  }

  const stableLogoUrls = stableLogoUrlsRef.current;

  const isTopCoins = desktopDetailVariant === 'topCoins';
  // Figma 25593:18401 lays the trending desktop header out as one 72px row:
  // a single-line selector pill, the address/security/social row as the
  // flexible middle, and the favorite/share buttons on the right edge.
  const isTrendingDesktop = desktopRedesign && !md && !isTopCoins;

  const shortenedAddress = address
    ? accountUtils.shortenAddress({
        address,
        leadingLength: 6,
        trailingLength: 4,
      })
    : '';

  const socialIcons = (
    <>
      {website ? (
        <InteractiveIcon
          testID="market-icon"
          icon="GlobusOutline"
          onPress={handleOpenWebsite}
          size="$4"
        />
      ) : null}

      {twitter ? (
        <InteractiveIcon
          testID="market-icon"
          icon="Xbrand"
          onPress={handleOpenTwitter}
          size="$4"
        />
      ) : null}

      {address ? (
        <InteractiveIcon
          testID="market-icon"
          icon="SearchOutline"
          onPress={handleOpenXSearch}
          size="$4"
        />
      ) : null}
    </>
  );

  const marketStar =
    showFavoriteButton && networkId ? (
      <MarketStarV2
        chainId={networkId}
        contractAddress={address}
        size="small"
        customIconSize={desktopRedesign ? '$5' : '$4'}
        from={EWatchlistFrom.Detail}
        tokenSymbol={symbol}
        isNative={isNative}
      />
    ) : null;

  const shareButton = networkId ? (
    <ShareButton
      networkId={networkId}
      address={address}
      isNative={isNative}
      useIconButton
      // `useIconButton` defaults to a medium IconButton, which sits a size above
      // the small favorite button next to it. The stock detail header pins both
      // to small, so the redesigned desktop headers do the same.
      size={isTopCoins || isTrendingDesktop ? 'small' : undefined}
    />
  ) : null;

  // `MarketTokenSelector` memoizes its Popover on the trigger identity so the
  // popover tree survives token detail polling. Keep this element stable, and
  // declare the hook above the `isTrendingDesktop` early return so hook order
  // stays identical for every branch.
  const trendingSelectorTrigger = useMemo(
    () => (
      // eslint-disable-next-line props-checker/validator -- MarketTokenSelector injects the popover press handler.
      <XStack
        testID="trending-header-token-selector"
        alignItems="center"
        gap={14}
        minWidth={0}
        cursor="pointer"
        // Hovering paints a rounded-full pill that reaches 8px past the
        // content horizontally and 4px vertically. Each negative margin is
        // cancelled by matching padding, so the row itself never moves.
        ml={-8}
        mr={-8}
        my={-4}
        pl={8}
        pr={8}
        py={4}
        borderRadius="$full"
        borderCurve="continuous"
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
      >
        <Token
          size="xl"
          tokenImageUri={logoUrl}
          tokenImageUris={stableLogoUrls}
          networkImageUri={effectiveNetworkLogoUri}
          fallbackIcon="CryptoCoinOutline"
        />
        <XStack alignItems="center" gap="$1.5" minWidth={0}>
          <SizableText
            size="$headingXl"
            color="$text"
            numberOfLines={1}
            ellipsizeMode="tail"
            maxWidth="$48"
            flexShrink={1}
          >
            {symbol}
          </SizableText>
          {communityRecognized ? <CommunityRecognizedBadge /> : null}
        </XStack>
        {/* The chevron closes the whole pill and is centered on it, not
            tucked beside the ticker. */}
        <Icon name="ChevronDownSmallOutline" size="$5" color="$iconSubdued" />
      </XStack>
    ),
    [
      communityRecognized,
      effectiveNetworkLogoUri,
      logoUrl,
      stableLogoUrls,
      symbol,
    ],
  );

  if (isTrendingDesktop) {
    return (
      <XStack ai="center" flex={1} gap="$5" minWidth={0}>
        <MarketTokenSelector
          defaultCategory="trending"
          renderTrigger={trendingSelectorTrigger}
        />

        <XStack flex={1} minWidth={0} ai="center" gap="$2" py="$0.5">
          {/* Tokenized stocks reach this branch through the DEX token path, so
              the issuer logo, company subtitle and market status badge live
              here rather than inside the single-line selector pill. All three
              render nothing for plain DEX tokens. */}
          <StockSourceLogo stock={stock} />
          {stock?.subtitle ? (
            <SubtitleBadge subtitle={stock.subtitle} noTruncate />
          ) : null}
          <StockMarketStatusBadge stock={stock} />

          {address ? (
            <XStack ai="center" gap="$0.5">
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                cursor="pointer"
                hoverStyle={{ opacity: 0.8 }}
                pressStyle={{ opacity: 0.6 }}
                onPress={handleCopyAddress}
              >
                {shortenedAddress}
              </SizableText>

              <InteractiveIcon
                testID="market-icon"
                icon="Copy3Outline"
                size="$3.5"
                onPress={handleCopyAddress}
              />
            </XStack>
          ) : null}

          {showMediaAndSecurity ? (
            <>
              {address && networkId ? (
                <TokenSecurityAlert showLeadingDivider />
              ) : null}

              {website || twitter || address ? (
                <>
                  <Divider vertical backgroundColor="$borderSubdued" h="$3" />

                  <XStack gap="$2" ai="center">
                    {socialIcons}
                  </XStack>
                </>
              ) : null}
            </>
          ) : null}
        </XStack>

        <XStack ai="center" gap="$4">
          {marketStar}
          {shareButton}
        </XStack>
      </XStack>
    );
  }

  return (
    <XStack ai="center" flex={1} gap="$3" jc="space-between" minWidth={0}>
      <XStack gap="$3" ai="center" flex={1} minWidth={0}>
        {md ? (
          <Token
            size="md"
            tokenImageUri={logoUrl}
            tokenImageUris={logoUrls}
            networkImageUri={effectiveNetworkLogoUri}
            fallbackIcon="CryptoCoinOutline"
          />
        ) : (
          <>
            {desktopRedesign ? null : marketStar}
            <MarketTokenSelector
              variant={desktopRedesign ? 'large' : 'default'}
              showName={desktopDetailVariant === 'topCoins'}
              defaultCategory={
                desktopDetailVariant === 'topCoins' ? 'top_coins' : 'trending'
              }
            />
          </>
        )}

        <YStack flex={1} minWidth={0}>
          <XStack ai="center" gap="$1">
            {md ? (
              <SizableText
                size="$headingLg"
                color="$text"
                numberOfLines={1}
                ellipsizeMode="tail"
                maxWidth="$48"
                flexShrink={1}
              >
                {symbol}
              </SizableText>
            ) : null}
            {md ? (
              <>
                <TokenTagsPopover
                  communityRecognized={communityRecognized}
                  stock={stock}
                  showAllInTrigger
                  noTruncateSubtitle
                />
                <StockMarketStatusBadge stock={stock} />
              </>
            ) : (
              <>
                <StockSourceLogo stock={stock} />
                {/* Top Coins are all major assets, so the community-recognized
                    badge carries no signal there and the design omits it. */}
                {!isTopCoins && communityRecognized ? (
                  <CommunityRecognizedBadge />
                ) : null}
                {stock?.subtitle ? (
                  <SubtitleBadge subtitle={stock.subtitle} noTruncate />
                ) : null}
                <StockMarketStatusBadge stock={stock} />
              </>
            )}
          </XStack>

          <XStack gap="$2" ai="center">
            {desktopDetailVariant !== 'topCoins' && address ? (
              <XStack borderRadius="$1" ai="center" gap="$1">
                <SizableText
                  size="$bodySm"
                  color="$textSubdued"
                  cursor="pointer"
                  hoverStyle={{ opacity: 0.8 }}
                  pressStyle={{ opacity: 0.6 }}
                  onPress={handleCopyAddress}
                >
                  {shortenedAddress}
                </SizableText>

                <InteractiveIcon
                  testID="market-icon"
                  icon="Copy3Outline"
                  size="$4"
                  onPress={handleCopyAddress}
                />
              </XStack>
            ) : null}

            {/* Social Links & Security */}
            {desktopDetailVariant !== 'topCoins' && showMediaAndSecurity ? (
              <>
                {address && networkId ? (
                  <TokenSecurityAlert showLeadingDivider />
                ) : null}

                {website || twitter || address ? (
                  <>
                    <Divider vertical backgroundColor="$borderSubdued" h="$3" />

                    <XStack gap="$2" ai="center">
                      {socialIcons}

                      {!desktopRedesign &&
                      networkId &&
                      address &&
                      address !== SUI_TYPE_ARG ? (
                        <ShareButton
                          networkId={networkId}
                          address={address}
                          isNative={isNative}
                          size="$4"
                        />
                      ) : null}
                    </XStack>
                  </>
                ) : null}
              </>
            ) : null}
          </XStack>
        </YStack>
      </XStack>

      {md || desktopRedesign ? (
        <XStack gap={desktopRedesign ? '$4' : '$3'}>
          {marketStar}
          {shareButton}
        </XStack>
      ) : null}
    </XStack>
  );
}
