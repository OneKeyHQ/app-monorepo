import { memo } from 'react';

import { Badge, YStack } from '@onekeyhq/components';
import type { ILocalizedProtocolCategoryGroup } from '@onekeyhq/kit/src/utils/defiPositionUtils';

import { ProtocolSectionedPositionTable } from './ProtocolSectionedPositionTable';
import { ProtocolUnifiedTable } from './ProtocolUnifiedTable';

// One badge + one block per group. A category that mixes clean and
// debt-bearing positions is emitted upstream as two adjacent groups
// (each with its own badge), so the leveraged/CDP block reads as a
// distinct surface instead of being nested under the clean rows.

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
        {group.kind === 'sectioned' ? (
          <YStack gap="$4">
            {group.positions.map((position) => (
              <ProtocolSectionedPositionTable
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
          />
        )}
      </YStack>
    );
  },
);

ProtocolCategoryGroup.displayName = 'ProtocolCategoryGroup';

export { ProtocolCategoryGroup };
