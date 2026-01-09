import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, Dialog, XStack, YStack } from '@onekeyhq/components';
import { useDialogInstance } from '@onekeyhq/components/src/composite/Dialog/hooks';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import type {
  IEarnRewardClaimGroup,
  IEarnRewardClaimItem,
  IEarnRewardsDetails,
} from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';

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
  const disabled = item.button.disabled || isLoading;

  return (
    <XStack alignItems="center" gap="$3" py="$2">
      <Token size="lg" tokenImageUri={item.token.logoURI} />
      <YStack flex={1} gap="$0.5">
        <EarnText text={item.title} size="$bodyLgMedium" color="$text" />
        {item.description ? (
          <EarnText
            text={item.description}
            size="$bodySm"
            color="$textSubdued"
          />
        ) : null}
      </YStack>
      <Button
        size="small"
        variant="secondary"
        disabled={disabled}
        loading={isLoading}
        onPress={handlePress}
      >
        <EarnText text={item.button.text} size="$bodyMdMedium" />
      </Button>
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

type IBorrowClaimRewardsDialogContentProps = {
  rewardsDetails: IEarnRewardsDetails;
  pendingClaimIds: string[];
  onClaimItem: (item: IEarnRewardClaimItem) => Promise<void>;
  onClaimAll: () => Promise<void>;
};

function BorrowClaimRewardsDialogContent({
  rewardsDetails,
  pendingClaimIds,
  onClaimItem,
  onClaimAll,
}: IBorrowClaimRewardsDialogContentProps) {
  const intl = useIntl();
  const [loading, setLoading] = useState(false);
  const [claimingItemId, setClaimingItemId] = useState<string | null>(null);
  const [claimingAllIds, setClaimingAllIds] = useState<string[]>([]);
  const dialogInstance = useDialogInstance();

  const claimableGroups = rewardsDetails.data.rewardsDetail.claimable;

  const handleClaimItem = useCallback(
    async (item: IEarnRewardClaimItem) => {
      setClaimingItemId(item.id);
      try {
        await onClaimItem(item);
        void dialogInstance.close();
      } finally {
        setClaimingItemId(null);
      }
    },
    [onClaimItem, dialogInstance],
  );

  const handleClaimAll = useCallback(async () => {
    // Collect all item IDs and set them as loading
    const allIds = claimableGroups.flatMap((group) =>
      group.items.map((item) => item.id),
    );
    setClaimingAllIds(allIds);
    setLoading(true);
    try {
      await onClaimAll();
    } finally {
      setLoading(false);
      setClaimingAllIds([]);
    }
  }, [onClaimAll, claimableGroups]);

  const hasClaimableItems = claimableGroups.some(
    (group) => group.items.length > 0,
  );

  return (
    <YStack gap="$4">
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
      </YStack>

      <Dialog.Footer
        showCancelButton
        showConfirmButton={hasClaimableItems}
        confirmButtonProps={{
          disabled: loading || rewardsDetails.disabled,
          loading,
        }}
        onConfirm={handleClaimAll}
        onConfirmText={intl.formatMessage({ id: ETranslations.defi_claim_all })}
      />
    </YStack>
  );
}

export function showBorrowClaimRewardsDialog({
  rewardsDetails,
  pendingClaimIds = [],
  onClaimItem,
  onClaimAll,
  onClose,
}: {
  rewardsDetails: IEarnRewardsDetails;
  pendingClaimIds?: string[];
  onClaimItem: (item: IEarnRewardClaimItem) => Promise<void>;
  onClaimAll: () => Promise<void>;
  onClose?: () => void;
}) {
  return Dialog.show({
    title: appLocale.intl.formatMessage({
      id: ETranslations.defi_claimable_rewards,
    }),
    showFooter: false,
    onClose,
    renderContent: (
      <BorrowClaimRewardsDialogContent
        rewardsDetails={rewardsDetails}
        pendingClaimIds={pendingClaimIds}
        onClaimItem={onClaimItem}
        onClaimAll={onClaimAll}
      />
    ),
  });
}
