import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';

import {
  Alert,
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
import { ETabEarnRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import type { ITabEarnParamList } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import {
  EPoolListingStatus,
  EPoolPositionStatus,
} from '@onekeyhq/shared/types/pools';
import type {
  IPool,
  IPoolListItem,
  IPoolPositionView,
} from '@onekeyhq/shared/types/pools';

import { EarnPageContainer } from '../../components/EarnPageContainer';
import { EarnProviderMirror } from '../../EarnProviderMirror';
import { PoolHeader } from '../components/PoolHeader';
import {
  CAN_SET_RANGE_ON_CHART,
  POOL_CREATE_COLUMN_STICKY,
  PoolCreateSection,
  PoolDataSection,
  PoolOverviewTabs,
  PoolStarButton,
  getPoolRevealId,
  useCopyRange,
  usePoolOverview,
  usePoolShare,
} from '../components/PoolOverview';
import {
  PoolPositionActionsFooter,
  usePoolPositionActions,
} from '../components/PoolPositionActions';
import { PoolPositionCard } from '../components/PoolPositionCard';
import { PoolsCard } from '../components/PoolsCard';
import { PoolStatsStrip } from '../components/PoolStats';
import { PoolTokenSplit } from '../components/PoolTokenSplit';
import { POOLS_COPY } from '../poolsCopy';
import { getPoolPairTitle } from '../poolsFormat';
import { parsePoolShareParams } from '../poolsNavigation';
import { PoolsQueries, peekPoolsQuery, usePoolsQuery } from '../poolsQueries';
import { usePoolsBreadcrumb } from '../usePoolsBreadcrumb';

import type { IPoolOverviewTab } from '../components/PoolOverview';
import type { RouteProp } from '@react-navigation/core';

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

function PoolCompositionCard({ pool }: { pool: IPool }) {
  return (
    <PoolsCard title={POOLS_COPY.inPool}>
      <PoolTokenSplit
        pool={pool}
        amount0={pool.reserve0}
        amount1={pool.reserve1}
        compact
      />
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
 * A pool's page: what an opened row shows, plus the user's own positions
 * in it, the hook and the reserves; and a link to share. Wide screens keep
 * the form beside the data; phones switch between them.
 */
function PoolDetailsLoaded({ listPool }: { listPool: IPoolListItem }) {
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const tabBarHeight = useScrollContentTabBarOffset();
  const [tab, setTab] = useState<IPoolOverviewTab>('data');
  const { pool, detail, form, canCreate } = usePoolOverview({
    pool: listPool,
    onTaskCreated: (taskId) =>
      navigation.push(ETabEarnRoutes.EarnPoolTask, { taskId }),
  });
  const showCreate = useCallback(() => setTab('create'), []);
  const rangeOnChart = gtMd && CAN_SET_RANGE_ON_CHART;
  const tabsId = getPoolRevealId('tabs', 'page', pool.id);
  const copyRange = useCopyRange(
    form,
    gtMd ? {} : { onCopied: showCreate, revealId: tabsId },
  );
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

  // With exactly one position the data tab's footer acts on it, as an Earn
  // asset page's Redeem + Deposit do; with several, which one to remove is
  // a choice the cards make, so the footer stays Create position
  const positionActions = usePoolPositionActions(
    myPositions.length === 1 ? myPositions[0] : undefined,
    'earn-pool-footer',
  );

  // On the data tab the footer leads to the form; on the form it submits
  let footer = null;
  if (!gtMd) {
    if (tab === 'create' && canCreate) {
      footer = (
        <Page.Footer
          onConfirmText={form.buttonLabel}
          confirmButtonProps={{
            variant: 'primary',
            disabled: !form.canReview,
            loading: form.isBusy,
            onPress: () => void form.review(),
            mb: tabBarHeight,
            testID: 'earn-pool-add-review',
          }}
        />
      );
    } else if (positionActions.length) {
      footer = <PoolPositionActionsFooter actions={positionActions} />;
    } else if (canCreate) {
      footer = (
        <Page.Footer
          onConfirmText={POOLS_COPY.createPosition}
          confirmButtonProps={{
            variant: 'primary',
            onPress: showCreate,
            mb: tabBarHeight,
            testID: 'earn-pool-footer-create',
          }}
        />
      );
    }
  }

  const data = (
    <PoolDataSection
      pool={pool}
      detail={detail}
      form={form}
      layout={gtMd ? 'table' : 'list'}
      chartHeight={gtMd ? 300 : 220}
      rangeOnChart={rangeOnChart && canCreate}
      onCopyRange={copyRange}
      // Like the Portfolio tab on an Earn asset page: what you hold comes first
      beforeChart={
        <MyPositionsCard positions={myPositions} onOpen={openPosition} />
      }
    >
      <PoolHookCard pool={pool} />
      <PoolCompositionCard pool={pool} />
    </PoolDataSection>
  );
  const create = (
    <PoolCreateSection
      form={form}
      detail={detail}
      canCreate={canCreate}
      showButton={gtMd}
      rangeOnChart={rangeOnChart}
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
          {pool.listingStatus === EPoolListingStatus.Unlisted ? (
            <Alert type="warning" title={POOLS_COPY.unlistedNotice} />
          ) : null}
        </YStack>
        {gtMd ? (
          <XStack gap="$6" ai="flex-start">
            <YStack flex={1} minWidth={0}>
              {data}
            </YStack>
            {canCreate ? (
              <YStack
                testID="earn-pool-create-column"
                width={420}
                flexShrink={0}
                {...POOL_CREATE_COLUMN_STICKY}
              >
                {create}
              </YStack>
            ) : null}
          </XStack>
        ) : (
          <YStack gap="$4">
            {canCreate ? (
              <YStack id={tabsId}>
                <PoolOverviewTabs value={tab} onChange={setTab} />
              </YStack>
            ) : null}
            <YStack display={tab === 'data' ? 'flex' : 'none'}>{data}</YStack>
            {canCreate ? (
              <YStack display={tab === 'create' ? 'flex' : 'none'}>
                {create}
              </YStack>
            ) : null}
          </YStack>
        )}
      </YStack>
    </EarnPageContainer>
  );
}

function EarnPoolDetailsContent({ poolId }: { poolId: string | undefined }) {
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
  // added to a mounted page updates the page while rendering
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
  return <PoolDetailsLoaded key="loaded" listPool={pool} />;
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
        <EarnPoolDetailsContent poolId={poolId} />
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
