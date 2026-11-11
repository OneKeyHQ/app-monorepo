import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Divider,
  IconButton,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatarBase } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { AccountManagerTestIDs } from '@onekeyhq/kit/src/views/AccountManagerStacks/testIDs';
import { presetNetworksMap } from '@onekeyhq/shared/src/config/presetNetworks';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function PrivacyAccountRow({
  accountId,
  accountName,
  networkId,
  subtitle,
  action,
  birthday,
  showBirthday,
  birthdayDisabled,
  deleteDisabled,
  onEditBirthday,
  onDelete,
  children,
}: {
  accountId: string;
  accountName: string;
  networkId: string;
  subtitle: string;
  action?: ReactNode;
  birthday?: string;
  showBirthday?: boolean;
  birthdayDisabled?: boolean;
  deleteDisabled?: boolean;
  onEditBirthday: () => void;
  onDelete: () => void;
  children?: ReactNode;
}) {
  const intl = useIntl();
  const network = Object.values(presetNetworksMap).find(
    (item) => item.id === networkId,
  );
  const networkName = network?.name ?? networkId;
  const deleteLabel = intl.formatMessage({
    id: ETranslations.privacy_delete_data__title,
  });

  return (
    <YStack
      mx="$5"
      mb="$3"
      borderRadius="$3"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      overflow="hidden"
    >
      <ListItem
        mx="$0"
        py="$3"
        testID={AccountManagerTestIDs.privacyNetworkAccount(accountId)}
        renderAvatar={
          <YStack
            accessible
            accessibilityRole="image"
            accessibilityLabel={networkName}
          >
            <NetworkAvatarBase
              logoURI={network?.logoURI ?? ''}
              networkName={networkName}
              size="$6"
            />
          </YStack>
        }
        renderItemText={
          <YStack flex={1} minWidth={0}>
            <SizableText
              size="$bodyLgMedium"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {accountName}
            </SizableText>
            <SizableText
              size="$bodyMd"
              color="$textSubdued"
              numberOfLines={2}
              minHeight="$10"
            >
              {subtitle}
            </SizableText>
          </YStack>
        }
      >
        <XStack alignItems="center" gap="$2" flexShrink={0}>
          {action}
          <IconButton
            testID={`privacy-network-delete-${accountId}`}
            icon="DeleteOutline"
            title={deleteLabel}
            aria-label={deleteLabel}
            hotKey
            variant="tertiary"
            size="medium"
            m="$0"
            disabled={deleteDisabled}
            onPress={onDelete}
          />
        </XStack>
      </ListItem>
      <YStack testID={`privacy-network-account-detail-${accountId}`}>
        {children}
        {showBirthday ? (
          <>
            <Divider mx="$3" />
            <ListItem
              mx="$0"
              testID={`privacy-network-birthday-${accountId}`}
              icon="Calendar2Outline"
              iconProps={{ size: '$5' }}
              title={intl.formatMessage({
                id: ETranslations.privacy_sync_start__title,
              })}
              titleProps={{ size: '$bodyMd', color: '$textSubdued' }}
              disabled={birthdayDisabled}
              drillIn
              onPress={onEditBirthday}
            >
              <SizableText size="$bodyMd" color="$textSubdued" flexShrink={1}>
                {birthday}
              </SizableText>
            </ListItem>
          </>
        ) : null}
      </YStack>
    </YStack>
  );
}
