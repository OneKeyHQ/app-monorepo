import { memo } from 'react';

import { Badge, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ProtocolPositionActionButton } from '@onekeyhq/kit/src/components/DeFi/ProtocolPositionActionButton';
import type { IProtocolPositionActionSuccessParams } from '@onekeyhq/kit/src/components/DeFi/ProtocolPositionActionDialog';
import {
  type ILocalizedProtocolCategoryGroup,
  type ILocalizedProtocolPositionItem,
  getProtocolPositionDisplayName,
} from '@onekeyhq/kit/src/utils/defiPositionUtils';
import type {
  IDeFiProtocol,
  IDeFiSupportedProtocolAction,
} from '@onekeyhq/shared/types/defi';

import { ProtocolSectionedPositionTable } from './ProtocolSectionedPositionTable';
import { ProtocolUnifiedTable } from './ProtocolUnifiedTable';

// Unified groups use the first column for the pool name. Sectioned groups
// reserve that column for Supplied/Borrowed/Rewards, so the pool name lives
// beside the type badge instead.

function buildActionPosition(
  position: ILocalizedProtocolPositionItem,
): IDeFiProtocol['positions'][number] {
  return {
    groupId: position.groupId,
    category: position.category,
    poolName: position.poolName ?? '',
    poolFullName: position.poolFullName ?? position.poolName ?? '',
    value: position.value,
    assets: position.sections
      .filter(
        (section) =>
          section.assetType === 'supplied' || section.assetType === 'other',
      )
      .flatMap((section) => section.assets),
    debts: position.sections
      .filter((section) => section.assetType === 'borrowed')
      .flatMap((section) => section.assets),
    rewards: position.sections
      .filter((section) => section.assetType === 'rewards')
      .flatMap((section) => section.assets),
    sourcePositions: position.sourcePositions,
  };
}

type IProtocolCategoryGroupProps = {
  accountId?: string;
  indexedAccountId?: string;
  protocol: IDeFiProtocol;
  group: ILocalizedProtocolCategoryGroup;
  currencySymbol: string;
  priceUnavailableLabel: string;
  partialPriceUnavailableLabel: string;
  supportedActions: IDeFiSupportedProtocolAction[];
  onActionSuccess?: (
    params: IProtocolPositionActionSuccessParams,
  ) => void | Promise<void>;
};

const ProtocolCategoryGroup = memo(
  ({
    accountId,
    indexedAccountId,
    protocol,
    group,
    currencySymbol,
    priceUnavailableLabel,
    partialPriceUnavailableLabel,
    supportedActions,
    onActionSuccess,
  }: IProtocolCategoryGroupProps) => {
    if (group.kind === 'sectioned') {
      return (
        <YStack gap="$4">
          {group.positions.map((position) => {
            const positionDisplayName =
              getProtocolPositionDisplayName(position);
            const actionPosition = buildActionPosition(position);

            return (
              <YStack key={position.positionKey} gap="$2">
                <XStack
                  px="$5"
                  pt="$3"
                  alignItems="center"
                  gap="$2"
                  minWidth={0}
                >
                  <Badge
                    badgeType="success"
                    badgeSize="lg"
                    alignSelf="flex-start"
                    flexShrink={0}
                  >
                    {group.categoryLabel}
                  </Badge>
                  {positionDisplayName ? (
                    <SizableText
                      size="$bodyMdMedium"
                      color="$text"
                      numberOfLines={1}
                      flex={1}
                      minWidth={0}
                    >
                      {positionDisplayName}
                    </SizableText>
                  ) : null}
                </XStack>
                <ProtocolSectionedPositionTable
                  position={position}
                  currencySymbol={currencySymbol}
                  priceUnavailableLabel={priceUnavailableLabel}
                />
                <ProtocolPositionActionButton
                  accountId={accountId}
                  indexedAccountId={indexedAccountId}
                  protocol={protocol}
                  position={actionPosition}
                  supportedActions={supportedActions}
                  containerProps={{ alignSelf: 'flex-end', mx: '$5' }}
                  onSuccess={onActionSuccess}
                />
              </YStack>
            );
          })}
        </YStack>
      );
    }

    return (
      <YStack gap="$2">
        <YStack px="$5" pt="$3">
          <Badge badgeType="success" badgeSize="lg" alignSelf="flex-start">
            {group.categoryLabel}
          </Badge>
        </YStack>
        <ProtocolUnifiedTable
          accountId={accountId}
          indexedAccountId={indexedAccountId}
          protocol={protocol}
          rows={group.rows}
          currencySymbol={currencySymbol}
          priceUnavailableLabel={priceUnavailableLabel}
          partialPriceUnavailableLabel={partialPriceUnavailableLabel}
          supportedActions={supportedActions}
          onActionSuccess={onActionSuccess}
        />
      </YStack>
    );
  },
);

ProtocolCategoryGroup.displayName = 'ProtocolCategoryGroup';

export { ProtocolCategoryGroup };
