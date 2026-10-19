import { useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useDebounce } from 'use-debounce';

import {
  Button,
  Checkbox,
  Empty,
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
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETabEarnRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import type { ITabEarnParamList } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EPoolPositionStatus } from '@onekeyhq/shared/types/pools';
import type {
  IPoolPositionView,
  IPoolsWallet,
} from '@onekeyhq/shared/types/pools';

import { EarnPageContainer } from '../../components/EarnPageContainer';
import { EarnProviderMirror } from '../../EarnProviderMirror';
import { PoolPairIcon } from '../components/PoolPairIcon';
import { PoolPositionStatus } from '../components/PoolPositionCard';
import {
  PoolAssetSelect,
  PoolPercentPicker,
  PoolRemoveSummary,
  sortTargetAssets,
} from '../components/PoolRemoveParts';
import { PoolsCard } from '../components/PoolsCard';
import { PoolsChip } from '../components/PoolsFilterButton';
import { PoolTags } from '../components/PoolTags';
import { POOLS_COPY } from '../poolsCopy';
import { formatUsd, getPoolPair, getPoolPairTitle } from '../poolsFormat';
import { usePoolsBreadcrumb } from '../usePoolsBreadcrumb';

import type { RouteProp } from '@react-navigation/core';

type IExitNetwork = { networkId: string; name: string; valueUsd: number };

function PositionPickRow({
  view,
  checked,
  onToggle,
}: {
  view: IPoolPositionView;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <XStack
      role="checkbox"
      aria-checked={checked}
      testID={`earn-pool-exit-pick-${view.position.id}`}
      ai="center"
      gap="$3"
      py="$1"
      cursor="pointer"
      userSelect="none"
      onPress={onToggle}
    >
      <Checkbox
        testID={`earn-pool-exit-check-${view.position.id}`}
        value={checked}
        onChange={onToggle}
        shouldStopPropagation
      />
      <PoolPairIcon pool={view.pool} size="sm" ringColor="$bgSubdued" />
      <YStack flex={1} gap="$1" minWidth={0}>
        <SizableText size="$bodyLgMedium" numberOfLines={1}>
          {getPoolPairTitle(view.pool)}
        </SizableText>
        <PoolTags pool={view.pool} />
      </YStack>
      <YStack ai="flex-end" gap="$1">
        <SizableText size="$bodyLgMedium">
          {formatUsd(view.valueUsd)}
        </SizableText>
        <PoolPositionStatus view={view} />
      </YStack>
    </XStack>
  );
}

function ExitForm({
  networks,
  positions,
  wallets,
  initialNetworkId,
  initialPositionIds,
}: {
  networks: IExitNetwork[];
  positions: IPoolPositionView[];
  wallets: Record<string, IPoolsWallet>;
  initialNetworkId: string;
  initialPositionIds?: string[];
}) {
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const tabBarHeight = useScrollContentTabBarOffset();

  const [networkId, setNetworkId] = useState(initialNetworkId);
  const onNetwork = useMemo(
    () => positions.filter((view) => view.pool.networkId === networkId),
    [networkId, positions],
  );
  const [selected, setSelected] = useState<string[]>(() => {
    const preset = (initialPositionIds ?? []).filter((id) =>
      onNetwork.some((view) => view.position.id === id),
    );
    // Opened from a position: start with just that one, the rest are a tap away
    return preset.length ? preset : onNetwork.map((view) => view.position.id);
  });
  const selectedViews = onNetwork.filter((view) =>
    selected.includes(view.position.id),
  );

  const wallet = wallets[networkId];
  const targets = useMemo(
    () =>
      wallet
        ? sortTargetAssets(
            wallet,
            selectedViews.flatMap((view) => [
              view.pool.token0.id,
              view.pool.token1.id,
            ]),
          )
        : [],
    [selectedViews, wallet],
  );
  const firstPool = (selectedViews[0] ?? onNetwork[0])?.pool;
  const [targetId, setTargetId] = useState<string | undefined>(
    firstPool ? getPoolPair(firstPool).quote.id : undefined,
  );
  const target =
    targets.find((asset) => asset.id === targetId) ?? targets[0] ?? undefined;

  const [percent, setPercent] = useState(1);
  const [debouncedPercent] = useDebounce(percent, 200);
  const selectedKey = selectedViews.map((view) => view.position.id).join(',');
  const { result: preview, isLoading } = usePromiseResult(
    async () => {
      if (!selectedKey || !target || debouncedPercent <= 0) {
        return undefined;
      }
      return backgroundApiProxy.servicePools.previewRemove({
        positionIds: selectedKey.split(','),
        percent: debouncedPercent,
        targetAssetId: target.id,
      });
    },
    [debouncedPercent, selectedKey, target],
    { watchLoading: true },
  );
  const includesFees = selectedViews.some(
    (view) =>
      view.pool.capabilities.feeCollection === 'CLAIMABLE' &&
      new BigNumber(view.uncollectedFeesUsd).gt(0),
  );

  const switchNetwork = (id: string) => {
    setNetworkId(id);
    const views = positions.filter((view) => view.pool.networkId === id);
    setSelected(views.map((view) => view.position.id));
    setTargetId(views[0] ? getPoolPair(views[0].pool).quote.id : undefined);
  };
  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const canExit =
    selectedViews.length > 0 && percent > 0 && Boolean(preview) && !isLoading;
  const exit = async () => {
    if (!target) {
      return;
    }
    setIsSubmitting(true);
    try {
      const task = await backgroundApiProxy.servicePools.createTask({
        kind: 'exit',
        params: {
          positionIds: selectedViews.map((view) => view.position.id),
          percent,
          targetAssetId: target.id,
        },
      });
      navigation.replace(ETabEarnRoutes.EarnPoolTask, { taskId: task.id });
    } finally {
      setIsSubmitting(false);
    }
  };
  let buttonLabel: string = POOLS_COPY.exitAction;
  if (!selectedViews.length) {
    buttonLabel = POOLS_COPY.exitPick;
  } else if (percent <= 0) {
    buttonLabel = POOLS_COPY.enterAmount;
  }

  const breadcrumbProps = usePoolsBreadcrumb([{ label: POOLS_COPY.exitTitle }]);

  const footer = gtMd ? null : (
    <Page.Footer
      onConfirmText={buttonLabel}
      confirmButtonProps={{
        variant: 'primary',
        disabled: !canExit,
        loading: isSubmitting,
        onPress: () => void exit(),
        mb: tabBarHeight,
        testID: 'earn-pool-exit-submit',
      }}
    />
  );

  return (
    <EarnPageContainer
      pageTitle={
        <SizableText size="$headingLg">{POOLS_COPY.exitTitle}</SizableText>
      }
      breadcrumbProps={breadcrumbProps}
      sceneName={EAccountSelectorSceneName.home}
      tabRoute={ETabRoutes.Earn}
      showBackButton
      footer={footer}
      contentContainerStyle={{ pb: gtMd ? '$10' : '$24' }}
    >
      <YStack
        px="$pagePadding"
        gap="$5"
        pt={gtMd ? '$0' : '$4'}
        maxWidth={gtMd ? 600 : undefined}
      >
        {gtMd ? (
          <SizableText size="$heading2xl">{POOLS_COPY.exitTitle}</SizableText>
        ) : null}
        <YStack gap="$2">
          <XStack gap="$2" flexWrap="wrap">
            {networks.map((network) => (
              <PoolsChip
                key={network.networkId}
                testID={`earn-pool-exit-network-${network.networkId}`}
                label={network.name}
                icon={<NetworkAvatar networkId={network.networkId} size="$4" />}
                active={network.networkId === networkId}
                onPress={() => switchNetwork(network.networkId)}
              />
            ))}
          </XStack>
          <SizableText size="$bodySm" color="$textSubdued">
            {POOLS_COPY.exitOneNetwork}
          </SizableText>
        </YStack>
        <PoolsCard
          title={POOLS_COPY.exitPick}
          right={
            <SizableText size="$bodyMd" color="$textSubdued">
              {POOLS_COPY.exitSelected(selectedViews.length)}
            </SizableText>
          }
        >
          {onNetwork.map((view) => (
            <PositionPickRow
              key={view.position.id}
              view={view}
              checked={selected.includes(view.position.id)}
              onToggle={() => toggle(view.position.id)}
            />
          ))}
        </PoolsCard>
        <PoolsCard title={POOLS_COPY.amountToRemove}>
          <PoolPercentPicker value={percent} onChange={setPercent} />
        </PoolsCard>
        {target ? (
          <PoolsCard title={POOLS_COPY.exitTarget}>
            <PoolAssetSelect
              title={POOLS_COPY.exitTarget}
              assets={targets}
              value={target}
              onChange={(asset) => setTargetId(asset.id)}
            />
            {preview && selectedViews.length && percent > 0 ? (
              <PoolRemoveSummary
                preview={preview}
                assets={wallet?.assets ?? []}
                includesFees={includesFees}
              />
            ) : null}
          </PoolsCard>
        ) : null}
        {gtMd ? (
          <Button
            variant="primary"
            size="large"
            disabled={!canExit}
            loading={isSubmitting}
            onPress={() => void exit()}
            testID="earn-pool-exit-submit"
          >
            {buttonLabel}
          </Button>
        ) : null}
      </YStack>
    </EarnPageContainer>
  );
}

type IRouteProps = RouteProp<ITabEarnParamList, ETabEarnRoutes.EarnPoolsExit>;

function EarnPoolsExitContent({
  networkId,
  positionIds,
}: {
  networkId?: string;
  positionIds?: string[];
}) {
  const { result } = usePromiseResult(async () => {
    const portfolio = await backgroundApiProxy.servicePools.getPortfolio();
    const positions = portfolio.positions.filter(
      (view) => view.status !== EPoolPositionStatus.Closed,
    );
    const networkIds = Array.from(
      new Set(positions.map((view) => view.pool.networkId)),
    );
    const [names, walletList] = await Promise.all([
      Promise.all(
        networkIds.map((id) =>
          backgroundApiProxy.serviceNetwork.getNetworkSafe({ networkId: id }),
        ),
      ),
      Promise.all(
        networkIds.map((id) =>
          backgroundApiProxy.servicePools.getWallet({ networkId: id }),
        ),
      ),
    ]);
    const networks: IExitNetwork[] = networkIds
      .map((id, index) => ({
        networkId: id,
        name: names[index]?.name ?? id,
        valueUsd: positions
          .filter((view) => view.pool.networkId === id)
          .reduce((sum, view) => sum + Number(view.valueUsd), 0),
      }))
      .toSorted((a, b) => b.valueUsd - a.valueUsd);
    const wallets = Object.fromEntries(
      walletList.map((wallet) => [wallet.networkId, wallet]),
    );
    return { positions, networks, wallets };
  }, []);

  if (!result) {
    return (
      <EarnPageContainer
        pageTitle={
          <SizableText size="$headingLg">{POOLS_COPY.exitTitle}</SizableText>
        }
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.Earn}
        showBackButton
      >
        <YStack px="$pagePadding" gap="$5" py="$4">
          <Skeleton w="$48" h="$8" />
          <Skeleton w="100%" h={220} borderRadius="$4" />
        </YStack>
      </EarnPageContainer>
    );
  }
  const fromPosition = result.positions.find((view) =>
    positionIds?.includes(view.position.id),
  );
  const initialNetworkId =
    networkId ?? fromPosition?.pool.networkId ?? result.networks[0]?.networkId;
  if (!initialNetworkId) {
    return (
      <EarnPageContainer
        pageTitle={
          <SizableText size="$headingLg">{POOLS_COPY.exitTitle}</SizableText>
        }
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.Earn}
        showBackButton
      >
        <Empty icon="DropOutline" title={POOLS_COPY.noPositions} />
      </EarnPageContainer>
    );
  }
  return (
    <ExitForm
      networks={result.networks}
      positions={result.positions}
      wallets={result.wallets}
      initialNetworkId={initialNetworkId}
      initialPositionIds={positionIds}
    />
  );
}

export default function EarnPoolsExit() {
  const route = useRoute<IRouteProps>();
  return (
    <AccountSelectorProviderMirror
      config={{ sceneName: EAccountSelectorSceneName.home, sceneUrl: '' }}
      enabledNum={[0]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <EarnPoolsExitContent
          networkId={route.params?.networkId}
          positionIds={route.params?.positionIds}
        />
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
