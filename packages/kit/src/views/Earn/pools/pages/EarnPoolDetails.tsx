import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useRoute } from '@react-navigation/core';

import {
  Alert,
  Button,
  IconButton,
  Page,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useMedia,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar/NetworkAvatar';
import { StockPriceLineChart } from '@onekeyhq/kit/src/components/StockPriceLineChart';
import type { IStockPriceLineChartHoverPoint } from '@onekeyhq/kit/src/components/StockPriceLineChart';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETabEarnRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import type { ITabEarnParamList } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  PoolsBigNumber,
  getPoolFeeApr,
  toDisplayPrice,
} from '@onekeyhq/shared/src/utils/poolsMath';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';
import {
  EPoolListingStatus,
  EPoolPositionStatus,
} from '@onekeyhq/shared/types/pools';
import type {
  IPool,
  IPoolPositionView,
  IPoolPriceRange,
} from '@onekeyhq/shared/types/pools';

import { EarnPageContainer } from '../../components/EarnPageContainer';
import { EarnProviderMirror } from '../../EarnProviderMirror';
import { PoolLiquidityChart } from '../components/PoolLiquidityChart';
import { PoolPairIcon } from '../components/PoolPairIcon';
import { PoolPositionCard } from '../components/PoolPositionCard';
import { PoolTags } from '../components/PoolTags';
import { PoolTokenSplit } from '../components/PoolTokenSplit';
import { POOLS_COPY } from '../poolsCopy';
import {
  formatCompactUsd,
  formatFeeTier,
  formatPercent,
  formatTokenPrice,
  getPoolDisplayPrice,
  getPoolPair,
  getPoolPairTitle,
  getPoolProtocolLabel,
} from '../poolsFormat';
import { usePoolsBreadcrumb } from '../usePoolsBreadcrumb';

import type { IPoolChartPosition } from '../components/PoolLiquidityChart';
import type { RouteProp } from '@react-navigation/core';

export function PoolsCard({
  title,
  right,
  children,
  testID,
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  testID?: string;
}) {
  return (
    <YStack testID={testID} p="$5" gap="$4" borderRadius="$4" bg="$bgSubdued">
      {title || right ? (
        <XStack ai="center" jc="space-between" gap="$2">
          {title ? <SizableText size="$headingMd">{title}</SizableText> : null}
          {right}
        </XStack>
      ) : null}
      {children}
    </YStack>
  );
}

function Metric({
  label,
  value,
  hero,
}: {
  label: string;
  value: string;
  hero?: boolean;
}) {
  return (
    <YStack gap="$1" minWidth={hero ? 140 : 110}>
      <SizableText size="$bodyMd" color="$textSubdued">
        {label}
      </SizableText>
      <SizableText size={hero ? '$heading3xl' : '$headingLg'}>
        {value}
      </SizableText>
    </YStack>
  );
}

export function PoolHeader({
  pool,
  status,
}: {
  pool: IPool;
  /** A position's status, after the network */
  status?: ReactNode;
}) {
  const { result: network } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceNetwork.getNetworkSafe({
        networkId: pool.networkId,
      }),
    [pool.networkId],
  );
  return (
    <XStack ai="center" gap="$4">
      <PoolPairIcon pool={pool} size="lg" />
      <YStack gap="$1.5" flex={1} minWidth={0}>
        <SizableText size="$heading2xl" numberOfLines={1}>
          {getPoolPairTitle(pool)}
        </SizableText>
        <XStack ai="center" gap="$3" flexWrap="wrap">
          <PoolTags pool={pool} />
          <XStack ai="center" gap="$1.5">
            <NetworkAvatar networkId={pool.networkId} size="$4" />
            <SizableText size="$bodyMd" color="$textSubdued">
              {network?.name ?? ''}
            </SizableText>
          </XStack>
          {status}
        </XStack>
      </YStack>
    </XStack>
  );
}

function PoolMetrics({ pool }: { pool: IPool }) {
  const apr = getPoolFeeApr({
    fees24hUsd: pool.fees24hUsd,
    tvlUsd: pool.tvlUsd,
  });
  return (
    <YStack gap="$5">
      <XStack gap="$8" flexWrap="wrap">
        <Metric hero label={POOLS_COPY.poolApr} value={formatPercent(apr)} />
        <Metric
          hero
          label={POOLS_COPY.tvl}
          value={formatCompactUsd(pool.tvlUsd)}
        />
      </XStack>
      <XStack gap="$8" flexWrap="wrap">
        <Metric
          label={POOLS_COPY.volume24h}
          value={formatCompactUsd(pool.volume24hUsd)}
        />
        <Metric
          label={POOLS_COPY.fees24h}
          value={formatCompactUsd(pool.fees24hUsd)}
        />
        {pool.isDynamicFee ? (
          <Metric
            label={POOLS_COPY.currentFee}
            value={formatFeeTier(pool.feeTier)}
          />
        ) : null}
      </XStack>
    </YStack>
  );
}

function PoolHookCard({ pool }: { pool: IPool }) {
  if (!pool.hook) {
    return null;
  }
  return (
    <PoolsCard title={`${POOLS_COPY.hook}: ${pool.hook.name}`}>
      <SizableText size="$bodyMd" color="$textSubdued">
        {pool.hook.description}
      </SizableText>
      <XStack jc="space-between" ai="center">
        <SizableText size="$bodyMd" color="$textSubdued">
          {POOLS_COPY.hookAddress}
        </SizableText>
        <SizableText size="$bodyMdMedium">
          {accountUtils.shortenAddress({ address: pool.hook.address })}
        </SizableText>
      </XStack>
    </PoolsCard>
  );
}

const PRICE_RANGES: IPoolPriceRange[] = ['1D', '1W', '1M', '1Y'];

// A pool's price is one token in the other, not dollars
const formatAxisPrice = (price: number) => formatTokenPrice(price);

/** Market's stock chart (StockSimpleChart), on the pool's price */
function PoolPriceCard({ pool }: { pool: IPool }) {
  const { gtMd } = useMedia();
  const [flipped, setFlipped] = useState(false);
  const [range, setRange] = useState<IPoolPriceRange>('1M');
  const [hover, setHover] = useState<IStockPriceLineChartHoverPoint>();
  const { base, quote, inverted } = getPoolPair(pool);
  const shownBase = flipped ? quote : base;
  const shownQuote = flipped ? base : quote;
  const { result: history } = usePromiseResult(
    () =>
      backgroundApiProxy.servicePools.getPoolPriceHistory({
        poolId: pool.id,
        range,
      }),
    [pool.id, range],
  );
  const data = useMemo<IMarketTokenChart>(
    () =>
      (history ?? []).map((point) => [
        Math.round(point.time / 1000),
        toDisplayPrice(
          new PoolsBigNumber(point.price),
          flipped ? !inverted : inverted,
        ).toNumber(),
      ]),
    [flipped, history, inverted],
  );
  // The header follows the cursor, like Market's
  const shownPrice =
    hover?.price ?? getPoolDisplayPrice(pool, flipped).toNumber();
  const first = data[0]?.[1];
  const change = first ? shownPrice / first - 1 : 0;
  const chartHeight = gtMd ? 240 : 200;

  return (
    <PoolsCard
      title={POOLS_COPY.price}
      right={
        <IconButton
          testID="earn-pool-price-flip"
          size="small"
          variant="tertiary"
          icon="SwitchHorOutline"
          onPress={() => setFlipped((value) => !value)}
        />
      }
    >
      <YStack gap="$1">
        <XStack ai="baseline" gap="$2" flexWrap="wrap">
          <SizableText size="$heading2xl">
            {formatTokenPrice(shownPrice)}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            {POOLS_COPY.priceIn(shownQuote.symbol, shownBase.symbol)}
          </SizableText>
        </XStack>
        <XStack ai="center" gap="$1.5">
          <SizableText
            size="$bodyMdMedium"
            color={change >= 0 ? '$textSuccess' : '$textCritical'}
          >
            {`${change >= 0 ? '+' : ''}${(change * 100).toFixed(2)}%`}
          </SizableText>
          {hover ? null : (
            <SizableText size="$bodyMd" color="$textSubdued">
              {POOLS_COPY.priceChangeOver[range]}
            </SizableText>
          )}
        </XStack>
      </YStack>
      {/* Market's period row (MobileSimpleChart) */}
      <XStack gap="$1" ai="center">
        {PRICE_RANGES.map((item) => (
          <Button
            key={item}
            testID={`earn-pool-price-range-${item}`}
            size="small"
            variant={range === item ? 'secondary' : 'tertiary'}
            minWidth={42}
            height={30}
            m="$0"
            px="$2.5"
            borderWidth={0}
            borderRadius="$full"
            onPress={() => setRange(item)}
          >
            {item}
          </Button>
        ))}
      </XStack>
      {data.length ? (
        <StockPriceLineChart
          testID="earn-pool-price-chart"
          data={data}
          height={chartHeight}
          pulseLastPoint
          showCurrentPriceLabel
          hoverLabelShowsPrice={false}
          priceAxisFormatter={formatAxisPrice}
          onHoverChange={setHover}
        />
      ) : (
        <Skeleton w="100%" h={chartHeight} borderRadius="$3" />
      )}
    </PoolsCard>
  );
}

function PoolCompositionCard({ pool }: { pool: IPool }) {
  return (
    <PoolsCard title={POOLS_COPY.inPool}>
      <PoolTokenSplit
        pool={pool}
        amount0={pool.reserve0}
        amount1={pool.reserve1}
      />
    </PoolsCard>
  );
}

function SamePairCard({
  pools,
  onOpen,
}: {
  pools: IPool[];
  onOpen: (pool: IPool) => void;
}) {
  if (!pools.length) {
    return null;
  }
  return (
    <PoolsCard title={POOLS_COPY.samePair}>
      {pools.map((pool) => (
        <XStack
          key={pool.id}
          role="button"
          ai="center"
          gap="$3"
          py="$1"
          cursor="pointer"
          pressStyle={{ opacity: 0.6 }}
          onPress={() => onOpen(pool)}
        >
          <YStack flex={1} gap="$1">
            <SizableText size="$bodyMdMedium">
              {getPoolProtocolLabel(pool)}
            </SizableText>
            <PoolTags pool={pool} hideVersion />
          </YStack>
          <YStack ai="flex-end" gap="$0.5">
            <SizableText size="$bodyMdMedium">
              {`${formatPercent(
                getPoolFeeApr({
                  fees24hUsd: pool.fees24hUsd,
                  tvlUsd: pool.tvlUsd,
                }),
              )} ${POOLS_COPY.apr}`}
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued">
              {`${formatCompactUsd(pool.tvlUsd)} ${POOLS_COPY.tvl}`}
            </SizableText>
          </YStack>
        </XStack>
      ))}
    </PoolsCard>
  );
}

function MyPositionsCard({
  positions,
  onOpen,
}: {
  positions: IPoolPositionView[];
  onOpen: (view: IPoolPositionView) => void;
}) {
  if (!positions.length) {
    return null;
  }
  return (
    <YStack gap="$3">
      <SizableText size="$headingMd">{POOLS_COPY.myPositions}</SizableText>
      {positions.map((view) => (
        <PoolPositionCard
          key={view.position.id}
          view={view}
          testID={`earn-pool-position-${view.position.id}`}
          onPress={() => onOpen(view)}
        />
      ))}
    </YStack>
  );
}

function PoolDetailsSkeleton() {
  return (
    <YStack px="$pagePadding" gap="$5" py="$4">
      <XStack gap="$4" ai="center">
        <Skeleton w="$20" h="$12" borderRadius="$full" />
        <YStack gap="$2">
          <Skeleton w="$40" h="$7" />
          <Skeleton w="$32" h="$4" />
        </YStack>
      </XStack>
      <Skeleton w="100%" h={120} borderRadius="$4" />
      <Skeleton w="100%" h={220} borderRadius="$4" />
    </YStack>
  );
}

function EarnPoolDetailsContent({ poolId }: { poolId: string }) {
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const tabBarHeight = useScrollContentTabBarOffset();

  const { result: detail } = usePromiseResult(
    () => backgroundApiProxy.servicePools.getPoolDetail({ poolId }),
    [poolId],
  );
  const { result: portfolio } = usePromiseResult(
    () => backgroundApiProxy.servicePools.getPortfolio(),
    [],
    { revalidateOnFocus: true },
  );
  const myPositions = useMemo(
    () => portfolio?.positions.filter((view) => view.pool.id === poolId) ?? [],
    [poolId, portfolio?.positions],
  );
  // Open range positions, drawn into the liquidity bars
  const chartPositions = useMemo<IPoolChartPosition[]>(
    () =>
      myPositions.flatMap(({ position, status, valueUsd }) =>
        status !== EPoolPositionStatus.Closed &&
        position.tickLower !== undefined &&
        position.tickUpper !== undefined
          ? [
              {
                id: position.id,
                tickLower: position.tickLower,
                tickUpper: position.tickUpper,
                inRange: status === EPoolPositionStatus.Active,
                valueUsd,
              },
            ]
          : [],
      ),
    [myPositions],
  );

  const pool = detail?.pool;
  const canAdd = pool?.listingStatus === EPoolListingStatus.Listed;
  const openAdd = () =>
    navigation.push(ETabEarnRoutes.EarnPoolAddLiquidity, { poolId });
  const openPosition = (view: IPoolPositionView) =>
    navigation.push(ETabEarnRoutes.EarnPoolPosition, {
      positionId: view.position.id,
    });
  const openPool = (other: IPool) =>
    navigation.push(ETabEarnRoutes.EarnPoolDetails, { poolId: other.id });

  const pageTitle = (
    <SizableText size="$headingLg" numberOfLines={1}>
      {pool ? getPoolPairTitle(pool) : POOLS_COPY.pool}
    </SizableText>
  );

  const breadcrumbProps = usePoolsBreadcrumb(
    pool ? [{ label: getPoolPairTitle(pool) }] : [],
  );

  const footer =
    !gtMd && canAdd ? (
      <Page.Footer
        onConfirmText={POOLS_COPY.addLiquidity}
        confirmButtonProps={{
          variant: 'primary',
          onPress: openAdd,
          mb: tabBarHeight,
          testID: 'earn-pool-add-liquidity',
        }}
      />
    ) : null;

  // Distinct keys: the loaded page mounts with its footer, since a footer
  // added to a mounted page updates the page while rendering
  if (!detail || !pool) {
    return (
      <EarnPageContainer
        key="loading"
        pageTitle={pageTitle}
        breadcrumbProps={breadcrumbProps}
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.Earn}
        showBackButton
      >
        <PoolDetailsSkeleton />
      </EarnPageContainer>
    );
  }

  const leftColumn = (
    <YStack gap="$5">
      <PoolMetrics pool={pool} />
      {pool.listingStatus === EPoolListingStatus.Unlisted ? (
        <Alert type="warning" title={POOLS_COPY.unlistedNotice} />
      ) : null}
      <PoolHookCard pool={pool} />
      <PoolPriceCard pool={pool} />
      {pool.capabilities.priceRange ? (
        <PoolsCard title={POOLS_COPY.liquidity}>
          <PoolLiquidityChart
            pool={pool}
            ticks={detail.ticks}
            positions={chartPositions}
            height={gtMd ? 180 : 140}
            bucketCount={gtMd ? 72 : 48}
          />
        </PoolsCard>
      ) : null}
      <PoolCompositionCard pool={pool} />
    </YStack>
  );

  const sideColumn = (
    <YStack gap="$5">
      {gtMd && canAdd ? (
        <Button
          testID="earn-pool-add-liquidity"
          variant="primary"
          size="large"
          onPress={openAdd}
        >
          {POOLS_COPY.addLiquidity}
        </Button>
      ) : null}
      <MyPositionsCard positions={myPositions} onOpen={openPosition} />
      <SamePairCard pools={detail.pairPools} onOpen={openPool} />
    </YStack>
  );

  return (
    <EarnPageContainer
      key="loaded"
      pageTitle={pageTitle}
      breadcrumbProps={breadcrumbProps}
      sceneName={EAccountSelectorSceneName.home}
      tabRoute={ETabRoutes.Earn}
      showBackButton
      footer={footer}
      contentContainerStyle={{ pb: gtMd ? '$10' : '$24' }}
    >
      <YStack px="$pagePadding" gap="$6" pt={gtMd ? '$0' : '$4'}>
        <PoolHeader pool={pool} />
        {gtMd ? (
          <XStack gap="$6" ai="flex-start">
            <YStack flex={65} flexBasis={0} minWidth={0}>
              {leftColumn}
            </YStack>
            <YStack flex={35} flexBasis={0} minWidth={0}>
              {sideColumn}
            </YStack>
          </XStack>
        ) : (
          <YStack gap="$5">
            {leftColumn}
            {sideColumn}
          </YStack>
        )}
      </YStack>
    </EarnPageContainer>
  );
}

type IRouteProps = RouteProp<ITabEarnParamList, ETabEarnRoutes.EarnPoolDetails>;

export default function EarnPoolDetails() {
  const route = useRoute<IRouteProps>();
  return (
    <AccountSelectorProviderMirror
      config={{ sceneName: EAccountSelectorSceneName.home, sceneUrl: '' }}
      enabledNum={[0]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <EarnPoolDetailsContent poolId={route.params.poolId} />
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
