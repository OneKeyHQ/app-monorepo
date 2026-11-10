import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  IconButton,
  ListView,
  NumberSizeableText,
  Page,
  Popover,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { s } from '@onekeyhq/components/src/utils/scale';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import { formatRelativeTimeAbbr } from '@onekeyhq/shared/src/utils/dateUtils';
import { getMarketWatchlistKey } from '@onekeyhq/shared/src/utils/marketWatchlistIdentity';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type {
  IMarketHighlight,
  IMarketHighlightAsset,
} from '@onekeyhq/shared/types/marketV2';

import { MarketPerpsStarV2, MarketStarV2 } from '../components/MarketStarV2';
import {
  LeverageBadge,
  USStockMarketStatusIcon,
} from '../components/PerpsBadges';
import { PriceChangePercentage } from '../components/PriceChangePercentage';
import { usePerpsNavigation } from '../hooks/usePerpsNavigation';
import { prewarmMarketTokenImages } from '../MarketDetailV2/utils/marketDetailImagePreload';
import { useToDetailPage } from '../MarketHomeV2/components/MarketTokenList/hooks/useToMarketDetailPage';
import { MarketWatchListProviderMirrorV2 } from '../MarketWatchListProviderMirrorV2';

import { useMarketHighlightQuotes } from './useMarketHighlightQuotes';
import { useMarketHighlights } from './useMarketHighlights';

import type { IMarketHighlightQuote } from './useMarketHighlightQuotes';
import type {
  EModalMarketRoutes,
  IModalMarketParamList,
} from '../router/types';
import type { RouteProp } from '@react-navigation/core';
import type { ListRenderItem } from 'react-native';

const MAX_CARD_ASSETS = 3;

function HighlightInfo({
  links,
  wide,
}: {
  links: IMarketHighlight['links'];
  wide: boolean;
}) {
  const intl = useIntl();
  const title = intl.formatMessage({ id: ETranslations.global_info });
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover
      open={isOpen}
      onOpenChange={setIsOpen}
      title={title}
      showHeader={!wide}
      placement="bottom-end"
      offset={wide ? { mainAxis: 6, crossAxis: 14 } : undefined}
      floatingPanelProps={{ width: 288, borderRadius: '$2' }}
      renderTrigger={
        // eslint-disable-next-line props-checker/validator -- Popover supplies the trigger handler.
        <XStack
          testID="market-highlights-info"
          role="button"
          alignItems="center"
          gap="$1"
          px="$2"
          py="$1"
          borderRadius="$full"
          bg={isOpen ? '$bgActive' : undefined}
          hoverStyle={{ bg: isOpen ? '$bgActive' : '$bgHover' }}
          pressStyle={{ bg: '$bgActive' }}
          accessibilityState={{ expanded: isOpen }}
        >
          <SizableText size="$bodySmMedium" color="$textSubdued">
            {title}
          </SizableText>
          <Icon
            name="ChevronDownSmallOutline"
            size="$3.5"
            color="$iconSubdued"
          />
        </XStack>
      }
      renderContent={
        <YStack
          px={wide ? '$3' : '$5'}
          pb={wide ? '$2.5' : '$5'}
          pt={wide ? '$2.5' : undefined}
          gap="$2"
        >
          <XStack
            flexDirection={wide ? 'row' : 'column'}
            flexWrap={wide ? 'wrap' : 'nowrap'}
            gap={wide ? '$3' : '$1'}
          >
            {links
              .filter(({ url }) => /^https?:\/\//i.test(url))
              .map(({ title: label, url }, index) => (
                <XStack
                  key={`${url}:${index}`}
                  role="link"
                  minHeight={wide ? undefined : 40}
                  gap="$1"
                  alignItems="center"
                  justifyContent={wide ? 'flex-start' : 'space-between'}
                  onPress={() => openUrlExternal(url)}
                >
                  <SizableText
                    size={wide ? '$bodySmMedium' : '$bodyMd'}
                    color={wide ? '$textSubdued' : '$text'}
                    flexShrink={1}
                  >
                    {label}
                  </SizableText>
                  <Icon
                    name="OpenOutline"
                    size={wide ? '$3.5' : '$4'}
                    color="$iconSubdued"
                  />
                </XStack>
              ))}
          </XStack>
          <SizableText size={wide ? '$bodySm' : '$bodyMd'} color="$textSubdued">
            {intl.formatMessage({
              id: ETranslationsMock.market_highlights_disclaimer__desc,
              defaultMessage:
                ETranslationsMock.market_highlights_disclaimer__desc,
            })}
          </SizableText>
        </YStack>
      }
    />
  );
}

function HighlightDescription({
  description,
  wide,
}: {
  description: string;
  wide: boolean;
}) {
  const intl = useIntl();
  const [expanded, setExpanded] = useState(false);
  const [fullHeight, setFullHeight] = useState(0);
  const maxLines = wide ? 3 : 4;
  const isTruncated = fullHeight > s(20) * maxLines + 1;
  const showMore = intl.formatMessage({ id: ETranslations.global_show_more });
  const showLess = intl.formatMessage({ id: ETranslations.global_show_less });

  return (
    <YStack alignSelf="stretch">
      <YStack
        aria-hidden
        position="absolute"
        width="100%"
        opacity={0}
        pointerEvents="none"
        onLayout={({ nativeEvent }) => setFullHeight(nativeEvent.layout.height)}
      >
        <SizableText size="$bodyMd">{description}</SizableText>
      </YStack>
      <SizableText
        size="$bodyMd"
        color="$textSubdued"
        numberOfLines={isTruncated && !expanded ? maxLines : undefined}
      >
        {description}
      </SizableText>
      {isTruncated ? (
        <XStack
          testID="market-highlights-description-toggle"
          position={expanded ? undefined : 'absolute'}
          right={expanded ? undefined : 0}
          bottom={expanded ? undefined : 0}
          alignSelf="flex-start"
          gap="$1"
          bg="$bgSubdued"
          role="button"
          accessibilityLabel={expanded ? showLess : showMore}
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((value) => !value)}
        >
          {expanded ? null : (
            <SizableText size="$bodyMd" color="$textSubdued">
              …
            </SizableText>
          )}
          <SizableText
            size="$bodyMd"
            textDecorationLine="underline"
            textTransform={
              !expanded && intl.locale.startsWith('en')
                ? 'capitalize'
                : undefined
            }
          >
            {expanded ? showLess : showMore}
          </SizableText>
        </XStack>
      ) : null}
    </YStack>
  );
}

function HighlightAssetRow({
  asset,
  quote,
  onPress,
  wide,
}: {
  asset: IMarketHighlightAsset;
  quote?: IMarketHighlightQuote;
  onPress: (asset: IMarketHighlightAsset) => void;
  wide: boolean;
}) {
  const { favorite } = asset;
  const maxLeverage = asset.type === 'perp' ? quote?.maxLeverage : undefined;
  return (
    <XStack
      alignItems="center"
      width={wide ? undefined : '100%'}
      maxWidth={wide ? 240 : undefined}
      minWidth={0}
      py={wide ? '$3' : undefined}
      gap={wide ? '$3' : '$1'}
    >
      <XStack
        testID={`market-highlights-asset-${getMarketWatchlistKey(favorite)}`}
        role="button"
        flex={wide ? undefined : 1}
        flexShrink={1}
        minWidth={0}
        alignItems="center"
        gap="$3"
        minHeight={44}
        onPress={() => onPress(asset)}
      >
        <Token
          size="md"
          tokenImageUri={quote?.logoUrl}
          networkId={asset.type === 'token' ? asset.chainId : undefined}
          showNetworkIcon={asset.type === 'token'}
        />
        <YStack
          flex={wide ? undefined : 1}
          minWidth={0}
          flexDirection={wide ? 'column' : 'row'}
          alignItems={wide ? 'flex-start' : 'center'}
          gap={wide ? undefined : '$2'}
        >
          <XStack
            flex={wide ? undefined : 1}
            flexBasis={wide ? undefined : 0}
            minWidth={0}
            flexShrink={1}
            alignItems="center"
            gap="$1.5"
          >
            <SizableText flexShrink={1} size="$bodyLgMedium" numberOfLines={1}>
              {asset.symbol}
            </SizableText>
            {quote?.isUSStock ? <USStockMarketStatusIcon /> : null}
            {maxLeverage && maxLeverage > 0 ? (
              <LeverageBadge leverage={maxLeverage} compact={!wide} />
            ) : null}
          </XStack>
          <XStack
            flex={wide ? undefined : 2}
            flexBasis={wide ? undefined : 0}
            minWidth={0}
            maxWidth={wide ? undefined : 160}
            alignItems="center"
            gap="$1.5"
          >
            <XStack
              flex={wide ? undefined : 3}
              flexBasis={wide ? undefined : 0}
              minWidth={0}
              justifyContent={wide ? undefined : 'center'}
            >
              <NumberSizeableText
                size="$bodyMd"
                formatter="price"
                formatterOptions={{ currency: '$' }}
                numberOfLines={1}
                flexShrink={1}
                adjustsFontSizeToFit={!wide}
              >
                {quote?.price ?? '-'}
              </NumberSizeableText>
            </XStack>
            <XStack
              flex={wide ? undefined : 2}
              flexBasis={wide ? undefined : 0}
              minWidth={0}
              justifyContent={wide ? undefined : 'center'}
            >
              <PriceChangePercentage numberOfLines={1} flexShrink={1}>
                {quote?.priceChange24hPercent}
              </PriceChangePercentage>
            </XStack>
          </XStack>
        </YStack>
      </XStack>
      {asset.type === 'perp' ? (
        <MarketPerpsStarV2
          perpsCoin={asset.perpsCoin}
          size="small"
          customIconSize="$4"
        />
      ) : (
        <MarketStarV2
          size="small"
          customIconSize="$4"
          from={EWatchlistFrom.Others}
          tokenSymbol={asset.symbol}
          assetId={favorite.assetId}
          stockId={favorite.stockId}
          chainId={favorite.chainId}
          contractAddress={favorite.contractAddress}
          isNative={favorite.isNative}
        />
      )}
    </XStack>
  );
}

function HighlightCard({
  item,
  quotes,
  onAssetPress,
  wide,
}: {
  item: IMarketHighlight;
  quotes?: Map<string, IMarketHighlightQuote>;
  onAssetPress: (asset: IMarketHighlightAsset) => void;
  wide: boolean;
}) {
  const publishedAt = new Date(item.publishedAt);
  const time = formatRelativeTimeAbbr(publishedAt);

  return (
    <YStack
      testID="market-highlights-card"
      bg="$bgSubdued"
      borderRadius="$3"
      p={wide ? '$5' : '$4'}
      gap={wide ? '$4' : '$3'}
    >
      <YStack
        flexDirection={wide ? 'row' : 'column'}
        alignItems={wide ? 'center' : 'flex-start'}
        justifyContent={wide ? 'space-between' : undefined}
        gap={wide ? '$3' : '$2'}
      >
        <XStack alignItems="center" flexShrink={1} minWidth={0} gap="$3">
          <SizableText size="$headingMd" flexShrink={1}>
            {item.title}
          </SizableText>
          {wide ? (
            <SizableText size="$bodyMd" color="$textSubdued">
              {time.toUpperCase()}
            </SizableText>
          ) : null}
        </XStack>
        <XStack alignItems="center" gap="$2" flexShrink={0}>
          {wide ? null : (
            <>
              <SizableText size="$bodySmMedium" color="$textSubdued">
                {time.toUpperCase()}
              </SizableText>
              <Stack width={1} height={10} bg="$borderSubdued" />
            </>
          )}
          <HighlightInfo links={item.links} wide={wide} />
        </XStack>
      </YStack>
      <HighlightDescription
        key={item.description}
        description={item.description}
        wide={wide}
      />
      <YStack
        flexDirection={wide ? 'row' : 'column'}
        flexWrap={wide ? 'wrap' : 'nowrap'}
        alignItems={wide ? 'center' : 'stretch'}
        gap={wide ? '$5' : '$2'}
      >
        {item.assets.slice(0, MAX_CARD_ASSETS).map((asset, index) => {
          const identity = getMarketWatchlistKey(asset.favorite);
          return (
            <Fragment key={`${identity}:${index}`}>
              {wide && index > 0 ? (
                <Stack width={1} height={44} bg="$borderDisabled" />
              ) : null}
              <HighlightAssetRow
                asset={asset}
                quote={quotes?.get(identity)}
                onPress={onAssetPress}
                wide={wide}
              />
            </Fragment>
          );
        })}
      </YStack>
    </YStack>
  );
}

function MarketHighlightsContent() {
  const route =
    useRoute<
      RouteProp<IModalMarketParamList, EModalMarketRoutes.MarketHighlights>
    >();
  const initialQuotes = useMemo(
    () =>
      route.params?.initialQuotes
        ? new Map(route.params.initialQuotes)
        : undefined,
    [route.params?.initialQuotes],
  );
  const intl = useIntl();
  const { gtMd: wide } = useMedia();
  const title = intl.formatMessage({
    id: ETranslationsMock.market_highlights__title,
    defaultMessage: ETranslationsMock.market_highlights__title,
  });
  const { popStack } = useAppNavigation();
  const { navigateToPerps } = usePerpsNavigation();
  const toDetailPage = useToDetailPage({ switchToMarketTabFirst: true });
  const { items, isLoading, retry } = useMarketHighlights(
    route.params?.initialHighlights,
  );
  const assets = useMemo(
    () => items?.flatMap((item) => item.assets.slice(0, MAX_CARD_ASSETS)),
    [items],
  );
  const quotes = useMarketHighlightQuotes(assets, initialQuotes);
  useEffect(() => {
    if (!quotes) return;
    prewarmMarketTokenImages(
      {
        tokenImageUris: [...quotes.values()]
          .map((quote) => quote.logoUrl)
          .filter((url): url is string => Boolean(url)),
      },
      { limit: quotes.size },
    );
  }, [quotes]);
  const onAssetPress = useCallback(
    (asset: IMarketHighlightAsset) => {
      if (asset.type === 'perp') {
        navigateToPerps(asset.perpsCoin, { dismissOverlays: true });
        return;
      }
      popStack();
      void toDetailPage({
        symbol: asset.symbol,
        name: asset.name,
        tokenAddress: asset.type === 'token' ? asset.contractAddress : '',
        networkId: asset.type === 'token' ? asset.chainId : '',
        isNative: asset.type === 'token' ? asset.isNative : undefined,
        stockId: asset.type === 'stock' ? asset.stockId : undefined,
        assetId: asset.type === 'asset' ? asset.assetId : undefined,
      });
    },
    [navigateToPerps, popStack, toDetailPage],
  );
  const renderItem = useCallback<ListRenderItem<IMarketHighlight>>(
    ({ item }) => (
      <YStack px={wide ? '$5' : '$4'} pb="$3">
        <HighlightCard
          item={item}
          quotes={quotes}
          onAssetPress={onAssetPress}
          wide={wide}
        />
      </YStack>
    ),
    [onAssetPress, quotes, wide],
  );

  return (
    <Page>
      <Page.Header headerShown={!wide} title={title} />
      <Page.Body bg="$bgApp" minHeight={0}>
        {wide ? (
          <XStack
            testID="market-highlights-header"
            h={52}
            px="$5"
            gap="$4"
            flexShrink={0}
            alignItems="center"
          >
            <IconButton
              testID="market-highlights-close"
              title={intl.formatMessage({ id: ETranslations.global_close })}
              icon="CrossedLargeOutline"
              iconProps={{ color: '$iconSubdued' }}
              variant="tertiary"
              ml="$-2"
              onPress={popStack}
            />
            <SizableText size="$headingLg">{title}</SizableText>
          </XStack>
        ) : null}
        {items?.length ? (
          <YStack testID="market-highlights-list" flex={1} minHeight={0}>
            <ListView
              data={items}
              keyExtractor={(item) => item.highlightId}
              renderItem={renderItem}
              ListHeaderComponent={<Stack height={10} />}
            />
          </YStack>
        ) : (
          <YStack flex={1} alignItems="center" justifyContent="center" gap="$3">
            {isLoading ? <Spinner /> : null}
            {!isLoading && items ? (
              <SizableText color="$textSubdued">
                {intl.formatMessage({ id: ETranslations.global_no_data })}
              </SizableText>
            ) : null}
            {!isLoading && !items ? (
              <Button
                testID="market-highlights-retry"
                onPress={() => void retry()}
              >
                {intl.formatMessage({ id: ETranslations.global_retry })}
              </Button>
            ) : null}
          </YStack>
        )}
      </Page.Body>
    </Page>
  );
}

export function MarketHighlightsPage() {
  return (
    <MarketWatchListProviderMirrorV2
      storeName={EJotaiContextStoreNames.marketWatchListV2}
    >
      <MarketHighlightsContent />
    </MarketWatchListProviderMirrorV2>
  );
}
