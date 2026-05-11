import { memo } from 'react';

import { Badge, YStack } from '@onekeyhq/components';
import type { ILocalizedProtocolCategoryGroup } from '@onekeyhq/kit/src/utils/defiPositionUtils';

import { ProtocolLendingPositionTable } from './ProtocolLendingPositionTable';
import { ProtocolUnifiedTable } from './ProtocolUnifiedTable';

// One-stop renderer for a category subgroup inside a protocol card. Lending
// expands into N tables (one per position) so each can carry its own pool /
// market label; every other category collapses into a single unified table
// built upstream by the category grouping helper.

type IProtocolCategoryGroupProps = {
  group: ILocalizedProtocolCategoryGroup;
  currencySymbol: string;
  priceUnavailableLabel: string;
};

const ProtocolCategoryGroup = memo(
  ({
    group,
    currencySymbol,
    priceUnavailableLabel,
  }: IProtocolCategoryGroupProps) => {
    return (
      <YStack gap="$2">
        <YStack px="$5" pt="$3">
          <Badge badgeType="success" badgeSize="lg" alignSelf="flex-start">
            {group.categoryLabel}
          </Badge>
        </YStack>
        {group.kind === 'lending' ? (
          <YStack gap="$4">
            {group.positions.map((position) => (
              <ProtocolLendingPositionTable
                key={position.positionKey}
                position={position}
                currencySymbol={currencySymbol}
                priceUnavailableLabel={priceUnavailableLabel}
              />
            ))}
          </YStack>
        ) : (
          <ProtocolUnifiedTable
            rows={group.rows}
            currencySymbol={currencySymbol}
            priceUnavailableLabel={priceUnavailableLabel}
          />
        )}
      </YStack>
    );
  },
);

ProtocolCategoryGroup.displayName = 'ProtocolCategoryGroup';

export { ProtocolCategoryGroup };
