import { useRoute } from '@react-navigation/core';

import {
  Page,
  SizableText,
  Skeleton,
  useMedia,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETabEarnRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import type { ITabEarnParamList } from '@onekeyhq/shared/src/routes';
import type { IPoolTickRange } from '@onekeyhq/shared/src/utils/poolsMath';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type {
  IPoolDetail,
  IPoolPositionView,
  IPoolsWallet,
} from '@onekeyhq/shared/types/pools';

import { EarnPageContainer } from '../../components/EarnPageContainer';
import { EarnProviderMirror } from '../../EarnProviderMirror';
import { PoolHeader } from '../components/PoolHeader';
import { PoolPositionStatus } from '../components/PoolPositionCard';
import {
  PoolPositionForm,
  PoolPositionReviewButton,
} from '../components/PoolPositionForm';
import { PoolsFlowColumn } from '../components/PoolsFlowColumn';
import { POOLS_COPY } from '../poolsCopy';
import { getPoolPairTitle } from '../poolsFormat';
import { PoolsQueries, usePoolsQuery } from '../poolsQueries';
import { usePoolPositionForm } from '../usePoolPositionForm';
import { usePoolsBreadcrumb } from '../usePoolsBreadcrumb';

import type { RouteProp } from '@react-navigation/core';

function AddLiquiditySkeleton() {
  return (
    <PoolsFlowColumn maxWidth={560}>
      <Skeleton w="$48" h="$8" />
      <Skeleton w="100%" h={260} borderRadius="$4" />
      <Skeleton w="100%" h={180} borderRadius="$4" />
    </PoolsFlowColumn>
  );
}

/**
 * Add to an existing position (its range is fixed) or, from older entry
 * points, open a new one. New positions normally start in an opened pool.
 */
function AddLiquidityForm({
  detail,
  wallet,
  view,
  positionId,
  initialRange,
}: {
  detail: IPoolDetail;
  wallet: IPoolsWallet | undefined;
  /** The position being added to; its status sits in the header */
  view?: IPoolPositionView;
  positionId?: string;
  initialRange?: IPoolTickRange;
}) {
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const tabBarHeight = useScrollContentTabBarOffset();
  const { pool } = detail;
  const form = usePoolPositionForm({
    pool,
    wallet,
    positionId,
    initialRange,
    // The task page is the review; going back from it leaves the flow
    onTaskCreated: (taskId) =>
      navigation.replace(ETabEarnRoutes.EarnPoolTask, { taskId }),
  });

  const footer = gtMd ? null : (
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

  const breadcrumbProps = usePoolsBreadcrumb([
    {
      label: getPoolPairTitle(pool),
      onClick: () =>
        navigation.navigate(ETabEarnRoutes.EarnPoolDetails, {
          poolId: pool.id,
        }),
    },
    ...(positionId
      ? [
          {
            label: POOLS_COPY.position,
            onClick: () =>
              navigation.navigate(ETabEarnRoutes.EarnPoolPosition, {
                positionId,
              }),
          },
        ]
      : []),
    { label: positionId ? POOLS_COPY.stepIncrease : POOLS_COPY.addLiquidity },
  ]);

  return (
    <EarnPageContainer
      pageTitle={
        <SizableText size="$headingLg">
          {positionId ? POOLS_COPY.add : POOLS_COPY.addLiquidity}
        </SizableText>
      }
      breadcrumbProps={gtMd ? undefined : breadcrumbProps}
      sceneName={EAccountSelectorSceneName.home}
      tabRoute={ETabRoutes.Earn}
      showBackButton
      footer={footer}
      contentContainerStyle={{ pb: gtMd ? '$10' : '$24' }}
    >
      <PoolsFlowColumn breadcrumbProps={breadcrumbProps} maxWidth={560}>
        <PoolHeader
          pool={pool}
          status={view ? <PoolPositionStatus view={view} /> : undefined}
        />
        <PoolPositionForm
          form={form}
          ticks={detail.ticks}
          priceHistory={detail.priceHistory}
          button={gtMd ? <PoolPositionReviewButton form={form} /> : null}
        />
      </PoolsFlowColumn>
    </EarnPageContainer>
  );
}

type IRouteProps = RouteProp<
  ITabEarnParamList,
  ETabEarnRoutes.EarnPoolAddLiquidity
>;

function EarnPoolAddLiquidityContent({
  poolId,
  positionId,
}: {
  poolId: string;
  positionId?: string;
}) {
  const { result: detail } = usePoolsQuery(PoolsQueries.detail(poolId));
  const networkId = detail?.pool.networkId;
  const { result: wallet } = usePoolsQuery(
    networkId ? PoolsQueries.wallet(networkId) : undefined,
    { refreshOnFocus: true },
  );
  const { result: portfolio } = usePoolsQuery(
    positionId ? PoolsQueries.portfolio() : undefined,
  );
  const view = portfolio?.positions.find(
    (item) => item.position.id === positionId,
  );
  const position = view?.position;

  // The form takes its fixed range when it mounts, so it waits for it
  if (!detail || (positionId && !position)) {
    return (
      <EarnPageContainer
        key="loading"
        pageTitle={
          <SizableText size="$headingLg">{POOLS_COPY.addLiquidity}</SizableText>
        }
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.Earn}
        showBackButton
      >
        <AddLiquiditySkeleton />
      </EarnPageContainer>
    );
  }

  return (
    <AddLiquidityForm
      key="loaded"
      detail={detail}
      wallet={wallet}
      view={view}
      positionId={positionId}
      initialRange={
        position?.tickLower !== undefined && position.tickUpper !== undefined
          ? { tickLower: position.tickLower, tickUpper: position.tickUpper }
          : undefined
      }
    />
  );
}

export default function EarnPoolAddLiquidity() {
  const route = useRoute<IRouteProps>();
  return (
    <AccountSelectorProviderMirror
      config={{ sceneName: EAccountSelectorSceneName.home, sceneUrl: '' }}
      enabledNum={[0]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <EarnPoolAddLiquidityContent
          poolId={route.params.poolId}
          positionId={route.params.positionId}
        />
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
