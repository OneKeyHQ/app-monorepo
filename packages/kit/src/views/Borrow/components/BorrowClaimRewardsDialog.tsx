import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, Dialog, XStack, YStack, useMedia } from '@onekeyhq/components';
import { useDialogInstance } from '@onekeyhq/components/src/composite/Dialog/hooks';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { shouldInvalidateAccountScopedData } from '@onekeyhq/kit/src/utils/accountUpdate';
import { isTaskAccountCurrent } from '@onekeyhq/kit/src/views/Earn/tasks/taskAccount';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type {
  IEarnBorrowUnclaimableReward,
  IEarnRewardClaimGroup,
  IEarnRewardClaimItem,
  IEarnRewardsDetails,
} from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';
import { BorrowTestIDs } from '../testIDs';

type IClaimItemProps = {
  item: IEarnRewardClaimItem;
  onClaim: (item: IEarnRewardClaimItem) => void;
  claimingItemId: string | null;
  claimingAllIds: string[];
  pendingClaimIds: string[];
};

function ClaimItem({
  item,
  onClaim,
  claimingItemId,
  claimingAllIds,
  pendingClaimIds,
}: IClaimItemProps) {
  const handlePress = useCallback(() => {
    onClaim(item);
  }, [item, onClaim]);

  // Loading if: single claim in progress, claim all in progress, or already pending
  const isLoading =
    claimingItemId === item.id ||
    claimingAllIds.includes(item.id) ||
    pendingClaimIds.includes(item.id);
  const claimButton = item.button;

  return (
    <XStack alignItems="center" gap="$3" py="$2">
      <Token size="md" tokenImageUri={item.token.logoURI} />
      <YStack flex={1} gap="$0.5">
        <EarnText text={item.title} size="$bodyMdMedium" color="$text" />
        {item.description ? (
          <EarnText
            text={item.description}
            size="$bodySm"
            color="$textSubdued"
          />
        ) : null}
      </YStack>
      {claimButton ? (
        <Button
          testID={BorrowTestIDs.claimItemBtn}
          size="small"
          variant="primary"
          disabled={claimButton.disabled || isLoading}
          loading={isLoading}
          onPress={handlePress}
        >
          {claimButton.text.text}
        </Button>
      ) : null}
    </XStack>
  );
}

type IClaimGroupProps = {
  group: IEarnRewardClaimGroup;
  onClaim: (item: IEarnRewardClaimItem) => void;
  claimingItemId: string | null;
  claimingAllIds: string[];
  pendingClaimIds: string[];
};

function ClaimGroup({
  group,
  onClaim,
  claimingItemId,
  claimingAllIds,
  pendingClaimIds,
}: IClaimGroupProps) {
  return (
    <YStack>
      {group.title ? (
        <EarnText
          text={group.title}
          size="$bodyMd"
          color="$textSubdued"
          mb="$2"
        />
      ) : null}
      {group.items.map((item) => (
        <ClaimItem
          key={item.id}
          item={item}
          onClaim={onClaim}
          claimingItemId={claimingItemId}
          claimingAllIds={claimingAllIds}
          pendingClaimIds={pendingClaimIds}
        />
      ))}
    </YStack>
  );
}

type IUnclaimableItemProps = {
  item: IEarnBorrowUnclaimableReward['items'][number];
};

function UnclaimableItem({ item }: IUnclaimableItemProps) {
  const dialogInstance = useDialogInstance();
  const handlePress = useCallback(async () => {
    const link = item.button?.data?.link;
    if (!link) return;

    await dialogInstance.close();
    void openUrlExternal(link);
  }, [dialogInstance, item.button?.data?.link]);

  return (
    <XStack alignItems="center" gap="$3" py="$2">
      <Token size="md" tokenImageUri={item.token.logoURI} />
      <YStack flex={1} gap="$0.5">
        <EarnText text={item.title} size="$bodyMdMedium" color="$text" />
        {item.description ? (
          <EarnText
            text={item.description}
            size="$bodySm"
            color="$textSubdued"
          />
        ) : null}
      </YStack>
      {item.button?.text ? (
        <Button
          testID={BorrowTestIDs.unclaimableItemBtn}
          size="small"
          variant="primary"
          onPress={handlePress}
          disabled={item.button.disabled}
          iconAfter="OpenOutline"
        >
          {item.button.text.text}
        </Button>
      ) : null}
    </XStack>
  );
}

type IUnclaimableGroupProps = {
  group: IEarnBorrowUnclaimableReward;
};

function UnclaimableGroup({ group }: IUnclaimableGroupProps) {
  return (
    <YStack>
      {group.title ? (
        <EarnText
          text={group.title}
          size="$bodyMd"
          color="$textSubdued"
          mb="$2"
          mt="$3"
        />
      ) : null}
      {group.items.map((item) => (
        <UnclaimableItem key={item.id} item={item} />
      ))}
    </YStack>
  );
}

type IBorrowClaimRewardsDialogContentProps = {
  rewardsDetails: IEarnRewardsDetails;
  pendingClaimIds: string[];
  accountId?: string;
  networkId?: string;
  accountAddress?: string;
  // Resolve false when the claim never started (the one-time risk disclaimer
  // was declined), so this dialog stays open instead of vanishing on cancel.
  onClaimItem: (item: IEarnRewardClaimItem) => Promise<boolean | void>;
  onClaimAll: () => Promise<boolean | void>;
};

function BorrowClaimRewardsDialogContent({
  rewardsDetails,
  pendingClaimIds,
  accountId,
  networkId,
  accountAddress,
  onClaimItem,
  onClaimAll,
}: IBorrowClaimRewardsDialogContentProps) {
  const intl = useIntl();
  const [loading, setLoading] = useState(false);
  const [claimingItemId, setClaimingItemId] = useState<string | null>(null);
  const [claimingAllIds, setClaimingAllIds] = useState<string[]>([]);
  const dialogInstance = useDialogInstance();
  const dialogRef = useRef(dialogInstance);
  dialogRef.current = dialogInstance;
  const { gtMd } = useMedia();
  const listMaxHeight = gtMd ? 520 : 360;

  useEffect(() => {
    let generation = 0;
    let active = true;
    const onAccountUpdate = (payload: unknown) => {
      if (!shouldInvalidateAccountScopedData(payload)) return;
      generation += 1;
      const request = generation;
      const verify = async () => {
        let current = false;
        if (accountId && networkId && accountAddress) {
          try {
            current = await isTaskAccountCurrent({
              accountId,
              networkId,
              accountAddress,
            });
          } catch {
            defaultLogger.app.error.log(
              'Unable to verify borrow rewards account',
            );
            current = false;
          }
        }
        if (active && request === generation && !current) {
          void dialogRef.current.close();
        }
      };
      void verify();
    };
    appEventBus.on(EAppEventBusNames.AccountUpdate, onAccountUpdate);
    return () => {
      active = false;
      appEventBus.off(EAppEventBusNames.AccountUpdate, onAccountUpdate);
    };
  }, [accountId, networkId, accountAddress]);

  const claimableGroups = useMemo(
    () => rewardsDetails.data.rewardsDetail.claimable ?? [],
    [rewardsDetails.data.rewardsDetail.claimable],
  );
  const unclaimableGroups = useMemo(
    () => rewardsDetails.data.rewardsDetail.unclaimable ?? [],
    [rewardsDetails.data.rewardsDetail.unclaimable],
  );
  const claimAllButton = rewardsDetails.data.rewardsDetail.button;

  const handleClaimItem = useCallback(
    async (item: IEarnRewardClaimItem) => {
      setClaimingItemId(item.id);
      try {
        const started = await onClaimItem(item);
        if (started !== false) {
          void dialogInstance.close();
        }
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message === 'Borrow transaction confirmation expired' ||
            error.message === 'Borrow account changed')
        ) {
          void dialogInstance.close();
        } else {
          throw error;
        }
      } finally {
        setClaimingItemId(null);
      }
    },
    [onClaimItem, dialogInstance],
  );

  const pendingSet = useMemo(() => new Set(pendingClaimIds), [pendingClaimIds]);

  const actionableIds = useMemo(() => {
    return claimableGroups.flatMap((group) =>
      group.items
        .filter((item) => !pendingSet.has(item.id))
        .map((item) => item.id),
    );
  }, [claimableGroups, pendingSet]);

  const hasClaimableItems = useMemo(
    () => claimableGroups.some((group) => group.items.length > 0),
    [claimableGroups],
  );

  const hasPendingClaimItems = useMemo(
    () =>
      claimableGroups.some((group) =>
        group.items.some((item) => pendingSet.has(item.id)),
      ),
    [claimableGroups, pendingSet],
  );

  const canClaimAll = hasClaimableItems && !hasPendingClaimItems;

  const handleClaimAll = useCallback(async () => {
    if (!canClaimAll || actionableIds.length === 0) {
      return;
    }
    setClaimingAllIds(actionableIds);
    setLoading(true);
    try {
      const started = await onClaimAll();
      if (started !== false) {
        void dialogInstance.close();
      }
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === 'Borrow transaction confirmation expired' ||
          error.message === 'Borrow account changed')
      ) {
        void dialogInstance.close();
      } else {
        throw error;
      }
    } finally {
      setLoading(false);
      setClaimingAllIds([]);
    }
  }, [actionableIds, canClaimAll, dialogInstance, onClaimAll]);

  return (
    <YStack gap="$4">
      <Dialog.ScrollView maxHeight={listMaxHeight} mx="$-5" px="$5">
        <YStack gap="$2">
          {claimableGroups.map((group, index) => (
            <ClaimGroup
              key={index}
              group={group}
              onClaim={handleClaimItem}
              claimingItemId={claimingItemId}
              claimingAllIds={claimingAllIds}
              pendingClaimIds={pendingClaimIds}
            />
          ))}
          {unclaimableGroups.map((group, index) => (
            <UnclaimableGroup key={`unclaimable-${index}`} group={group} />
          ))}
        </YStack>
      </Dialog.ScrollView>

      {hasClaimableItems ? (
        <Dialog.Footer
          showCancelButton
          showConfirmButton={Boolean(claimAllButton)}
          confirmButtonProps={{
            testID: BorrowTestIDs.claimAllBtn,
            disabled:
              loading ||
              rewardsDetails.disabled ||
              claimAllButton?.disabled ||
              !canClaimAll,
            loading,
          }}
          onConfirm={handleClaimAll}
          onConfirmText={
            claimAllButton?.text.text ??
            intl.formatMessage({
              id: ETranslations.defi_claim_all,
            })
          }
        />
      ) : null}
    </YStack>
  );
}

export function showBorrowClaimRewardsDialog({
  rewardsDetails,
  pendingClaimIds = [],
  accountId,
  networkId,
  accountAddress,
  onClaimItem,
  onClaimAll,
  onClose,
}: {
  rewardsDetails: IEarnRewardsDetails;
  pendingClaimIds?: string[];
  accountId?: string;
  networkId?: string;
  accountAddress?: string;
  // See the content props: false keeps this dialog open, for a claim that never
  // started because the risk disclaimer was declined.
  onClaimItem: (item: IEarnRewardClaimItem) => Promise<boolean | void>;
  onClaimAll: () => Promise<boolean | void>;
  onClose?: () => void;
}) {
  return Dialog.show({
    // eslint-disable-next-line onekey/no-app-locale-main-thread
    title: appLocale.intl.formatMessage({
      id: ETranslations.defi_claimable_rewards,
    }),
    showFooter: false,
    onClose,
    renderContent: (
      <BorrowClaimRewardsDialogContent
        rewardsDetails={rewardsDetails}
        pendingClaimIds={pendingClaimIds}
        accountId={accountId}
        networkId={networkId}
        accountAddress={accountAddress}
        onClaimItem={onClaimItem}
        onClaimAll={onClaimAll}
      />
    ),
  });
}
