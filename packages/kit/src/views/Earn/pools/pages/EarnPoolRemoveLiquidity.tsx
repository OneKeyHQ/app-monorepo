import { useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useDebounce } from 'use-debounce';

import {
  Button,
  Page,
  SegmentControl,
  SizableText,
  Skeleton,
  useMedia,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETabEarnRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import type { ITabEarnParamList } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type {
  IPoolPositionView,
  IPoolsWallet,
} from '@onekeyhq/shared/types/pools';

import { EarnPageContainer } from '../../components/EarnPageContainer';
import { EarnProviderMirror } from '../../EarnProviderMirror';
import { PoolHeader } from '../components/PoolHeader';
import { PoolPositionStatus } from '../components/PoolPositionCard';
import {
  PoolAssetSelect,
  PoolPercentPicker,
  PoolRemoveSummary,
  sortTargetAssets,
} from '../components/PoolRemoveParts';
import { PoolsCard } from '../components/PoolsCard';
import { PoolsFlowColumn } from '../components/PoolsFlowColumn';
import { POOLS_COPY } from '../poolsCopy';
import { getPoolPair, getPoolPairTitle } from '../poolsFormat';
import { usePoolsBreadcrumb } from '../usePoolsBreadcrumb';

import type { RouteProp } from '@react-navigation/core';

type IReceiveMode = 'both' | 'one';

function RemoveForm({
  view,
  wallet,
}: {
  view: IPoolPositionView;
  wallet: IPoolsWallet;
}) {
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const tabBarHeight = useScrollContentTabBarOffset();
  const { pool, position } = view;

  const [percent, setPercent] = useState(1);
  const [mode, setMode] = useState<IReceiveMode>('both');
  const targets = useMemo(
    () => sortTargetAssets(wallet, [pool.token0.id, pool.token1.id]),
    [pool.token0.id, pool.token1.id, wallet],
  );
  // The quote side is usually what people count in (USDC over ETH)
  const [targetId, setTargetId] = useState(getPoolPair(pool).quote.id);
  const target = targets.find((asset) => asset.id === targetId) ?? targets[0];

  const [debouncedPercent] = useDebounce(percent, 200);
  const { result: preview, isLoading } = usePromiseResult(
    () =>
      backgroundApiProxy.servicePools.previewRemove({
        positionIds: [position.id],
        percent: debouncedPercent,
        targetAssetId: mode === 'one' ? target?.id : undefined,
      }),
    [debouncedPercent, mode, position.id, target?.id],
    { watchLoading: true },
  );
  const includesFees =
    pool.capabilities.feeCollection === 'CLAIMABLE' &&
    new BigNumber(view.uncollectedFeesUsd).gt(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const canReview = percent > 0 && Boolean(preview) && !isLoading;
  const review = async () => {
    setIsSubmitting(true);
    try {
      const task = await backgroundApiProxy.servicePools.createTask({
        kind: 'remove',
        params: {
          positionId: position.id,
          percent,
          targetAssetId: mode === 'one' ? target?.id : undefined,
        },
      });
      navigation.replace(ETabEarnRoutes.EarnPoolTask, { taskId: task.id });
    } finally {
      setIsSubmitting(false);
    }
  };
  const buttonLabel = percent > 0 ? POOLS_COPY.review : POOLS_COPY.chooseAmount;
  // The pair opens its pool everywhere; the position sits under it
  const breadcrumbProps = usePoolsBreadcrumb([
    {
      label: getPoolPairTitle(pool),
      onClick: () =>
        navigation.navigate(ETabEarnRoutes.EarnPoolDetails, {
          poolId: pool.id,
        }),
    },
    {
      label: POOLS_COPY.position,
      onClick: () =>
        navigation.navigate(ETabEarnRoutes.EarnPoolPosition, {
          positionId: position.id,
        }),
    },
    { label: POOLS_COPY.removeLiquidity },
  ]);

  const footer = gtMd ? null : (
    <Page.Footer
      onConfirmText={buttonLabel}
      confirmButtonProps={{
        variant: 'primary',
        disabled: !canReview,
        loading: isSubmitting,
        onPress: () => void review(),
        mb: tabBarHeight,
        testID: 'earn-pool-remove-review',
      }}
    />
  );

  return (
    <EarnPageContainer
      pageTitle={
        <SizableText size="$headingLg">
          {POOLS_COPY.removeLiquidity}
        </SizableText>
      }
      breadcrumbProps={gtMd ? undefined : breadcrumbProps}
      sceneName={EAccountSelectorSceneName.home}
      tabRoute={ETabRoutes.Earn}
      showBackButton
      footer={footer}
      contentContainerStyle={{ pb: gtMd ? '$10' : '$24' }}
    >
      <PoolsFlowColumn breadcrumbProps={breadcrumbProps} maxWidth={600}>
        <PoolHeader pool={pool} status={<PoolPositionStatus view={view} />} />
        <PoolsCard title={POOLS_COPY.amountToRemove}>
          <PoolPercentPicker value={percent} onChange={setPercent} />
        </PoolsCard>
        <PoolsCard title={POOLS_COPY.receive}>
          <SegmentControl
            fullWidth
            value={mode}
            // The create form's order; Both tokens stays the default here
            options={[
              {
                label: POOLS_COPY.receiveOne,
                value: 'one',
                testID: 'earn-pool-receive-one',
              },
              {
                label: POOLS_COPY.receiveBoth,
                value: 'both',
                testID: 'earn-pool-receive-both',
              },
            ]}
            onChange={(value) => setMode(value as IReceiveMode)}
          />
          {mode === 'one' && target ? (
            <PoolAssetSelect
              title={POOLS_COPY.exitTarget}
              assets={targets}
              value={target}
              onChange={(asset) => setTargetId(asset.id)}
            />
          ) : null}
          {preview && percent > 0 ? (
            <PoolRemoveSummary
              preview={preview}
              assets={wallet.assets}
              includesFees={includesFees}
              pool={pool}
            />
          ) : null}
        </PoolsCard>
        {gtMd ? (
          <Button
            variant="primary"
            size="large"
            disabled={!canReview}
            loading={isSubmitting}
            onPress={() => void review()}
            testID="earn-pool-remove-review"
          >
            {buttonLabel}
          </Button>
        ) : null}
      </PoolsFlowColumn>
    </EarnPageContainer>
  );
}

type IRouteProps = RouteProp<
  ITabEarnParamList,
  ETabEarnRoutes.EarnPoolRemoveLiquidity
>;

function EarnPoolRemoveLiquidityContent({
  positionId,
}: {
  positionId: string;
}) {
  const { result } = usePromiseResult(async () => {
    const portfolio = await backgroundApiProxy.servicePools.getPortfolio();
    const view = portfolio.positions.find(
      (item) => item.position.id === positionId,
    );
    if (!view) {
      return null;
    }
    const wallet = await backgroundApiProxy.servicePools.getWallet({
      networkId: view.pool.networkId,
    });
    return { view, wallet };
  }, [positionId]);
  if (!result) {
    return (
      <EarnPageContainer
        pageTitle={
          <SizableText size="$headingLg">
            {POOLS_COPY.removeLiquidity}
          </SizableText>
        }
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.Earn}
        showBackButton
      >
        {result === null ? null : (
          <PoolsFlowColumn maxWidth={600}>
            <Skeleton w="$48" h="$8" />
            <Skeleton w="100%" h={200} borderRadius="$4" />
          </PoolsFlowColumn>
        )}
      </EarnPageContainer>
    );
  }
  return <RemoveForm view={result.view} wallet={result.wallet} />;
}

export default function EarnPoolRemoveLiquidity() {
  const route = useRoute<IRouteProps>();
  return (
    <AccountSelectorProviderMirror
      config={{ sceneName: EAccountSelectorSceneName.home, sceneUrl: '' }}
      enabledNum={[0]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <EarnPoolRemoveLiquidityContent positionId={route.params.positionId} />
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
