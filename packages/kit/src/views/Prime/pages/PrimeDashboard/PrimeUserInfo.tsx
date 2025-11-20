import { type ComponentProps } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Badge,
  Dialog,
  Icon,
  SizableText,
  Toast,
  XStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAppUpdateRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';

import { usePrimeAuthV2 } from '../../hooks/usePrimeAuthV2';

import { PrimeUserInfoMoreButton } from './PrimeUserInfoMoreButton';

export function PrimeUserBadge() {
  const intl = useIntl();
  const { user } = usePrimeAuthV2();
  const navigation = useAppNavigation();

  const isPrime = user?.primeSubscription?.isActive;
  if (!isPrime) return null;

  if (user?.isPrimeDeviceLimitExceeded === true) {
    return (
      <Badge
        onPress={() => {
          Dialog.show({
            title: intl.formatMessage({
              id: ETranslations.prime_prime_access_limit_reached,
            }),
            description: intl.formatMessage(
              {
                id: ETranslations.global_exceeded_device_limit_for_prime,
              },
              {
                number: 5,
              },
            ),
            onConfirmText: intl.formatMessage({
              id: ETranslations.update_update_now,
            }),
            onConfirm: () => {
              navigation.pushModal(EModalRoutes.AppUpdateModal, {
                screen: EAppUpdateRoutes.UpdatePreview,
              });
            },
            onCancelText: intl.formatMessage({
              id: ETranslations.global_got_it,
            }),
          });
        }}
        badgeType="warning"
        badgeSize="sm"
      >
        <Badge.Text userSelect="none">
          {intl.formatMessage({
            id: ETranslations.prime_status_prime,
          })}
        </Badge.Text>
        <Icon
          name="InfoCircleOutline"
          color="$iconSubdued"
          size="$4"
          ml="$1.5"
        />
      </Badge>
    );
  }

  return (
    <Badge bg="$brand3" badgeSize="sm">
      <Badge.Text color="$brand11">
        {intl.formatMessage({
          id: ETranslations.prime_status_prime,
        })}
      </Badge.Text>
    </Badge>
  );
}

export function PrimeUserInfo({
  onLogoutSuccess,
  ...stackProps
}: {
  onLogoutSuccess?: () => Promise<void>;
} & ComponentProps<typeof XStack>) {
  const { user } = usePrimeAuthV2();
  return (
    <XStack
      alignItems="center"
      gap="$2"
      px="$3.5"
      py={13}
      bg="$bg"
      borderWidth={StyleSheet.hairlineWidth}
      borderRadius="$3"
      flexWrap="wrap"
      borderColor="$borderSubdued"
      borderCurve="continuous"
      elevation={0.5}
      {...stackProps}
    >
      <Icon name="PeopleOutline" color="$iconSubdued" size="$5" />
      <SizableText
        onPress={() => {
          // console.log(privy?.web?.user);
          // console.log(privy?.native?.user);
        }}
        flex={1}
        size="$bodyMdMedium"
        ellipsizeMode="middle"
        ellipse
      >
        {user?.displayEmail}
      </SizableText>
      <PrimeUserBadge />
      <PrimeUserInfoMoreButton onLogoutSuccess={onLogoutSuccess} />
    </XStack>
  );
}
