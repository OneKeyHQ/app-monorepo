import { useCallback, useState } from 'react';

import { Button, Dialog, XStack, YStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import type {
  IEarnRewardClaimGroup,
  IEarnRewardClaimItem,
  IEarnRewardsDetails,
} from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';

type IClaimItemProps = {
  item: IEarnRewardClaimItem;
  onClaim: (item: IEarnRewardClaimItem) => void;
  loading?: boolean;
};

function ClaimItem({ item, onClaim, loading }: IClaimItemProps) {
  const handlePress = useCallback(() => {
    onClaim(item);
  }, [item, onClaim]);

  const disabled = item.button.disabled || loading;

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
  loading?: boolean;
};

function ClaimGroup({ group, onClaim, loading }: IClaimGroupProps) {
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
          loading={loading}
        />
      ))}
    </YStack>
  );
}

type IBorrowClaimRewardsDialogContentProps = {
  rewardsDetails: IEarnRewardsDetails;
  onClaimItem: (item: IEarnRewardClaimItem) => Promise<void>;
  onClaimAll: () => Promise<void>;
};

function BorrowClaimRewardsDialogContent({
  rewardsDetails,
  onClaimItem,
  onClaimAll,
}: IBorrowClaimRewardsDialogContentProps) {
  const [loading, setLoading] = useState(false);
  const [claimingItemId, setClaimingItemId] = useState<string | null>(null);

  const claimableGroups = rewardsDetails.data.rewardsDetail.claimable;

  const handleClaimItem = useCallback(
    async (item: IEarnRewardClaimItem) => {
      setClaimingItemId(item.id);
      try {
        await onClaimItem(item);
      } finally {
        setClaimingItemId(null);
      }
    },
    [onClaimItem],
  );

  const handleClaimAll = useCallback(async () => {
    setLoading(true);
    try {
      await onClaimAll();
    } finally {
      setLoading(false);
    }
  }, [onClaimAll]);

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
            loading={claimingItemId !== null}
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
        onConfirmText="Claim all"
      />
    </YStack>
  );
}

export function showBorrowClaimRewardsDialog({
  rewardsDetails,
  onClaimItem,
  onClaimAll,
  onClose,
}: {
  rewardsDetails: IEarnRewardsDetails;
  onClaimItem: (item: IEarnRewardClaimItem) => Promise<void>;
  onClaimAll: () => Promise<void>;
  onClose?: () => void;
}) {
  return Dialog.show({
    title: 'Claimable rewards',
    showFooter: false,
    onClose,
    renderContent: (
      <BorrowClaimRewardsDialogContent
        rewardsDetails={rewardsDetails}
        onClaimItem={onClaimItem}
        onClaimAll={onClaimAll}
      />
    ),
  });
}
