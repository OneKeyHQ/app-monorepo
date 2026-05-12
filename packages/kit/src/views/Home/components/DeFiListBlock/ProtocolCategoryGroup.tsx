import { memo } from 'react';

import { Badge, SizableText, XStack, YStack } from '@onekeyhq/components';
import {
  type ILocalizedProtocolCategoryGroup,
  getProtocolPositionDisplayName,
} from '@onekeyhq/kit/src/utils/defiPositionUtils';

import { ProtocolSectionedPositionTable } from './ProtocolSectionedPositionTable';
import { ProtocolUnifiedTable } from './ProtocolUnifiedTable';

// Unified groups use the first column for the pool name. Sectioned groups
// reserve that column for Supplied/Borrowed/Rewards, so the pool name lives
// beside the type badge instead.

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
    if (group.kind === 'sectioned') {
      return (
        <YStack gap="$4">
          {group.positions.map((position) => {
            const positionDisplayName =
              getProtocolPositionDisplayName(position);

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
          rows={group.rows}
          currencySymbol={currencySymbol}
          priceUnavailableLabel={priceUnavailableLabel}
        />
      </YStack>
    );
  },
);

ProtocolCategoryGroup.displayName = 'ProtocolCategoryGroup';

export { ProtocolCategoryGroup };
