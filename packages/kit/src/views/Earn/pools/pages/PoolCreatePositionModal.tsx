import {
  Page,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  popModalPages,
  popModalPagesOnNative,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import type { IPoolTickRange } from '@onekeyhq/shared/src/utils/poolsMath';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EPoolListingStatus } from '@onekeyhq/shared/types/pools';
import type { IPoolDetail, IPoolsWallet } from '@onekeyhq/shared/types/pools';

import { EarnProviderMirror } from '../../EarnProviderMirror';
import { PoolCreateSection } from '../components/PoolOverview';
import { PoolPairIcon } from '../components/PoolPairIcon';
import { PoolTags } from '../components/PoolTags';
import { POOLS_COPY } from '../poolsCopy';
import { getPoolPairTitle } from '../poolsFormat';
import { PoolsNavigation } from '../poolsNavigation';
import { PoolsQueries, usePoolsQuery } from '../poolsQueries';
import { usePoolPositionForm } from '../usePoolPositionForm';

/**
 * A pool page's Create position on phones, as a modal like an Earn asset
 * page's Deposit: the form with its button in the footer. Its task then
 * opens on the pool page's stack.
 */
function CreatePositionForm({
  detail,
  wallet,
  initialRange,
  onTaskCreated,
}: {
  detail: IPoolDetail;
  wallet: IPoolsWallet | undefined;
  initialRange?: IPoolTickRange;
  onTaskCreated?: (taskId: string) => void;
}) {
  const navigation = useAppNavigation();
  const { pool } = detail;
  const form = usePoolPositionForm({
    pool,
    wallet,
    priceHistory: detail.priceHistory,
    initialRange,
    // Only once this modal is gone: while it is open, a push lands in the
    // modal's own stack, which has no task page
    onTaskCreated: async (taskId) => {
      if (platformEnv.isNative) {
        popModalPagesOnNative();
      } else {
        await popModalPages();
      }
      if (onTaskCreated) {
        onTaskCreated(taskId);
      } else {
        // Opened without a way back to its page (a restored web modal)
        PoolsNavigation.pushTask(navigation, taskId);
      }
    },
  });
  const canCreate = pool.listingStatus === EPoolListingStatus.Listed;

  return (
    <Page scrollEnabled scrollProps={{ keyboardShouldPersistTaps: 'handled' }}>
      <Page.Header title={POOLS_COPY.createPosition} />
      <Page.Body>
        <YStack px="$5" pb="$5" gap="$5">
          <XStack ai="center" gap="$3">
            <PoolPairIcon pool={pool} size="md" />
            <YStack gap="$1" flex={1}>
              <SizableText size="$headingLg">
                {getPoolPairTitle(pool)}
              </SizableText>
              <PoolTags pool={pool} />
            </YStack>
          </XStack>
          <PoolCreateSection
            form={form}
            detail={detail}
            canCreate={canCreate}
            showButton={false}
          />
        </YStack>
      </Page.Body>
      {canCreate ? (
        <Page.Footer
          onConfirmText={form.buttonLabel}
          confirmButtonProps={{
            variant: 'primary',
            disabled: !form.canReview,
            loading: form.isBusy,
            onPress: () => void form.review(),
            testID: 'earn-pool-add-review',
          }}
        />
      ) : null}
    </Page>
  );
}

function PoolCreatePositionContent() {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.PoolCreatePosition
  >();
  const { poolId, initialRange, onTaskCreated } = route.params;
  const { result: detail } = usePoolsQuery(PoolsQueries.detail(poolId));
  const networkId = detail?.pool.networkId;
  const { result: wallet } = usePoolsQuery(
    networkId ? PoolsQueries.wallet(networkId) : undefined,
    { refreshOnFocus: true },
  );

  // Distinct keys: the form's page mounts with its footer, and the form
  // takes its initial range when it mounts
  if (!detail) {
    return (
      <Page key="loading">
        <Page.Header title={POOLS_COPY.createPosition} />
        <Page.Body>
          <YStack px="$5" gap="$5">
            <Skeleton w="$48" h="$8" />
            <Skeleton w="100%" h={260} borderRadius="$4" />
          </YStack>
        </Page.Body>
      </Page>
    );
  }
  return (
    <CreatePositionForm
      key="loaded"
      detail={detail}
      wallet={wallet}
      initialRange={initialRange}
      onTaskCreated={onTaskCreated}
    />
  );
}

export default function PoolCreatePositionModal() {
  return (
    <AccountSelectorProviderMirror
      config={{ sceneName: EAccountSelectorSceneName.home, sceneUrl: '' }}
      enabledNum={[0]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <PoolCreatePositionContent />
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
