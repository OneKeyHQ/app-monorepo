import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { useRoute } from '@react-navigation/core';
import { StackActions } from '@react-navigation/native';
import BigNumber from 'bignumber.js';

import {
  Alert,
  Button,
  Empty,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETabEarnRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import type { ITabEarnParamList } from '@onekeyhq/shared/src/routes';
import { formatLocaleDate } from '@onekeyhq/shared/src/utils/dateUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EPoolPositionStatus } from '@onekeyhq/shared/types/pools';
import type {
  IPoolPositionView,
  IPoolTickLiquidityNet,
} from '@onekeyhq/shared/types/pools';

import { EarnPageContainer } from '../../components/EarnPageContainer';
import { EarnProviderMirror } from '../../EarnProviderMirror';
import { PoolHeader } from '../components/PoolHeader';
import { getPoolPairIconWidth } from '../components/PoolPairIcon';
import {
  PoolPositionActionsFooter,
  usePoolPositionActions,
} from '../components/PoolPositionActions';
import {
  PoolPositionStatus,
  describeCurrentApr,
  getFeesEarnedText,
} from '../components/PoolPositionCard';
import { PoolStrataPlot } from '../components/PoolPositionStrata';
import { getRangeDisplay } from '../components/PoolRangeBar';
import { PoolsCard } from '../components/PoolsCard';
import { PoolsDemoMenuButton } from '../components/PoolsDemoMenuButton';
import { PoolTokenDot, PoolTokenSplit } from '../components/PoolTokenSplit';
import { POOLS_COPY } from '../poolsCopy';
import {
  formatPercent,
  formatTokenAmount,
  formatTokenPrice,
  formatUsd,
  getPoolPair,
  getPoolPairTitle,
  getPoolProtocolLabel,
  getPriceUnitLabel,
} from '../poolsFormat';
import { usePoolsBreadcrumb } from '../usePoolsBreadcrumb';

import type { RouteProp } from '@react-navigation/core';

function ValueCard({ view }: { view: IPoolPositionView }) {
  const { gtMd } = useMedia();
  // Auto-compounding pools add fees to the value, so there is nothing apart.
  // Else it shows from the start ($0.00), as on the pool page's card
  const earned = getFeesEarnedText(view);
  const apr = describeCurrentApr(view);
  const value = (
    <YStack gap="$1">
      <SizableText size="$bodyMd" color="$textSubdued">
        {POOLS_COPY.positionValue}
      </SizableText>
      <SizableText size="$heading4xl">{formatUsd(view.valueUsd)}</SizableText>
    </YStack>
  );
  const figures = (
    <>
      {earned ? (
        <YStack gap="$1" pb="$1">
          <SizableText size="$bodyMd" color="$textSubdued">
            {POOLS_COPY.feesEarned}
          </SizableText>
          <SizableText size="$heading2xl" color={earned.color}>
            {earned.value}
          </SizableText>
        </YStack>
      ) : null}
      {apr ? (
        <YStack gap="$1" pb="$1">
          <SizableText size="$bodyMd" color="$textSubdued">
            {POOLS_COPY.currentApr}
          </SizableText>
          <SizableText
            testID="earn-pool-position-current-apr"
            size="$heading2xl"
            color={apr.color}
          >
            {apr.value}
          </SizableText>
        </YStack>
      ) : null}
    </>
  );
  return (
    <PoolsCard>
      {/* Phones keep the value on its own line, the other figures under it */}
      {gtMd ? (
        <XStack gap="$8" ai="flex-end">
          {value}
          {figures}
        </XStack>
      ) : (
        <YStack gap="$4">
          {value}
          <XStack gap="$8" rowGap="$4" flexWrap="wrap">
            {figures}
          </XStack>
        </YStack>
      )}
      {/* A closed position holds nothing; its rows would only read 0 */}
      {view.status !== EPoolPositionStatus.Closed ? (
        <PoolTokenSplit
          pool={view.pool}
          amount0={view.amount0}
          amount1={view.amount1}
        />
      ) : null}
    </PoolsCard>
  );
}

function FeesCard({
  view,
  onCollect,
  isCollecting,
}: {
  view: IPoolPositionView;
  onCollect: () => void;
  isCollecting: boolean;
}) {
  const { pool, position } = view;
  if (pool.capabilities.feeCollection === 'AUTO_COMPOUND') {
    return (
      <PoolsCard title={POOLS_COPY.fees}>
        <SizableText size="$bodyMd" color="$textSubdued">
          {POOLS_COPY.feesAutoCompound}
        </SizableText>
      </PoolsCard>
    );
  }
  const hasFees = new BigNumber(view.uncollectedFeesUsd).gt(0);
  const { inverted } = getPoolPair(pool);
  const rows = [
    { token: pool.token0, amount: position.uncollectedFees0 },
    { token: pool.token1, amount: position.uncollectedFees1 },
  ];
  return (
    <PoolsCard
      title={POOLS_COPY.unclaimedFees}
      right={
        hasFees ? (
          <Button
            size="small"
            variant="secondary"
            loading={isCollecting}
            onPress={onCollect}
            testID="earn-pool-position-collect"
          >
            {POOLS_COPY.collect}
          </Button>
        ) : null
      }
    >
      <SizableText size="$heading2xl">
        {formatUsd(view.uncollectedFeesUsd)}
      </SizableText>
      {hasFees ? (
        <YStack gap="$1">
          {(inverted ? rows.toReversed() : rows).map(
            ({ token, amount }, index) => (
              <XStack key={token.id} ai="center" gap="$2">
                <PoolTokenDot index={index === 0 ? 0 : 1} />
                <SizableText size="$bodyMd" color="$textSubdued">
                  {formatTokenAmount(amount, token.symbol)}
                </SizableText>
              </XStack>
            ),
          )}
        </YStack>
      ) : null}
      {new BigNumber(view.feesEarnedUsd).gt(view.uncollectedFeesUsd) ? (
        <SizableText size="$bodySm" color="$textSubdued">
          {POOLS_COPY.claimedSoFar(
            formatUsd(
              new BigNumber(view.feesEarnedUsd).minus(view.uncollectedFeesUsd),
            ),
          )}
        </SizableText>
      ) : null}
    </PoolsCard>
  );
}

/** One of Min, Now and Max, on a well a step below the card */
function RangeFigure({
  label,
  value,
  caution = false,
  large,
}: {
  label: string;
  value: string;
  /** Now, once the price has left the range */
  caution?: boolean;
  large: boolean;
}) {
  return (
    <YStack
      flex={1}
      flexBasis={0}
      minWidth={0}
      gap="$1"
      px="$3"
      py="$2.5"
      borderRadius="$3"
      bg="$bgApp"
    >
      <SizableText size="$bodySm" color="$textSubdued">
        {label}
      </SizableText>
      <SizableText
        size={large ? '$headingLg' : '$bodyLgMedium'}
        color={caution ? '$textCaution' : '$text'}
        numberOfLines={1}
      >
        {value}
      </SizableText>
    </YStack>
  );
}

/**
 * The range: Min, Now and Max, Now turning amber when the price has left
 * the range, then the position against the pool's liquidity.
 */
function RangeCard({
  view,
  ticks,
}: {
  view: IPoolPositionView;
  ticks: IPoolTickLiquidityNet[];
}) {
  const { gtMd } = useMedia();
  const { pool, position } = view;
  if (
    !pool.capabilities.priceRange ||
    position.tickLower === undefined ||
    position.tickUpper === undefined ||
    view.status === EPoolPositionStatus.Closed
  ) {
    return null;
  }
  const range = {
    tickLower: position.tickLower,
    tickUpper: position.tickUpper,
  };
  const display = getRangeDisplay(pool, range);
  const outOfRange = view.status === EPoolPositionStatus.OutOfRange;
  const { inverted } = getPoolPair(pool);
  let notice: string | undefined;
  if (view.outOfRangeSide) {
    // Past the upper tick the position is all token1, below the lower all token0
    const held =
      view.outOfRangeSide === 'above' ? pool.token1.symbol : pool.token0.symbol;
    const shownAbove = inverted
      ? view.outOfRangeSide === 'below'
      : view.outOfRangeSide === 'above';
    // How far the price has to come back to earn again, as shown
    const bound = shownAbove ? display.max : display.min;
    const move = new BigNumber(bound).div(display.current).minus(1).abs();
    const moveText = move.lt(0.001) ? '< 0.1%' : formatPercent(move, 1);
    notice = shownAbove
      ? POOLS_COPY.outOfRangeAbove(held, moveText, formatTokenPrice(bound))
      : POOLS_COPY.outOfRangeBelow(held, moveText, formatTokenPrice(bound));
  }
  return (
    <PoolsCard testID="earn-pool-position-range">
      <XStack ai="baseline" gap="$2" flexWrap="wrap">
        <SizableText size="$headingMd">{POOLS_COPY.range}</SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          {getPriceUnitLabel(pool)}
        </SizableText>
      </XStack>
      <XStack gap={gtMd ? '$3' : '$2'}>
        <RangeFigure
          label={POOLS_COPY.rangeMin}
          value={display.isFull ? '0' : formatTokenPrice(display.min)}
          large={gtMd}
        />
        <RangeFigure
          label={POOLS_COPY.now}
          value={formatTokenPrice(display.current)}
          caution={outOfRange}
          large={gtMd}
        />
        <RangeFigure
          label={POOLS_COPY.rangeMax}
          value={display.isFull ? '∞' : formatTokenPrice(display.max)}
          large={gtMd}
        />
      </XStack>
      {notice ? (
        <Alert
          type="warning"
          title={POOLS_COPY.outOfRange}
          description={notice}
        />
      ) : null}
      <PoolStrataPlot
        pool={pool}
        ticks={ticks}
        position={{ ...range, liquidity: BigInt(position.liquidity ?? '0') }}
        inRange={!outOfRange}
      />
    </PoolsCard>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <XStack jc="space-between" gap="$3">
      <SizableText size="$bodyMd" color="$textSubdued">
        {label}
      </SizableText>
      <SizableText size="$bodyMdMedium" textAlign="right" flexShrink={1}>
        {value}
      </SizableText>
    </XStack>
  );
}

function DetailsCard({ view }: { view: IPoolPositionView }) {
  const { pool, position } = view;
  return (
    <PoolsCard title={POOLS_COPY.details}>
      <DetailRow
        label={POOLS_COPY.protocol}
        value={getPoolProtocolLabel(pool)}
      />
      {position.tokenId ? (
        <DetailRow
          label={POOLS_COPY.positionId}
          value={`#${position.tokenId}`}
        />
      ) : null}
      {view.shareOfPool ? (
        <DetailRow
          label={POOLS_COPY.shareOfPool}
          value={formatPercent(Number(view.shareOfPool), 4)}
        />
      ) : null}
      <DetailRow
        label={POOLS_COPY.createdOn}
        value={formatLocaleDate(new Date(position.createdAt))}
      />
    </PoolsCard>
  );
}

function PositionSkeleton() {
  return (
    <YStack px="$pagePadding" gap="$5" py="$4">
      <XStack gap="$4" ai="center">
        <Skeleton w={getPoolPairIconWidth('lg')} h="$10" borderRadius="$full" />
        <Skeleton w="$48" h="$8" />
      </XStack>
      <Skeleton w="100%" h={220} borderRadius="$4" />
      <Skeleton w="100%" h={180} borderRadius="$4" />
    </YStack>
  );
}

function PositionView({
  view,
  ticks,
  networkName,
  openOnNetwork,
}: {
  view: IPoolPositionView;
  ticks: IPoolTickLiquidityNet[];
  networkName: string;
  /** Open positions on this position's network, this one included */
  openOnNetwork: number;
}) {
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const [isCollecting, setIsCollecting] = useState(false);
  const { pool, position } = view;
  const isOpen = view.status !== EPoolPositionStatus.Closed;
  const actions = usePoolPositionActions(view, 'earn-pool-position');
  // Every open position on the network starts selected
  const openExit = () =>
    navigation.push(ETabEarnRoutes.EarnPoolsExit, {
      networkId: pool.networkId,
    });
  const collect = async () => {
    setIsCollecting(true);
    try {
      const task = await backgroundApiProxy.servicePools.createTask({
        kind: 'collect',
        positionId: position.id,
      });
      navigation.push(ETabEarnRoutes.EarnPoolTask, { taskId: task.id });
    } finally {
      setIsCollecting(false);
    }
  };

  const breadcrumbProps = usePoolsBreadcrumb([
    {
      label: getPoolPairTitle(pool),
      onClick: () =>
        navigation.navigate(ETabEarnRoutes.EarnPoolDetails, {
          poolId: pool.id,
        }),
    },
    { label: POOLS_COPY.position },
  ]);

  // With one position, Remove's "one token" option is the same exit
  const exitRow =
    isOpen && openOnNetwork > 1 ? (
      <ListItem
        mx="$0"
        px="$5"
        py="$4"
        borderRadius="$4"
        bg="$bgSubdued"
        title={POOLS_COPY.exitPositionsOn(openOnNetwork, networkName)}
        subtitle={POOLS_COPY.exitPositionsHint}
        drillIn
        onPress={openExit}
        testID="earn-pool-position-exit"
      />
    ) : null;

  const fees = (
    <FeesCard
      view={view}
      isCollecting={isCollecting}
      onCollect={() => void collect()}
    />
  );

  const footer =
    gtMd || !actions.length ? null : (
      <PoolPositionActionsFooter actions={actions} />
    );

  let body: ReactNode;
  if (gtMd) {
    body = (
      <XStack gap="$6" ai="flex-start">
        <YStack flex={65} flexBasis={0} minWidth={0} gap="$5">
          <ValueCard view={view} />
          <RangeCard view={view} ticks={ticks} />
        </YStack>
        <YStack flex={35} flexBasis={0} minWidth={0} gap="$5">
          {actions.length ? (
            <XStack gap="$3">
              {actions.map((action) => (
                <Button
                  key={action.testID}
                  flex={1}
                  size="large"
                  variant={action.primary ? 'primary' : 'secondary'}
                  onPress={action.onPress}
                  testID={action.testID}
                >
                  {action.label}
                </Button>
              ))}
            </XStack>
          ) : null}
          {fees}
          {exitRow}
          <DetailsCard view={view} />
        </YStack>
      </XStack>
    );
  } else {
    body = (
      <YStack gap="$5">
        <ValueCard view={view} />
        {fees}
        <RangeCard view={view} ticks={ticks} />
        {exitRow}
        <DetailsCard view={view} />
      </YStack>
    );
  }

  return (
    <EarnPageContainer
      pageTitle={
        <SizableText size="$headingLg" numberOfLines={1}>
          {getPoolPairTitle(pool)}
        </SizableText>
      }
      breadcrumbProps={breadcrumbProps}
      sceneName={EAccountSelectorSceneName.home}
      tabRoute={ETabRoutes.Earn}
      showBackButton
      footer={footer}
      customHeaderRightItems={<PoolsDemoMenuButton />}
      contentContainerStyle={{ pb: gtMd ? '$10' : '$24' }}
    >
      <YStack px="$pagePadding" gap="$5" pt={gtMd ? '$0' : '$4'}>
        <PoolHeader pool={pool} status={<PoolPositionStatus view={view} />} />
        {body}
      </YStack>
    </EarnPageContainer>
  );
}

type IRouteProps = RouteProp<
  ITabEarnParamList,
  ETabEarnRoutes.EarnPoolPosition
>;

function EarnPoolPositionContent({ positionId }: { positionId: string }) {
  const navigation = useAppNavigation();
  const { result } = usePromiseResult(
    async () => {
      const portfolio = await backgroundApiProxy.servicePools.getPortfolio();
      const view = portfolio.positions.find(
        (item) => item.position.id === positionId,
      );
      if (!view) {
        return null;
      }
      const [detail, network] = await Promise.all([
        backgroundApiProxy.servicePools.getPoolDetail({
          poolId: view.pool.id,
        }),
        backgroundApiProxy.serviceNetwork.getNetworkSafe({
          networkId: view.pool.networkId,
        }),
      ]);
      const openOnNetwork = portfolio.positions.filter(
        (item) =>
          item.pool.networkId === view.pool.networkId &&
          item.status !== EPoolPositionStatus.Closed,
      ).length;
      return {
        view,
        ticks: detail.ticks,
        networkName: network?.name ?? '',
        openOnNetwork,
      };
    },
    [positionId],
    { revalidateOnFocus: true },
  );

  // A full Remove, an Exit, or claiming a closed position's last fees ends
  // the position while this page waits under the task, so the user goes on
  // to its pool rather than to an empty page
  const [shownPoolId, setShownPoolId] = useState<string>();
  const loadedPoolId = result?.view.pool.id;
  useEffect(() => {
    if (loadedPoolId) {
      setShownPoolId(loadedPoolId);
    }
  }, [loadedPoolId]);
  const closedPoolId = result === null ? shownPoolId : undefined;
  useEffect(() => {
    if (!closedPoolId) {
      return;
    }
    navigation.dispatch((state) => {
      const below = state.routes[state.index - 1];
      const belowPoolId = (below?.params as { poolId?: string } | undefined)
        ?.poolId;
      return below?.name === ETabEarnRoutes.EarnPoolDetails &&
        belowPoolId === closedPoolId
        ? StackActions.pop()
        : StackActions.replace(ETabEarnRoutes.EarnPoolDetails, {
            poolId: closedPoolId,
          });
    });
  }, [closedPoolId, navigation]);

  const breadcrumbProps = usePoolsBreadcrumb([{ label: POOLS_COPY.position }]);
  if (!result) {
    return (
      <EarnPageContainer
        pageTitle={
          <SizableText size="$headingLg">{POOLS_COPY.position}</SizableText>
        }
        breadcrumbProps={breadcrumbProps}
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.Earn}
        showBackButton
      >
        {result === null && !closedPoolId ? (
          <Empty icon="SearchOutline" title={POOLS_COPY.positionNotFound} />
        ) : (
          <PositionSkeleton />
        )}
      </EarnPageContainer>
    );
  }
  return (
    <PositionView
      view={result.view}
      ticks={result.ticks}
      networkName={result.networkName}
      openOnNetwork={result.openOnNetwork}
    />
  );
}

export default function EarnPoolPosition() {
  const route = useRoute<IRouteProps>();
  return (
    <AccountSelectorProviderMirror
      config={{ sceneName: EAccountSelectorSceneName.home, sceneUrl: '' }}
      enabledNum={[0]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <EarnPoolPositionContent positionId={route.params.positionId} />
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
