import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Icon,
  IconButton,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IAddressRiskCheckRecentItem } from '@onekeyhq/shared/types/addressRiskCheck';

import {
  LEVEL_BADGE_TYPE,
  LEVEL_TITLE,
  formatRiskCheckDate,
} from './RiskCheckShared';

export function RecentCheckItem({
  item,
  networkName,
  onPress,
  onDelete,
}: {
  item: IAddressRiskCheckRecentItem;
  networkName?: string;
  onPress: (item: IAddressRiskCheckRecentItem) => void;
  onDelete?: (item: IAddressRiskCheckRecentItem) => void;
}) {
  const intl = useIntl();

  const handlePress = useCallback(() => onPress(item), [onPress, item]);
  const handleDelete = useCallback(() => onDelete?.(item), [onDelete, item]);

  return (
    <XStack
      role="button"
      ai="center"
      gap="$3"
      px="$5"
      py="$2.5"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={handlePress}
    >
      <AccountAvatar
        size="default"
        address={item.address}
        networkId={item.networkId}
      />
      <YStack flex={1} gap="$0.5" minWidth={0}>
        <SizableText size="$bodyLgMedium" numberOfLines={1}>
          {accountUtils.shortenAddress({ address: item.address })}
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
          {networkName ?? ''}
        </SizableText>
      </YStack>
      <YStack ai="flex-end" gap="$1" flexShrink={0}>
        <Badge badgeType={LEVEL_BADGE_TYPE[item.level]} badgeSize="sm">
          <Badge.Text>
            {intl.formatMessage({ id: LEVEL_TITLE[item.level] })}
          </Badge.Text>
        </Badge>
        <SizableText size="$bodySm" color="$textSubdued">
          {formatRiskCheckDate(item.checkedAt, { withTime: true })}
        </SizableText>
      </YStack>
      {onDelete ? (
        <IconButton
          testID="address-risk-check-recent-delete"
          variant="tertiary"
          size="small"
          icon="DeleteOutline"
          onPress={handleDelete}
        />
      ) : (
        <Icon name="ChevronRightSmallOutline" size="$5" color="$iconSubdued" />
      )}
    </XStack>
  );
}
