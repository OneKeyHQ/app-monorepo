import { useCallback, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';

import {
  Empty,
  IconButton,
  Page,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useMedia,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EModalRoutes,
  EModalStakingRoutes,
  ETabEarnRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import type { ITabEarnParamList } from '@onekeyhq/shared/src/routes';
import type { IPoolTickRange } from '@onekeyhq/shared/src/utils/poolsMath';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EPoolPositionStatus } from '@onekeyhq/shared/types/pools';
import type {
  IPool,
  IPoolListItem,
  IPoolPositionView,
  IPoolTickLiquidityNet,
} from '@onekeyhq/shared/types/pools';

import { EarnPageContainer } from '../../components/EarnPageContainer';
import { EarnProviderMirror } from '../../EarnProviderMirror';
import {
  ProtocolIntroSection,
  hasProtocolIntroContent,
} from '../../pages/EarnProtocolDetails/components/ProtocolIntroSection';
import { PoolDetailTabs } from '../components/PoolDetailTabs';
import { PoolHeader } from '../components/PoolHeader';
import { PoolInfoTab } from '../components/PoolInfoTab';
import {
  CAN_SET_RANGE_ON_CHART,
  POOL_CREATE_COLUMN_STICKY,
  PoolChartSection,
  PoolCreateSection,
  PoolStarButton,
  useCopyRange,
  usePoolOverview,
  usePoolShare,
} from '../components/PoolOverview';
import { getPoolPairIconWidth } from '../components/PoolPairIcon';
import { PoolPositionCard } from '../components/PoolPositionCard';
import { PoolStatsStrip } from '../components/PoolStats';
import { PoolTopPositions } from '../components/PoolTopPositions';
import { POOLS_COPY } from '../poolsCopy';
import { getPoolPairTitle } from '../poolsFormat';
import { parsePoolShareParams } from '../poolsNavigation';
import { PoolsQueries, peekPoolsQuery, usePoolsQuery } from '../poolsQueries';
import { usePoolsBreadcrumb } from '../usePoolsBreadcrumb';

import type { RouteProp } from '@react-navigation/core';

/** The Portfolio tab: the user's open positions here, each to its page */
function MyPositionsList({
  positions,
  ticks,
  onOpen,
  flipped,
}: {
  positions: IPoolPositionView[];
  ticks: IPoolTickLiquidityNet[] | undefined;
  onOpen: (view: IPoolPositionView) => void;
  /** The price chart above is flipped; the ranges follow it */
  flipped: boolean;
}) {
  return (
    <YStack gap="$3">
      {positions.map((view) => (
        <PoolPositionCard
          key={view.position.id}
          view={view}
          ticks={ticks}
          flipped={flipped}
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
        <Skeleton w={getPoolPairIconWidth('lg')} h="$10" borderRadius="$full" />
        <YStack gap="$2">
          <Skeleton w="$40" h="$7" />
          <Skeleton w="$32" h="$4" />
        </YStack>
      </XStack>
      <Skeleton w="100%" h={64} borderRadius="$4" />
      <Skeleton w="100%" h={320} borderRadius="$4" />
    </YStack>
  );
}

function PoolPageTitle({ pool }: { pool?: IPool }) {
  return (
    <SizableText size="$headingLg" numberOfLines={1}>
      {pool ? getPoolPairTitle(pool) : POOLS_COPY.pool}
    </SizableText>
  );
}

/**
 * A pool's page, laid out like an Earn asset page: the pool and its chart,
 * then Portfolio, Info, Top positions and Protocol tabs. Wide screens keep
 * the create form beside them; phones open it in a modal from the footer, as
 * the asset page opens Deposit.
 */
function PoolDetailsLoaded({
  listPool,
  initialRange,
}: {
  listPool: IPoolListItem;
  initialRange?: IPoolTickRange;
}) {
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const tabBarHeight = useScrollContentTabBarOffset();
  const pushTask = useCallback(
    (taskId: string) =>
      navigation.push(ETabEarnRoutes.EarnPoolTask, { taskId }),
    [navigation],
  );
  const { pool, detail, form } = usePoolOverview({
    pool: listPool,
    onTaskCreated: pushTask,
    initialRange,
  });
  const openCreate = useCallback(
    (range?: IPoolTickRange) =>
      navigation.pushModal(EModalRoutes.StakingModal, {
        screen: EModalStakingRoutes.PoolCreatePosition,
        params: {
          poolId: pool.id,
          initialRange: range,
          onTaskCreated: pushTask,
        },
      }),
    [navigation, pool.id, pushTask],
  );
  const rangeOnChart = gtMd && CAN_SET_RANGE_ON_CHART;
  // Wide screens set a copied range in the create card beside the list;
  // phones open the form with it
  const copyRange = useCopyRange(form, gtMd ? {} : { onCopied: openCreate });
  const share = usePoolShare(pool);

  const { result: portfolio } = usePoolsQuery(PoolsQueries.portfolio(), {
    refreshOnFocus: true,
  });
  const myPositions = useMemo(
    () =>
      portfolio?.positions.filter(
        (view) =>
          view.pool.id === pool.id &&
          view.status !== EPoolPositionStatus.Closed,
      ) ?? [],
    [pool.id, portfolio?.positions],
  );
  const openPosition = (view: IPoolPositionView) =>
    navigation.push(ETabEarnRoutes.EarnPoolPosition, {
      positionId: view.position.id,
    });

  const breadcrumbProps = usePoolsBreadcrumb([
    { label: getPoolPairTitle(pool) },
  ]);

  const actions = (
    <XStack gap="$1" ai="center">
      <PoolStarButton poolId={pool.id} size="medium" />
      <IconButton
        testID="earn-pool-share"
        variant="tertiary"
        icon="ShareOutline"
        title={POOLS_COPY.share}
        onPress={share}
      />
    </XStack>
  );

  // The same footer whether or not the user holds a position here: Remove
  // and Add sit on each position's own page, one tap on its card away
  const footer = !gtMd ? (
    <Page.Footer
      onConfirmText={POOLS_COPY.createPosition}
      confirmButtonProps={{
        variant: 'primary',
        onPress: () => openCreate(),
        mb: tabBarHeight,
        testID: 'earn-pool-footer-create',
      }}
    />
  ) : null;

  const layout = gtMd ? 'table' : 'list';
  const chart = (
    <PoolChartSection
      pool={pool}
      detail={detail}
      // Phones fill the form in its modal, so their chart draws no range
      form={gtMd ? form : undefined}
      // One direction for the whole page: the cards under the chart follow
      flipped={form.flipped}
      onFlippedChange={form.setFlipped}
      layout={layout}
      chartHeight={gtMd ? 300 : 220}
      rangeOnChart={rangeOnChart}
    />
  );
  const tabs = (
    <PoolDetailTabs
      portfolioContent={
        myPositions.length ? (
          <MyPositionsList
            positions={myPositions}
            ticks={detail?.ticks}
            onOpen={openPosition}
            flipped={form.flipped}
          />
        ) : undefined
      }
      infoContent={<PoolInfoTab pool={pool} detail={detail} />}
      topPositionsContent={
        pool.capabilities.priceRange ? (
          <PoolTopPositions
            pool={pool}
            layout={layout}
            onCopyRange={copyRange}
            variant="tab"
          />
        ) : undefined
      }
      protocolContent={
        hasProtocolIntroContent(detail?.protocolInfo) ? (
          <ProtocolIntroSection protocolInfo={detail?.protocolInfo} />
        ) : undefined
      }
    />
  );

  return (
    <EarnPageContainer
      pageTitle={<PoolPageTitle pool={pool} />}
      breadcrumbProps={breadcrumbProps}
      sceneName={EAccountSelectorSceneName.home}
      tabRoute={ETabRoutes.Earn}
      showBackButton
      customHeaderRightItems={gtMd ? undefined : actions}
      footer={footer}
      contentContainerStyle={{ pb: gtMd ? '$10' : '$24' }}
    >
      <YStack px="$pagePadding" gap="$6" pt={gtMd ? '$0' : '$4'}>
        <YStack gap="$5">
          <PoolHeader pool={pool} right={gtMd ? actions : undefined} />
          <PoolStatsStrip pool={pool} compact={!gtMd} />
        </YStack>
        {gtMd ? (
          <XStack gap="$6" ai="flex-start">
            <YStack flex={1} minWidth={0} gap="$6">
              {chart}
              {tabs}
            </YStack>
            <YStack
              testID="earn-pool-create-column"
              width={420}
              flexShrink={0}
              {...POOL_CREATE_COLUMN_STICKY}
            >
              <PoolCreateSection
                form={form}
                detail={detail}
                showButton
                rangeOnChart={rangeOnChart}
              />
            </YStack>
          </XStack>
        ) : (
          <YStack gap="$6">
            {chart}
            {tabs}
          </YStack>
        )}
      </YStack>
    </EarnPageContainer>
  );
}

function EarnPoolDetailsContent({
  poolId,
  initialRange,
}: {
  poolId: string | undefined;
  initialRange?: IPoolTickRange;
}) {
  // A pool opened from the list shows at once from the list's copy
  const cachedPool = useMemo(
    () =>
      poolId
        ? peekPoolsQuery(PoolsQueries.list())?.find(
            (item) => item.id === poolId,
          )
        : undefined,
    [poolId],
  );
  const { result: detail, isError } = usePoolsQuery(
    poolId ? PoolsQueries.detail(poolId) : undefined,
  );
  const pool = detail?.pool ?? cachedPool;
  // An unknown network in the link, or a pool the demo doesn't have
  const notFound = !poolId || isError;

  // Distinct keys: the loaded page mounts with its footer, since a footer
  // added to a mounted page updates the page while rendering. A route reused
  // for another pool starts over, as the form holds the last pool's range
  if (!pool) {
    return (
      <EarnPageContainer
        key="loading"
        pageTitle={<PoolPageTitle />}
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.Earn}
        showBackButton
      >
        {notFound ? (
          <Empty icon="SearchOutline" title={POOLS_COPY.poolNotFound} />
        ) : (
          <PoolDetailsSkeleton />
        )}
      </EarnPageContainer>
    );
  }
  return (
    <PoolDetailsLoaded
      key={`loaded:${pool.id}`}
      listPool={pool}
      initialRange={initialRange}
    />
  );
}

type IRouteProps = RouteProp<
  ITabEarnParamList,
  ETabEarnRoutes.EarnPoolDetails | ETabEarnRoutes.EarnPoolDetailsShare
>;

export default function EarnPoolDetails() {
  const route = useRoute<IRouteProps>();
  const params = route.params;
  // A shared link names the pool by network, version and key
  const poolId =
    'poolId' in params ? params.poolId : parsePoolShareParams(params);
  return (
    <AccountSelectorProviderMirror
      config={{ sceneName: EAccountSelectorSceneName.home, sceneUrl: '' }}
      enabledNum={[0]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <EarnPoolDetailsContent
          poolId={poolId}
          initialRange={
            'initialRange' in params ? params.initialRange : undefined
          }
        />
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
