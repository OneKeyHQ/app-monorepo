import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import {
  type ISelectRenderTriggerProps,
  Icon,
  Image,
  Select,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import {
  Token,
  getTokenImageResizeWidth,
} from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IBorrowMarketItem } from '@onekeyhq/shared/types/staking';

import { EBorrowDataStatus } from '../borrowDataStatus';
import { getBorrowMarketLabel } from '../borrowMarketDisplayName';
import {
  buildBorrowMarketKey,
  useBorrowContext,
  useBorrowMarketRequestContext,
} from '../BorrowProvider';
import { BorrowTestIDs } from '../testIDs';

import {
  getBorrowMarketIconSources,
  getBorrowMarketNetworkLogoResizeWidth,
  prewarmBorrowImages,
} from './borrowImagePrewarm';

const MAX_MOUNTED_MARKET_LOGOS = 3;

function MarketLogoPlaceholder({
  size,
  fill = false,
}: {
  size: 'md' | 'sm';
  fill?: boolean;
}) {
  const dimension = size === 'md' ? '$8' : '$6';
  return (
    <Stack
      width={fill ? '100%' : dimension}
      height={fill ? '100%' : dimension}
      ai="center"
      jc="center"
      bg="$bgStrong"
      borderRadius="$2"
    >
      <Icon
        name="ImageWavesOutline"
        size={size === 'md' ? '$5' : '$4'}
        color="$iconSubdued"
      />
    </Stack>
  );
}

function MarketNetworkLogo({
  logoURI,
  size,
}: {
  logoURI?: string;
  size: 'md' | 'sm';
}) {
  if (!logoURI) {
    return null;
  }
  const imageSize = size === 'md' ? '$4' : '$3';
  return (
    <Stack
      position="absolute"
      right="$-1"
      bottom="$-1"
      p="$0.5"
      bg="$bgApp"
      borderRadius="$full"
    >
      <Image
        size={imageSize}
        src={logoURI}
        resizeWidth={getBorrowMarketNetworkLogoResizeWidth(size)}
        loadingStrategy={platformEnv.isNative ? 'static' : undefined}
        bg="$bgApp"
        borderRadius="$full"
        placeholder={<Stack width="100%" height="100%" bg="$bgApp" />}
        fallback={
          <Icon
            size={size === 'md' ? '$4' : '$3'}
            name="GlobusOutline"
            color="$iconSubdued"
          />
        }
      />
    </Stack>
  );
}

const MarketLogo = memo(
  ({ market, size }: { market: IBorrowMarketItem; size: 'md' | 'sm' }) => {
    return (
      <Stack
        position="relative"
        width={size === 'md' ? '$8' : '$6'}
        height={size === 'md' ? '$8' : '$6'}
        flexShrink={0}
      >
        <Token
          isNFT
          tokenImageUri={market.logoURI}
          size={size}
          // Keep the visible request identical to borrowImagePrewarm's variant so
          // a completed prewarm is a synchronous memory hit on re-entry.
          resizeWidth={getTokenImageResizeWidth(size)}
          loadingStrategy={platformEnv.isNative ? 'static' : undefined}
          bg="$bgSubdued"
          borderWidth={0}
          placeholder={<MarketLogoPlaceholder size={size} fill />}
        />
        <MarketNetworkLogo logoURI={market.network.logoURI} size={size} />
      </Stack>
    );
  },
);

MarketLogo.displayName = 'BorrowMarketLogo';

function MarketLogoStack({
  market,
  markets,
}: {
  market: IBorrowMarketItem | null;
  markets: IBorrowMarketItem[];
}) {
  const [recentMarkets, setRecentMarkets] = useState<IBorrowMarketItem[]>([]);
  const selectedKey = market ? buildBorrowMarketKey(market) : undefined;

  useEffect(() => {
    if (!market) {
      return;
    }
    setRecentMarkets((current) => {
      const next = [
        market,
        ...current.filter((item) => buildBorrowMarketKey(item) !== selectedKey),
      ].slice(0, MAX_MOUNTED_MARKET_LOGOS);
      if (
        current.length === next.length &&
        current.every(
          (item, index) =>
            buildBorrowMarketKey(item) === buildBorrowMarketKey(next[index]) &&
            item.logoURI === next[index].logoURI &&
            item.network.logoURI === next[index].network.logoURI,
        )
      ) {
        return current;
      }
      return next;
    });
  }, [market, selectedKey]);

  let mountedMarkets: IBorrowMarketItem[] = [];
  if (market) {
    const selectedIsInCatalog = markets.some(
      (item) => buildBorrowMarketKey(item) === selectedKey,
    );
    if (markets.length <= MAX_MOUNTED_MARKET_LOGOS && selectedIsInCatalog) {
      mountedMarkets = markets;
    } else {
      mountedMarkets = [
        market,
        ...(markets.length <= MAX_MOUNTED_MARKET_LOGOS
          ? markets
          : recentMarkets
        ).filter((item) => buildBorrowMarketKey(item) !== selectedKey),
      ].slice(0, MAX_MOUNTED_MARKET_LOGOS);
    }
  }

  return (
    <Stack w="$8" h="$8" flexShrink={0}>
      {!market ? <MarketLogoPlaceholder size="md" /> : null}
      {mountedMarkets.map((item) => {
        const isSelected = buildBorrowMarketKey(item) === selectedKey;
        return (
          <Stack
            key={buildBorrowMarketKey(item)}
            position="absolute"
            top={0}
            left={0}
            opacity={isSelected ? 1 : 0}
            pointerEvents="none"
            accessibilityElementsHidden={!isSelected}
            importantForAccessibility={
              isSelected ? 'auto' : 'no-hide-descendants'
            }
          >
            <MarketLogo market={item} size="md" />
          </Stack>
        );
      })}
    </Stack>
  );
}

/**
 * The one market there is to look at: the page's subject line rather than a
 * control. Same type as the switcher, without its fill and chevron — with
 * nothing to switch to, both would promise a menu that never opens. Production
 * currently ships exactly one market, so this is the common case.
 */
function MarketIdentity({
  market,
  label,
}: {
  market: IBorrowMarketItem | null;
  label: string;
}) {
  return (
    <XStack
      ai="center"
      gap="$3"
      px="$4"
      py="$3"
      maxWidth="100%"
      alignSelf="flex-start"
      minWidth={0}
      $gtMd={{ px: '$5' }}
    >
      {market ? (
        <MarketLogo market={market} size="md" />
      ) : (
        <MarketLogoPlaceholder size="md" />
      )}
      <SizableText size="$headingLg" numberOfLines={1} flexShrink={1}>
        {label}
      </SizableText>
    </XStack>
  );
}

/**
 * The switcher, as one bar on every breakpoint. The market scopes every number
 * on the page, so it reads as the page's subject line rather than as a filter
 * tag. Fills whatever the caller gives it: phones hand it the whole line, wider
 * windows only its label's worth — stretched edge to edge on a desktop window a
 * bar stops reading as a control.
 */
function MarketBarTrigger({
  market,
  markets,
  label,
  onPress,
}: {
  market: IBorrowMarketItem | null;
  markets: IBorrowMarketItem[];
  label: string;
  onPress?: ISelectRenderTriggerProps['onPress'];
}) {
  return (
    <XStack
      ai="center"
      gap="$3"
      bg="$bgSubdued"
      borderRadius="$3"
      borderCurve="continuous"
      px="$4"
      py="$3"
      $gtMd={{ px: '$5' }}
      onPress={onPress}
      cursor="pointer"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
    >
      <MarketLogoStack market={market} markets={markets} />
      <SizableText size="$headingLg" numberOfLines={1} minWidth={0} flex={1}>
        {label}
      </SizableText>
      <Icon
        flexShrink={0}
        name="ChevronDownSmallOutline"
        size="$5"
        color="$iconSubdued"
      />
    </XStack>
  );
}

export const Markets = () => {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const { market, markets, rememberMarket, borrowDataStatus } =
    useBorrowContext();
  const { requestedMarket, setRequestedMarket } =
    useBorrowMarketRequestContext();
  const selectedMarket = market ?? markets[0] ?? null;
  const selectedMarketKey = selectedMarket
    ? buildBorrowMarketKey(selectedMarket)
    : undefined;
  const requestedMarketKey = requestedMarket
    ? buildBorrowMarketKey(requestedMarket)
    : undefined;

  const marketItems = useMemo(
    () =>
      markets.map((item) => ({
        label: getBorrowMarketLabel(item),
        value: buildBorrowMarketKey(item),
        leading: <MarketLogo market={item} size="sm" />,
      })),
    [markets],
  );

  const selectionRef = useRef({
    markets,
    rememberMarket,
    requestedMarket,
    selectedMarketKey,
    setRequestedMarket,
  });
  const requestedImagePrewarmCancelRef = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      requestedImagePrewarmCancelRef.current?.();
    },
    [],
  );

  useEffect(() => {
    if (!selectedMarket) {
      return undefined;
    }
    return prewarmBorrowImages(
      getBorrowMarketIconSources(selectedMarket, 'md'),
      {
        priority: true,
      },
    );
  }, [
    selectedMarket?.logoURI,
    selectedMarket?.network.logoURI,
    selectedMarket,
  ]);

  useEffect(() => {
    if (borrowDataStatus !== EBorrowDataStatus.Ready) {
      return undefined;
    }
    return prewarmBorrowImages(
      markets.flatMap((item) => [
        ...getBorrowMarketIconSources(item, 'sm'),
        ...getBorrowMarketIconSources(item, 'md'),
      ]),
    );
  }, [borrowDataStatus, markets]);
  useLayoutEffect(() => {
    selectionRef.current = {
      markets,
      rememberMarket,
      requestedMarket,
      selectedMarketKey,
      setRequestedMarket,
    };
  }, [
    markets,
    rememberMarket,
    requestedMarket,
    selectedMarketKey,
    setRequestedMarket,
  ]);

  // Select can retain its content callback while open or closing. A pending
  // market can finish publishing before another choice reaches this handler.
  const handleMarketChange = useCallback(
    (value: string | number | boolean | undefined) => {
      const current = selectionRef.current;
      if (typeof value !== 'string') {
        return;
      }
      const nextMarket = current.markets.find(
        (item) => buildBorrowMarketKey(item) === value,
      );
      if (!nextMarket) {
        return;
      }

      if (value === current.selectedMarketKey) {
        if (current.requestedMarket) {
          requestedImagePrewarmCancelRef.current?.();
          requestedImagePrewarmCancelRef.current = null;
          current.rememberMarket(nextMarket);
          current.setRequestedMarket(null);
        }
        return;
      }

      requestedImagePrewarmCancelRef.current?.();
      requestedImagePrewarmCancelRef.current = prewarmBorrowImages(
        getBorrowMarketIconSources(nextMarket, 'md'),
        { priority: true },
      );
      current.rememberMarket(nextMarket);
      current.setRequestedMarket(nextMarket);
    },
    [],
  );

  const label = selectedMarket ? getBorrowMarketLabel(selectedMarket) : '';

  if (markets.length <= 1) {
    return <MarketIdentity market={selectedMarket} label={label} />;
  }

  // Select wraps the trigger in stacks of its own that carry the press handler,
  // so the width has to be settled here: left to stretch, they would hand a
  // desktop window a full-width invisible hit target beside the bar.
  return (
    <YStack alignSelf={gtMd ? 'flex-start' : 'stretch'} maxWidth="100%">
      <Select
        testID={BorrowTestIDs.marketSelect}
        waitForChangeBeforeClose
        title={intl.formatMessage({ id: ETranslations.global_market })}
        items={marketItems}
        value={requestedMarketKey ?? selectedMarketKey}
        onChange={handleMarketChange}
        renderTrigger={({ onPress }) => (
          <MarketBarTrigger
            market={selectedMarket}
            markets={markets}
            label={label}
            onPress={onPress}
          />
        )}
      />
    </YStack>
  );
};
