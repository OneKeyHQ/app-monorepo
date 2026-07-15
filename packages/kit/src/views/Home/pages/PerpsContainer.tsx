import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Button,
  DashText,
  Icon,
  Image,
  NumberSizeableText,
  SizableText,
  Skeleton,
  Stack,
  Tabs,
  XStack,
  YStack,
  rootNavigationRef,
  useMedia,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import type { ISizableTextProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  LeverageBadge,
  SubtitleText,
} from '@onekeyhq/kit/src/views/Market/components/PerpsBadges';
import { useNavigateToMarketTab } from '@onekeyhq/kit/src/views/Market/hooks';
import { useMarketPerpsTokenList } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketPerpsList/hooks/useMarketPerpsTokenList';
import { useShowDepositWithdrawModal } from '@onekeyhq/kit/src/views/Perp/hooks/useShowDepositWithdrawModal';
import { getTradingButtonStyleValues } from '@onekeyhq/kit/src/views/Perp/utils/styleUtils';
import {
  perpsPendingInfoPanelTabAtom,
  spotActiveAssetAtom,
  tradingModeAtom,
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ERootRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';
import {
  type INumberFormatProps,
  numberFormat,
} from '@onekeyhq/shared/src/utils/numberUtils';
import type {
  IPerpsHomeHolding,
  IPerpsHomePosition,
} from '@onekeyhq/shared/src/utils/perpsHomeViewUtils';
import {
  formatPriceToSignificantDigits,
  getHyperliquidTokenImageUrl,
  getValidPriceDecimals,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';

import { convertFiat } from '../../../utils/fiatConvert';
import {
  OVERVIEW_TILE_SHADOW,
  buildOverviewGridStyle,
} from '../components/DeFiListBlock/DeFiOverviewLayout';
import { resolveOverviewCols } from '../components/DeFiListBlock/overviewColsResolver';
import {
  HOME_PERPS_GUIDE_URL,
  HOME_PERPS_HOT_REQUEST_CATEGORY_ID,
} from '../components/PopularTrading/constants';
import { PullToRefresh, onHomePageRefresh } from '../components/PullToRefresh';
import { RichBlock } from '../components/RichBlock';
import { SupportHub } from '../components/SupportHub/SupportHub';
import { Upgrade } from '../components/Upgrade/Upgrade';
import { HomeTestIDs } from '../testIDs';

import { usePerpsHomePortfolio } from './usePerpsHomePortfolio';

const HYPER_EVM_LOGO_URI =
  'https://uni.onekey-asset.com/static/chain/hyper-evm.png';
const SPAN_1: React.CSSProperties = { gridColumnEnd: 'span 1' };
const HOT_MARKETS_DESKTOP_GRID: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 160px 160px 180px',
  columnGap: 24,
  alignItems: 'center',
  width: '100%',
};
const noop = () => undefined;
type IPerpsTradeMode = 'perp' | 'spot';
type IPerpsInfoPanelTab = 'Positions' | 'Balances';
const VALUE_FORMATTER: INumberFormatProps['formatter'] = 'value';
const VALUE_FORMATTER_OPTIONS: INumberFormatProps['formatterOptions'] = {
  currency: '$',
};

function isTradableSpotHolding(holding: IPerpsHomeHolding) {
  return Boolean(
    holding.symbol.toUpperCase() !== 'USDC' && holding.spotUniverseName,
  );
}

function useEnsureHomePerpsAccount() {
  const {
    activeAccount: { account, indexedAccount, wallet },
  } = useActiveAccount({ num: 0 });

  return useCallback(async () => {
    if (!account?.id && !indexedAccount?.id) {
      return undefined;
    }
    const deriveType =
      await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
        networkId: PERPS_NETWORK_ID,
      });
    return backgroundApiProxy.serviceHyperliquid.changeActivePerpsAccount({
      indexedAccountId: indexedAccount?.id ?? null,
      accountId: account?.id ?? null,
      walletId: wallet?.id ?? null,
      deriveType: deriveType ?? 'default',
    });
  }, [account?.id, indexedAccount?.id, wallet?.id]);
}

// Jump into the Perps tab (optionally focusing a coin), mirroring UniversalSearchPerpItem.
function useOpenPerpAsset() {
  const navigation = useAppNavigation();
  const ensureHomePerpsAccount = useEnsureHomePerpsAccount();
  return useCallback(
    (
      coin?: string,
      mode: IPerpsTradeMode = 'perp',
      openMarket = true,
      infoPanelTab?: IPerpsInfoPanelTab,
    ) => {
      void (async () => {
        const activePerpsAccount = await ensureHomePerpsAccount();
        if (!activePerpsAccount) {
          return;
        }
        if (coin && !activePerpsAccount?.accountAddress) {
          return;
        }
        try {
          if (coin && mode === 'perp') {
            await backgroundApiProxy.serviceHyperliquid.changeActiveAsset({
              coin,
            });
            await tradingModeAtom.set('perp');
          } else if (coin && mode === 'spot') {
            await spotActiveAssetAtom.set({
              coin,
              assetId: undefined,
              universe: undefined,
            });
            await tradingModeAtom.set('spot');
          }
        } catch {
          return;
        }
        if (infoPanelTab) {
          await perpsPendingInfoPanelTabAtom.set(infoPanelTab);
        }
        navigation.switchTab(ETabRoutes.Perp);
        if (!coin) {
          return;
        }
        try {
          appEventBus.emit(EAppEventBusNames.PerpSwitchActiveInstrument, {
            mode,
            coin,
          });
          if (infoPanelTab) {
            setTimeout(() => {
              appEventBus.emit(EAppEventBusNames.PerpSwitchInfoPanelTab, {
                tab: infoPanelTab,
              });
            }, 0);
          }
        } catch {
          return;
        }
        if (platformEnv.isNative && openMarket) {
          // The Home navigator can't push into the Perp tab's stack, so go via the root.
          setTimeout(() => {
            rootNavigationRef.current?.navigate(ERootRoutes.Main, {
              screen: ETabRoutes.Perp,
              params: { screen: EModalPerpRoutes.MobilePerpMarket },
            });
          }, 500);
        }
      })();
    },
    [ensureHomePerpsAccount, navigation],
  );
}

function PerpsUsd({
  value,
  ...rest
}: { value: number | undefined } & Omit<ISizableTextProps, 'children'>) {
  if (value === undefined) {
    return <SizableText {...rest}>--</SizableText>;
  }
  return (
    <NumberSizeableText
      formatter="value"
      formatterOptions={{ currency: '$' }}
      {...rest}
    >
      {value}
    </NumberSizeableText>
  );
}

function PerpsTotalUsd({
  value,
  isDegraded,
  ...rest
}: {
  value: number | undefined;
  isDegraded?: boolean;
} & Omit<ISizableTextProps, 'children'>) {
  const [settings] = useSettingsPersistAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const displayValue =
    value === undefined
      ? undefined
      : convertFiat({
          value,
          sourceCurrency: USD_CURRENCY_ID,
          targetCurrency: settings.currencyInfo.id,
          currencyMap,
        });
  if (!isDegraded) {
    return (
      <NumberSizeableText
        formatter="value"
        formatterOptions={{ currency: settings.currencyInfo.symbol }}
        {...rest}
      >
        {displayValue}
      </NumberSizeableText>
    );
  }
  return (
    <XStack minWidth={0} alignItems="baseline" gap="$0.5">
      <SizableText size={rest.size} color={rest.color ?? '$textSubdued'}>
        ≈
      </SizableText>
      <NumberSizeableText
        formatter="value"
        formatterOptions={{ currency: settings.currencyInfo.symbol }}
        {...rest}
      >
        {displayValue}
      </NumberSizeableText>
    </XStack>
  );
}

// formatValue collapses every negative to "< $0.01", so format the magnitude and
// carry the sign via a currency prefix + color (mirrors PositionsRow's pnl).
function PerpsSignedUsd({
  value,
  ...rest
}: { value: number | undefined } & Omit<
  ISizableTextProps,
  'children' | 'color'
>) {
  if (value === undefined) {
    return (
      <SizableText color="$textSubdued" {...rest}>
        --
      </SizableText>
    );
  }
  const negative = value < 0;
  return (
    <NumberSizeableText
      formatter="value"
      formatterOptions={{ currency: negative ? '-$' : '+$' }}
      color={negative ? '$red11' : '$green11'}
      {...rest}
    >
      {new BigNumber(value).abs().toFixed()}
    </NumberSizeableText>
  );
}

function PerpsHoldingCard({
  holding,
  hyperEvmLogoUri,
  onPress,
}: {
  holding: IPerpsHomeHolding;
  hyperEvmLogoUri: string;
  onPress?: () => void;
}) {
  const isPressable = Boolean(onPress);
  return (
    <XStack
      flex={1}
      bg="$bgSubdued"
      borderRadius="$3"
      px="$3"
      py="$2.5"
      alignItems="center"
      gap="$2.5"
      cursor={isPressable ? 'pointer' : 'default'}
      focusable={isPressable}
      focusVisibleStyle={{
        outlineColor: '$focusRing',
        outlineStyle: 'solid',
        outlineWidth: 2,
      }}
      hoverStyle={isPressable ? { bg: '$bgHover' } : undefined}
      pressStyle={isPressable ? { bg: '$bgActive' } : undefined}
      $platform-web={{ boxShadow: OVERVIEW_TILE_SHADOW }}
      $platform-native={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$borderSubdued',
      }}
      onPress={onPress ?? noop}
      role={isPressable ? 'button' : undefined}
    >
      <Stack
        width={36}
        height={36}
        flexShrink={0}
        alignItems="center"
        justifyContent="center"
      >
        <Stack
          width={32}
          height={32}
          borderRadius="$full"
          bg="$bgApp"
          alignItems="center"
          justifyContent="center"
          position="relative"
        >
          <Token
            size="md"
            tokenImageUri={getHyperliquidTokenImageUrl(holding.symbol)}
          />
          <Stack
            position="absolute"
            right="$-1"
            bottom="$-1"
            p="$0.5"
            bg="$bgApp"
            borderRadius="$full"
          >
            <Image
              source={{ uri: hyperEvmLogoUri }}
              w="$3.5"
              h="$3.5"
              borderRadius="$full"
            />
          </Stack>
        </Stack>
      </Stack>
      <YStack flex={1} minWidth={0} gap="$1">
        <SizableText
          size="$bodyMd"
          color="$textSubdued"
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {holding.displaySymbol}
        </SizableText>
        <PerpsUsd
          value={holding.valueUsd}
          size="$bodyLgMedium"
          color="$text"
          numberOfLines={1}
        />
      </YStack>
    </XStack>
  );
}

function PerpsHoldingsBlock({
  holdings,
  hyperEvmLogoUri,
}: {
  holdings: IPerpsHomeHolding[];
  hyperEvmLogoUri: string;
}) {
  const media = useMedia();
  const openPerp = useOpenPerpAsset();
  const cols = useMemo(
    () =>
      resolveOverviewCols({
        gtXl: media.gtXl,
        gtLg: media.gtLg,
      }),
    [media.gtLg, media.gtXl],
  );

  return (
    <XStack
      width="100%"
      gap="$4"
      rowGap="$5"
      style={buildOverviewGridStyle(cols)}
      py="$2"
    >
      {holdings.map((holding) => (
        <XStack key={holding.symbol} minWidth={0} style={SPAN_1}>
          <PerpsHoldingCard
            holding={holding}
            hyperEvmLogoUri={hyperEvmLogoUri}
            onPress={
              isTradableSpotHolding(holding)
                ? () =>
                    openPerp(
                      holding.spotUniverseName,
                      'spot',
                      false,
                      'Balances',
                    )
                : undefined
            }
          />
        </XStack>
      ))}
    </XStack>
  );
}

function PerpsHoldingsSkeletonBlock() {
  const media = useMedia();
  const cols = useMemo(
    () =>
      resolveOverviewCols({
        gtXl: media.gtXl,
        gtLg: media.gtLg,
      }),
    [media.gtLg, media.gtXl],
  );

  return (
    <XStack
      width="100%"
      gap="$4"
      rowGap="$5"
      style={buildOverviewGridStyle(cols)}
      py="$2"
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <XStack key={index} minWidth={0} style={SPAN_1}>
          <XStack
            bg="$bgSubdued"
            borderRadius="$3"
            px="$3"
            py="$2.5"
            gap="$2.5"
            alignItems="center"
            width="100%"
            minHeight={72}
          >
            <Skeleton w="$8" h="$8" radius="round" />
            <YStack gap="$2" flex={1}>
              <Skeleton.BodyMd />
              <Skeleton.BodyLg />
            </YStack>
          </XStack>
        </XStack>
      ))}
    </XStack>
  );
}

function PerpsPositionSkeletonCard() {
  return (
    <YStack
      py="$4"
      $gtMd={{
        bg: '$bgSubdued',
        borderRadius: '$3',
        px: '$4',
        py: '$4',
      }}
      gap="$4"
    >
      <XStack justifyContent="space-between" alignItems="center">
        <XStack gap="$2" alignItems="center">
          <Skeleton w="$4" h="$4" />
          <Skeleton.BodyLg w={80} />
          <Skeleton.BodySm w={48} />
        </XStack>
        <Skeleton.BodySm w={40} />
      </XStack>
      <XStack justifyContent="space-between">
        <Skeleton.BodyLg w={96} />
        <Skeleton.BodyLg w={72} />
      </XStack>
      <XStack justifyContent="space-between">
        <XStack width={120}>
          <Skeleton.BodyMd w={100} />
        </XStack>
        <XStack flex={1} alignItems="center">
          <Skeleton.BodyMd w={88} />
        </XStack>
        <XStack width={120} alignItems="flex-end">
          <Skeleton.BodyMd w={104} />
        </XStack>
      </XStack>
      <XStack justifyContent="space-between">
        <XStack width={120}>
          <Skeleton.BodyMd w={80} />
        </XStack>
        <XStack flex={1} alignItems="center">
          <Skeleton.BodyMd w={88} />
        </XStack>
        <XStack width={120} alignItems="flex-end">
          <Skeleton.BodyMd w={104} />
        </XStack>
      </XStack>
    </YStack>
  );
}

function PerpsLoadingState() {
  return (
    <>
      <YStack display="flex" $gtMd={{ display: 'none' }} gap="$3" py="$2">
        <XStack alignItems="center" justifyContent="space-between" gap="$4">
          <XStack flex={1} minWidth={0} alignItems="center" gap="$1">
            <Skeleton.HeadingXl w={112} />
          </XStack>
          <Skeleton w={72} h={28} borderRadius="$full" />
        </XStack>
        <YStack gap="$0.5">
          <XStack alignItems="center" gap="$3" pt="$1.5">
            <XStack flexGrow={1} flexBasis={0}>
              <Skeleton.BodySm w={80} />
            </XStack>
            <XStack flexGrow={1} flexBasis={0} justifyContent="flex-end">
              <Skeleton.BodySm w={80} />
            </XStack>
          </XStack>
          {Array.from({ length: 2 }).map((_, index) => (
            <XStack
              key={index}
              py="$2"
              alignItems="center"
              justifyContent="space-between"
              gap="$3"
            >
              <XStack flex={1} minWidth={0} alignItems="center" gap="$3">
                <Skeleton w="$10" h="$10" radius="round" />
                <YStack flex={1} gap="$2">
                  <Skeleton.BodyLg />
                  <Skeleton.BodyMd />
                </YStack>
              </XStack>
              <YStack alignItems="flex-end" gap="$2">
                <Skeleton.BodyLg w={72} />
                <Skeleton.BodyMd w={48} />
              </YStack>
            </XStack>
          ))}
        </YStack>
      </YStack>
      <YStack display="none" $gtMd={{ display: 'flex' }}>
        <RichBlock
          withTitleSeparator
          title={<Skeleton.BodyLg w={120} />}
          subTitle={<Skeleton.HeadingXl w={120} />}
          headerContainerProps={{ px: 0, pb: 0 }}
          headerActions={<Skeleton w={84} h={28} borderRadius="$full" />}
          content={null}
          plainContentContainer
        />
        <PerpsHoldingsSkeletonBlock />
      </YStack>
      <YStack gap="$3">
        {Array.from({ length: 2 }).map((_, index) => (
          <PerpsPositionSkeletonCard key={index} />
        ))}
      </YStack>
    </>
  );
}

function PerpsEmptyRecommendSection() {
  const intl = useIntl();
  const media = useMedia();
  const openPerp = useOpenPerpAsset();
  const navigateToMarketTab = useNavigateToMarketTab();
  const { tokens, isLoading } = useMarketPerpsTokenList({
    selectedCategoryId: HOME_PERPS_HOT_REQUEST_CATEGORY_ID,
  });

  const displayTokens = useMemo(
    () => tokens.slice(0, media.gtMd ? 6 : 5),
    [media.gtMd, tokens],
  );

  if (!isLoading && displayTokens.length === 0) {
    return null;
  }

  return (
    <YStack mt="$6" gap="$3">
      <XStack alignItems="center" justifyContent="space-between" gap="$3">
        <SizableText size="$headingLg" $gtMd={{ size: '$headingLg' }}>
          {intl.formatMessage({
            id: ETranslations.perp_home_hot_markets__title,
          })}
        </SizableText>
        <Button
          display="none"
          $gtMd={{ display: 'flex' }}
          size="small"
          variant="tertiary"
          color="$textSubdued"
          iconAfter="ChevronRightSmallOutline"
          iconProps={{ color: '$iconSubdued' }}
          testID={HomeTestIDs.popularViewMoreBtn}
          onPress={() =>
            navigateToMarketTab({
              tabToSelect: 'perps',
              perpsCategoryToSelect: HOME_PERPS_HOT_REQUEST_CATEGORY_ID,
            })
          }
          cursor="pointer"
        >
          {intl.formatMessage({ id: ETranslations.global_view_more })}
        </Button>
      </XStack>
      <YStack display="none" $gtMd={{ display: 'flex' }}>
        <XStack mx="$-3" px="$3" pb="$2.5">
          <Stack style={HOT_MARKETS_DESKTOP_GRID}>
            <SizableText
              size="$headingXs"
              color="$textSubdued"
              textTransform="uppercase"
            >
              {intl.formatMessage({ id: ETranslations.global_name })}
            </SizableText>
            <SizableText
              size="$headingXs"
              color="$textSubdued"
              textTransform="uppercase"
              textAlign="right"
            >
              {intl.formatMessage({ id: ETranslations.global_price })}
            </SizableText>
            <SizableText
              size="$headingXs"
              color="$textSubdued"
              textTransform="uppercase"
              textAlign="right"
            >
              {`${intl.formatMessage({
                id: ETranslations.dexmarket_token_change,
              })}(%)`}
            </SizableText>
            <SizableText
              size="$headingXs"
              color="$textSubdued"
              textTransform="uppercase"
              textAlign="right"
            >
              {intl.formatMessage({ id: ETranslations.dexmarket_turnover })}
            </SizableText>
          </Stack>
        </XStack>
        {displayTokens.map((token) => (
          <XStack
            key={token.name}
            hoverStyle={{ bg: '$bgHover' }}
            pressStyle={{ bg: '$bgActive' }}
            onPress={() => openPerp(token.name, 'perp', false)}
            cursor="pointer"
            role="button"
            borderRadius="$3"
            mx="$-3"
            px="$3"
            py="$2"
          >
            <Stack style={HOT_MARKETS_DESKTOP_GRID}>
              <XStack alignItems="center" gap="$3" minWidth={0}>
                <Token
                  size="md"
                  borderRadius="$full"
                  tokenImageUri={token.tokenImageUrl}
                  fallbackIcon="CryptoCoinOutline"
                />
                <YStack flex={1} minWidth={0}>
                  <XStack
                    alignItems="center"
                    gap="$1"
                    minWidth={0}
                    overflow="hidden"
                  >
                    <SizableText
                      size="$bodyLgMedium"
                      numberOfLines={1}
                      flexShrink={1}
                      ellipsizeMode="tail"
                      userSelect="none"
                    >
                      {token.displayName}
                    </SizableText>
                    <LeverageBadge leverage={token.maxLeverage} />
                  </XStack>
                  {token.subtitle ? (
                    <SubtitleText subtitle={token.subtitle} />
                  ) : null}
                </YStack>
              </XStack>
              {token.markPrice ? (
                <NumberSizeableText
                  numberOfLines={1}
                  size="$bodyLgMedium"
                  textAlign="right"
                  formatter="price"
                  formatterOptions={{ currency: '$' }}
                >
                  {token.markPrice}
                </NumberSizeableText>
              ) : (
                <SizableText
                  size="$bodyLgMedium"
                  color="$textSubdued"
                  textAlign="right"
                >
                  --
                </SizableText>
              )}
              {token.change24hPercent === undefined ? (
                <SizableText
                  size="$bodyLgMedium"
                  color="$textSubdued"
                  textAlign="right"
                >
                  --
                </SizableText>
              ) : (
                <NumberSizeableText
                  numberOfLines={1}
                  size="$bodyLgMedium"
                  textAlign="right"
                  color={
                    token.change24hPercent >= 0
                      ? '$textSuccess'
                      : '$textCritical'
                  }
                  formatter="priceChange"
                  formatterOptions={{ showPlusMinusSigns: true }}
                >
                  {token.change24hPercent}
                </NumberSizeableText>
              )}
              {token.volume24h ? (
                <NumberSizeableText
                  numberOfLines={1}
                  size="$bodyLgMedium"
                  textAlign="right"
                  formatter="marketCap"
                  formatterOptions={{ currency: '$' }}
                >
                  {token.volume24h}
                </NumberSizeableText>
              ) : (
                <SizableText
                  size="$bodyLgMedium"
                  color="$textSubdued"
                  textAlign="right"
                >
                  --
                </SizableText>
              )}
            </Stack>
          </XStack>
        ))}
      </YStack>
      <YStack display="flex" $gtMd={{ display: 'none' }}>
        {displayTokens.map((token) => {
          const hasChange24hPercent =
            token.change24hPercent !== undefined &&
            token.change24hPercent !== null;
          let change24hPercentColor = '$textSubdued';
          if (hasChange24hPercent) {
            change24hPercentColor =
              token.change24hPercent >= 0 ? '$textSuccess' : '$textCritical';
          }
          return (
            <Stack key={token.name}>
              <XStack
                hoverStyle={{ bg: '$bgHover' }}
                pressStyle={{ bg: '$bgActive' }}
                onPress={() => openPerp(token.name, 'perp', false)}
                cursor="pointer"
                role="button"
                borderRadius="$3"
                mx="$-3"
                px="$3"
                py="$3"
                alignItems="center"
                alignSelf="stretch"
              >
                <XStack flex={1} alignItems="center" gap="$3" minWidth={0}>
                  <Token
                    size="md"
                    borderRadius="$full"
                    tokenImageUri={token.tokenImageUrl}
                    fallbackIcon="CryptoCoinOutline"
                  />
                  <YStack flex={1} minWidth={0}>
                    <XStack
                      alignItems="center"
                      gap="$1"
                      minWidth={0}
                      overflow="hidden"
                    >
                      <SizableText
                        size="$bodyLgMedium"
                        numberOfLines={1}
                        flexShrink={1}
                        ellipsizeMode="tail"
                        userSelect="none"
                      >
                        {token.displayName}
                      </SizableText>
                      <LeverageBadge leverage={token.maxLeverage} />
                    </XStack>
                    <XStack alignItems="center" gap="$1" minWidth={0}>
                      {token.subtitle ? (
                        <SubtitleText subtitle={token.subtitle} />
                      ) : null}
                      <NumberSizeableText
                        size="$bodyMd"
                        color="$textSubdued"
                        numberOfLines={1}
                        flexShrink={0}
                        formatter="marketCap"
                        formatterOptions={{ currency: '$' }}
                        userSelect="none"
                      >
                        {token.volume24h ?? '0'}
                      </NumberSizeableText>
                    </XStack>
                  </YStack>
                </XStack>

                <YStack alignItems="flex-end">
                  <NumberSizeableText
                    userSelect="none"
                    flexShrink={1}
                    numberOfLines={1}
                    size="$bodyLgMedium"
                    formatter="price"
                    formatterOptions={{ currency: '$' }}
                  >
                    {token.markPrice ?? '-'}
                  </NumberSizeableText>
                  <NumberSizeableText
                    size="$bodyMd"
                    color={change24hPercentColor}
                    formatter="priceChange"
                    formatterOptions={{ showPlusMinusSigns: true }}
                  >
                    {token.change24hPercent ?? '-'}
                  </NumberSizeableText>
                </YStack>
              </XStack>
            </Stack>
          );
        })}
        <XStack
          px="$0"
          pt="$2"
          pb="$5"
          width="100%"
          display="flex"
          $gtMd={{ display: 'none' }}
        >
          <Button
            size="medium"
            variant="secondary"
            width="100%"
            cursor="pointer"
            testID={HomeTestIDs.popularViewMoreBtn}
            onPress={() =>
              navigateToMarketTab({
                tabToSelect: 'perps',
                perpsCategoryToSelect: HOME_PERPS_HOT_REQUEST_CATEGORY_ID,
              })
            }
            childrenAsText={false}
          >
            <XStack alignItems="center" gap="$2">
              <SizableText size="$bodyMdMedium">
                {intl.formatMessage({ id: ETranslations.global_view_more })}
              </SizableText>
              <Icon name="ChevronRightSmallOutline" size="$5.5" />
            </XStack>
          </Button>
        </XStack>
      </YStack>
    </YStack>
  );
}

function PerpsDepositButton({
  testID,
  canDeposit,
  isDepositDisabled,
}: {
  testID: string;
  canDeposit: boolean;
  isDepositDisabled: boolean;
}) {
  const intl = useIntl();
  const { showDepositWithdrawModal } = useShowDepositWithdrawModal();
  const ensureHomePerpsAccount = useEnsureHomePerpsAccount();
  const buttonStyles = getTradingButtonStyleValues('long', isDepositDisabled);

  const handleDeposit = useCallback(async () => {
    if (!canDeposit || isDepositDisabled) {
      return;
    }
    const activePerpsAccount = await ensureHomePerpsAccount();
    if (!activePerpsAccount?.accountId || !activePerpsAccount.accountAddress) {
      return;
    }
    await showDepositWithdrawModal('deposit');
  }, [
    canDeposit,
    ensureHomePerpsAccount,
    isDepositDisabled,
    showDepositWithdrawModal,
  ]);

  if (!canDeposit) {
    return null;
  }

  return (
    <Button
      testID={testID}
      size="small"
      variant="primary"
      bg="$bgAccent"
      minHeight={32}
      color={buttonStyles.textColor}
      cursor={isDepositDisabled ? 'default' : 'pointer'}
      disabled={isDepositDisabled}
      hoverStyle={{ bg: '$bgAccentHover' }}
      pressStyle={{ bg: '$bgAccentActive' }}
      onPress={() => void handleDeposit()}
      childrenAsText={false}
    >
      <XStack alignItems="center" gap="$2">
        <Icon
          name="AlignBottomOutline"
          size="$4"
          color={buttonStyles.textColor}
        />
        <SizableText size="$bodyMdMedium" color={buttonStyles.textColor}>
          {intl.formatMessage({ id: ETranslations.perp_trade_deposit })}
        </SizableText>
      </XStack>
    </Button>
  );
}

function PerpsHeaderActions({
  canDeposit,
  isDepositDisabled,
}: {
  canDeposit: boolean;
  isDepositDisabled: boolean;
}) {
  if (!canDeposit) {
    return null;
  }

  return (
    <XStack alignItems="center" gap="$2">
      <PerpsDepositButton
        testID={HomeTestIDs.perpsDesktopDepositButton}
        canDeposit={canDeposit}
        isDepositDisabled={isDepositDisabled}
      />
    </XStack>
  );
}

function PerpsEmptyState({
  canDeposit,
  isDepositDisabled,
}: {
  canDeposit: boolean;
  isDepositDisabled: boolean;
}) {
  const intl = useIntl();

  return (
    <>
      <YStack display="flex" $gtMd={{ display: 'none' }} gap="$3" py="$2">
        <XStack alignItems="center" justifyContent="space-between" gap="$4">
          <XStack flex={1} minWidth={0} alignItems="center" gap="$1">
            <SizableText size="$headingXl" color="$text" numberOfLines={1}>
              {intl.formatMessage({ id: ETranslations.global_perp })}
            </SizableText>
            <SizableText size="$headingXl" color="$textSubdued">
              ·
            </SizableText>
            <SizableText
              size="$headingXl"
              color="$textSubdued"
              numberOfLines={1}
            >
              $0.00
            </SizableText>
          </XStack>
          <PerpsDepositButton
            testID={HomeTestIDs.perpsDepositButton}
            canDeposit={canDeposit}
            isDepositDisabled={isDepositDisabled}
          />
        </XStack>
      </YStack>
      <YStack display="none" $gtMd={{ display: 'flex' }}>
        <RichBlock
          withTitleSeparator
          title={intl.formatMessage({
            id: ETranslations.perp_account_panel_account_value,
          })}
          subTitle="$0.00"
          headerContainerProps={{ px: 0, pb: 0 }}
          headerActions={
            <PerpsHeaderActions
              canDeposit={canDeposit}
              isDepositDisabled={isDepositDisabled}
            />
          }
          content={null}
          plainContentContainer
        />
      </YStack>
    </>
  );
}

function PerpsMobileHoldingRow({
  holding,
  hyperEvmLogoUri,
  onPress,
}: {
  holding: IPerpsHomeHolding;
  hyperEvmLogoUri: string;
  onPress?: () => void;
}) {
  const isPressable = Boolean(onPress);
  return (
    <XStack
      py="$2"
      px="$3"
      mx="$-3"
      borderRadius="$3"
      alignItems="center"
      justifyContent="space-between"
      gap="$3"
      cursor={isPressable ? 'pointer' : 'default'}
      hoverStyle={isPressable ? { bg: '$bgHover' } : undefined}
      pressStyle={isPressable ? { bg: '$bgActive' } : undefined}
      onPress={onPress ?? noop}
      role={isPressable ? 'button' : undefined}
    >
      <XStack
        flexGrow={1}
        flexBasis={0}
        minWidth={0}
        alignItems="center"
        gap="$3"
      >
        <Stack
          width={44}
          height={44}
          flexShrink={0}
          alignItems="center"
          justifyContent="center"
        >
          <Stack
            width={40}
            height={40}
            borderRadius="$full"
            bg="$bgApp"
            alignItems="center"
            justifyContent="center"
            position="relative"
          >
            <Token
              size="lg"
              tokenImageUri={getHyperliquidTokenImageUrl(holding.symbol)}
            />
            <Stack
              position="absolute"
              right="$-1"
              bottom="$-1"
              p="$0.5"
              bg="$bgApp"
              borderRadius="$full"
            >
              <Image
                source={{ uri: hyperEvmLogoUri }}
                w="$3.5"
                h="$3.5"
                borderRadius="$full"
              />
            </Stack>
          </Stack>
        </Stack>
        <YStack flex={1} minWidth={0} gap="$0.5">
          <SizableText size="$bodyLgMedium" numberOfLines={1}>
            {holding.displaySymbol}
          </SizableText>
          <NumberSizeableText
            formatter="balance"
            size="$bodyMd"
            color="$textSubdued"
            numberOfLines={1}
          >
            {holding.balance}
          </NumberSizeableText>
        </YStack>
      </XStack>
      <YStack flexShrink={0} alignItems="flex-end" gap="$0.5">
        <PerpsUsd
          value={holding.valueUsd}
          size="$bodyLgMedium"
          numberOfLines={1}
          textAlign="right"
        />
        <PerpsSignedUsd
          value={holding.pnlUsd}
          size="$bodyMd"
          numberOfLines={1}
          textAlign="right"
        />
      </YStack>
    </XStack>
  );
}

function PerpsMobileHoldingsSummary({
  totalUsd,
  holdings,
  isDegraded,
  canDeposit,
  isDepositDisabled,
}: {
  totalUsd: number;
  holdings: IPerpsHomeHolding[];
  isDegraded?: boolean;
  canDeposit: boolean;
  isDepositDisabled: boolean;
}) {
  const intl = useIntl();
  const media = useMedia();
  const openPerp = useOpenPerpAsset();
  const tooltipText = media.gtMd
    ? undefined
    : intl.formatMessage({
        id: ETranslations.marketdex_un_pnl,
      });
  const tooltipTitle = media.gtMd
    ? undefined
    : intl.formatMessage({
        id: ETranslations.marketdex_unrealized_pnl,
      });

  return (
    <YStack display="flex" $gtMd={{ display: 'none' }} gap="$3" py="$2">
      <XStack alignItems="center" justifyContent="space-between" gap="$4">
        <XStack flex={1} minWidth={0} alignItems="center" gap="$1">
          <SizableText size="$headingXl" color="$text" numberOfLines={1}>
            {intl.formatMessage({ id: ETranslations.global_perp })}
          </SizableText>
          <SizableText size="$headingXl" color="$textSubdued">
            ·
          </SizableText>
          <PerpsTotalUsd
            value={totalUsd}
            isDegraded={isDegraded}
            size="$headingXl"
            color="$textSubdued"
            numberOfLines={1}
          />
        </XStack>
        <PerpsDepositButton
          testID={HomeTestIDs.perpsDepositButton}
          canDeposit={canDeposit}
          isDepositDisabled={isDepositDisabled}
        />
      </XStack>
      <YStack gap="$0.5">
        <XStack alignItems="center" gap="$3" pt="$1.5">
          <XStack flexGrow={1} flexBasis={0} alignItems="center" gap="$1">
            <SizableText size="$bodyXs" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.global_name })}
            </SizableText>
            <SizableText size="$bodyXs" color="$textSubdued">
              /
            </SizableText>
            <SizableText size="$bodyXs" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.global_balance })}
            </SizableText>
          </XStack>
          <XStack
            flexGrow={1}
            flexBasis={0}
            justifyContent="flex-end"
            gap="$1"
            alignItems="center"
          >
            <SizableText size="$bodyXs" color="$textSubdued">
              {`${intl.formatMessage({ id: ETranslations.global_value })} / `}
            </SizableText>
            <DashText
              size="$bodyXs"
              color="$textSubdued"
              dashThickness={0.5}
              tooltip={tooltipText}
              tooltipTitle={tooltipTitle}
            >
              {intl.formatMessage({
                id: ETranslations.perp_position_pnl_mobile,
              })}
            </DashText>
          </XStack>
        </XStack>
        <YStack>
          {holdings.map((holding) => (
            <PerpsMobileHoldingRow
              key={holding.symbol}
              holding={holding}
              hyperEvmLogoUri={HYPER_EVM_LOGO_URI}
              onPress={
                isTradableSpotHolding(holding)
                  ? () =>
                      openPerp(
                        holding.spotUniverseName,
                        'spot',
                        false,
                        'Balances',
                      )
                  : undefined
              }
            />
          ))}
        </YStack>
      </YStack>
    </YStack>
  );
}

function PerpsMetric({
  labelId,
  value,
  formatter,
  formatterOptions,
  align = 'left',
  positive,
  negative,
  labelExtra,
  column,
  emphasis,
}: {
  labelId: ETranslations;
  value: string | number;
  formatter?: INumberFormatProps['formatter'];
  formatterOptions?: INumberFormatProps['formatterOptions'];
  align?: 'left' | 'right';
  positive?: boolean;
  negative?: boolean;
  labelExtra?: string;
  column?: 'left' | 'center' | 'right';
  emphasis?: boolean;
}) {
  const intl = useIntl();
  const alignItems = align === 'right' ? 'flex-end' : 'flex-start';
  let columnFlexGrow = 1;
  let columnGtMdFlexGrow = 1;
  if (column === 'left') {
    columnFlexGrow = 1.35;
    columnGtMdFlexGrow = 1.45;
  } else if (column === 'center') {
    columnFlexGrow = 0.65;
    columnGtMdFlexGrow = 0.55;
  }
  let valueColor = '$text';
  if (positive) {
    valueColor = '$green11';
  } else if (negative) {
    valueColor = '$red11';
  }
  const valueSize = emphasis ? '$bodyLgMedium' : '$bodyMdMedium';
  const valueGtMdSize = emphasis ? '$bodyLgMedium' : '$bodyMdMedium';

  return (
    <YStack
      flexGrow={columnFlexGrow}
      flexBasis={0}
      minWidth={0}
      $gtMd={{ flexGrow: columnGtMdFlexGrow }}
    >
      <XStack width="100%" justifyContent={alignItems}>
        <YStack width="100%" minWidth={0} gap="$1" alignItems={alignItems}>
          <XStack alignItems="center" gap="$1">
            <SizableText
              size="$bodySm"
              color="$textSubdued"
              numberOfLines={1}
              $gtMd={{ size: '$bodySm' }}
            >
              {intl.formatMessage({ id: labelId })}
              {labelExtra}
            </SizableText>
          </XStack>
          {formatter ? (
            <NumberSizeableText
              size={valueSize}
              color={valueColor}
              $gtMd={{ size: valueGtMdSize }}
              formatter={formatter}
              formatterOptions={formatterOptions}
              flexShrink={1}
              minWidth={0}
              numberOfLines={platformEnv.isNative ? 1 : 2}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              contentStyle={{ color: valueColor }}
              decimalTextStyle={{ color: valueColor }}
              subTextStyle={{ color: valueColor }}
            >
              {value}
            </NumberSizeableText>
          ) : (
            <SizableText
              size={valueSize}
              color={valueColor}
              $gtMd={{ size: valueGtMdSize }}
              flexShrink={1}
              minWidth={0}
              numberOfLines={platformEnv.isNative ? 1 : 2}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {value}
            </SizableText>
          )}
        </YStack>
      </XStack>
    </YStack>
  );
}

function PerpsPositionCard({ position }: { position: IPerpsHomePosition }) {
  const intl = useIntl();
  const media = useMedia();
  const openPerp = useOpenPerpAsset();
  const isLong = position.side === 'long';
  const isCardPressable = media.gtMd;
  const assetBadgeBgColor = isLong ? '$bgAccent' : '$bgCriticalStrong';
  const assetBadgeTextColor = isLong ? '$textInverse' : '$textOnColor';
  const handleOpenPerp = useCallback(() => {
    openPerp(position.coin, 'perp', false, 'Positions');
  }, [openPerp, position.coin]);
  const leverageTypeText = intl.formatMessage({
    id:
      position.leverageType === 'cross'
        ? ETranslations.perp_trade_cross
        : ETranslations.perp_trade_isolated,
  });
  const roiPercent = new BigNumber(position.roi).times(100).abs().toFixed(1);
  const displayCoin = parseDexCoin(position.coin).displayName;
  const priceDecimals = useMemo(
    () => getValidPriceDecimals(position.entryPx || '0'),
    [position.entryPx],
  );
  const positionSizeFormatted = useMemo(
    () =>
      numberFormat(position.sizeCoin, {
        formatter: 'balance',
      }),
    [position.sizeCoin],
  );
  const entryPriceFormatted = useMemo(
    () => new BigNumber(position.entryPx || '0').toFixed(priceDecimals),
    [position.entryPx, priceDecimals],
  );
  const liquidationPriceFormatted = useMemo(() => {
    const liquidationPrice = new BigNumber(position.liqPx || '0');
    return liquidationPrice.isZero()
      ? 'N/A'
      : liquidationPrice.toFixed(priceDecimals);
  }, [position.liqPx, priceDecimals]);
  const markPriceFormatted = useMemo(
    () => formatPriceToSignificantDigits(position.markPx || '0'),
    [position.markPx],
  );
  const fundingAmount = useMemo(
    () => new BigNumber(position.fundingUsd).abs().toFixed(2),
    [position.fundingUsd],
  );

  return (
    <YStack
      py="$3"
      cursor={isCardPressable ? 'pointer' : 'default'}
      focusable={isCardPressable}
      role={isCardPressable ? 'button' : undefined}
      hoverStyle={isCardPressable ? { bg: '$bgHover' } : undefined}
      pressStyle={isCardPressable ? { bg: '$bgActive' } : undefined}
      focusVisibleStyle={
        isCardPressable
          ? {
              outlineColor: '$focusRing',
              outlineStyle: 'solid',
              outlineWidth: 2,
            }
          : undefined
      }
      onPress={isCardPressable ? handleOpenPerp : undefined}
      $gtMd={{
        bg: '$bgSubdued',
        borderRadius: '$3',
        px: '$4',
        py: '$4',
      }}
      gap="$3"
    >
      <XStack justifyContent="space-between" flex={1} position="relative">
        <XStack flex={1} gap="$2" alignItems="center">
          <XStack
            bg={assetBadgeBgColor}
            borderRadius={2}
            w="$4"
            h="$4"
            justifyContent="center"
            alignItems="center"
          >
            <SizableText
              size="$bodySmMedium"
              color={assetBadgeTextColor}
              $gtMd={{ size: '$bodyMdMedium' }}
            >
              {intl.formatMessage({
                id: isLong
                  ? ETranslations.perp_position_b
                  : ETranslations.perp_position_s,
              })}
            </SizableText>
          </XStack>
          <SizableText
            size="$bodyMdMedium"
            color="$text"
            $gtMd={{ size: '$headingMd' }}
          >
            {displayCoin}
          </SizableText>
          <SizableText
            bg="$bgSubdued"
            borderRadius={2}
            px="$1"
            color="$textSubdued"
            fontSize={10}
            $gtMd={{ size: '$bodySm' }}
          >
            {leverageTypeText} {position.leverageValue}x
          </SizableText>
        </XStack>
        <SizableText
          testID={HomeTestIDs.perpsManageButton}
          display="none"
          size="$bodySm"
          color="$textSubdued"
          $gtMd={{ display: 'flex', size: '$bodySm' }}
        >
          {intl.formatMessage({ id: ETranslations.global_manage })}
        </SizableText>
      </XStack>

      <YStack gap="$3">
        <XStack width="100%" justifyContent="space-between" alignItems="center">
          <PerpsMetric
            labelId={ETranslations.perp_position_pnl_mobile}
            value={new BigNumber(position.pnlUsd).abs().toFixed()}
            formatter={VALUE_FORMATTER}
            formatterOptions={{
              currency: position.pnlUsd < 0 ? '-$' : '+$',
            }}
            positive={position.pnlUsd >= 0}
            negative={position.pnlUsd < 0}
            emphasis
          />
          <PerpsMetric
            labelId={ETranslations.perp_share_roe}
            value={`${position.roi < 0 ? '-' : '+'}${roiPercent}%`}
            align="right"
            positive={position.roi >= 0}
            negative={position.roi < 0}
            emphasis
          />
        </XStack>

        <YStack gap="$3">
          <XStack width="100%">
            <PerpsMetric
              labelId={ETranslations.perp_position_position_size}
              labelExtra={` (${displayCoin})`}
              value={positionSizeFormatted}
              column="left"
            />
            <PerpsMetric
              labelId={ETranslations.perp_position_margin}
              value={position.marginUsd}
              formatter={VALUE_FORMATTER}
              formatterOptions={VALUE_FORMATTER_OPTIONS}
              column="center"
            />
            <PerpsMetric
              labelId={ETranslations.perp_position_entry_price}
              value={entryPriceFormatted}
              align="right"
              column="right"
            />
          </XStack>

          <XStack width="100%">
            {/* fundingUsd > 0 = paid -> red '-$' (mirrors PositionsRow) */}
            <PerpsMetric
              labelId={ETranslations.perp_position_funding_2}
              value={fundingAmount}
              formatter={VALUE_FORMATTER}
              formatterOptions={{
                currency: position.fundingUsd > 0 ? '-$' : '+$',
              }}
              positive={position.fundingUsd <= 0}
              negative={position.fundingUsd > 0}
              column="left"
            />
            <PerpsMetric
              labelId={ETranslations.perp_position_mark_price}
              value={markPriceFormatted}
              column="center"
            />
            <PerpsMetric
              labelId={ETranslations.perp_position_liq_price}
              value={liquidationPriceFormatted}
              align="right"
              column="right"
            />
          </XStack>
        </YStack>
      </YStack>
      <Button
        testID={HomeTestIDs.perpsManageButton}
        size="small"
        display="flex"
        $gtMd={{ display: 'none' }}
        onPress={handleOpenPerp}
      >
        {intl.formatMessage({ id: ETranslations.global_manage })}
      </Button>
    </YStack>
  );
}

export function PerpsContainer() {
  const intl = useIntl();
  const tabBarHeight = useScrollContentTabBarOffset();
  const { viewState, view, canDeposit, isDepositDisabled } =
    usePerpsHomePortfolio();

  return (
    <Stack flex={1}>
      <Tabs.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tabBarHeight }}
        nestedScrollEnabled={platformEnv.isNativeAndroid}
        refreshControl={
          !platformEnv.isNativeAndroid ? (
            <PullToRefresh onRefresh={onHomePageRefresh} />
          ) : undefined
        }
      >
        <YStack
          px="$5"
          py="$3"
          pb="$4"
          gap="$2"
          $gtMd={{ px: '$pagePadding', pb: '$8' }}
        >
          {viewState === 'loading' ? <PerpsLoadingState /> : null}
          {viewState === 'empty' ? (
            <PerpsEmptyState
              canDeposit={canDeposit}
              isDepositDisabled={isDepositDisabled}
            />
          ) : null}
          {viewState === 'ready' && view ? (
            <>
              <PerpsMobileHoldingsSummary
                totalUsd={view.accountValueUsd}
                holdings={view.holdings}
                isDegraded={view.isDegraded}
                canDeposit={canDeposit}
                isDepositDisabled={isDepositDisabled}
              />
              <YStack display="none" $gtMd={{ display: 'flex' }}>
                <RichBlock
                  withTitleSeparator
                  title={intl.formatMessage({
                    id: ETranslations.perp_account_panel_account_value,
                  })}
                  subTitle={
                    <PerpsTotalUsd
                      value={view.accountValueUsd}
                      isDegraded={view.isDegraded}
                      size="$headingXl"
                      color="$textSubdued"
                    />
                  }
                  headerContainerProps={{ px: 0, pb: 0 }}
                  headerActions={
                    <PerpsHeaderActions
                      canDeposit={canDeposit}
                      isDepositDisabled={isDepositDisabled}
                    />
                  }
                  content={null}
                  plainContentContainer
                />
                <PerpsHoldingsBlock
                  holdings={view.holdings}
                  hyperEvmLogoUri={HYPER_EVM_LOGO_URI}
                />
              </YStack>
              {view.positions.length > 0 ? (
                <YStack gap="$2">
                  {view.positions.map((position) => (
                    <PerpsPositionCard
                      key={`${position.coin}-${position.side}`}
                      position={position}
                    />
                  ))}
                </YStack>
              ) : null}
            </>
          ) : null}
          {viewState !== 'loading' ? (
            <>
              <PerpsEmptyRecommendSection />
              <YStack
                gap="$6"
                mx="$-5"
                $gtMd={{ gap: '$8', mx: '$-pagePadding' }}
              >
                <Upgrade />
                <SupportHub
                  helpCenterTitle={intl.formatMessage({
                    id: ETranslations.perp_guide_title,
                  })}
                  helpCenterLink={HOME_PERPS_GUIDE_URL}
                />
              </YStack>
            </>
          ) : null}
        </YStack>
      </Tabs.ScrollView>
    </Stack>
  );
}
