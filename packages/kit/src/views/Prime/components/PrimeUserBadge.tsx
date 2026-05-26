import { type ComponentProps, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { type GestureResponderEvent, StyleSheet } from 'react-native';

import type { ColorTokens, IKeyOfIcons } from '@onekeyhq/components';
import {
  Dialog,
  Icon,
  SizableText,
  XStack,
  useThemeName,
} from '@onekeyhq/components';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAppUpdateRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';

export function usePrimeIconName() {
  const { user } = useOneKeyAuth();
  const themeName = useThemeName() as 'light' | 'dark';
  const isPrime = user?.primeSubscription?.isActive;

  return useMemo<IKeyOfIcons>(() => {
    if (isPrime && user?.onekeyUserId) {
      return themeName === 'light'
        ? 'OnekeyPrimeLightColored'
        : 'OnekeyPrimeDarkColored';
    }
    return 'PrimeOutline';
  }, [isPrime, themeName, user?.onekeyUserId]);
}

export function isPrimeColoredIcon(icon: IKeyOfIcons) {
  return (
    icon === 'OnekeyPrimeLightColored' || icon === 'OnekeyPrimeDarkColored'
  );
}

type IPrimeBadgeProps = Omit<ComponentProps<typeof XStack>, 'onPress'> & {
  icon?: IKeyOfIcons;
  isDeviceLimitExceeded?: boolean;
  showIcon?: boolean;
  status?: 'prime' | 'free';
  onPress?: ComponentProps<typeof XStack>['onPress'];
};

export function PrimeBadge({
  icon,
  isDeviceLimitExceeded,
  showIcon = true,
  status = 'prime',
  onPress,
  ...props
}: IPrimeBadgeProps) {
  const intl = useIntl();
  const isFree = status === 'free' && !isDeviceLimitExceeded;

  let displayIcon = icon ?? 'PrimeOutline';
  if (isDeviceLimitExceeded) {
    displayIcon = 'PrimeSolid';
  } else if (isFree) {
    displayIcon = 'PrimeOutline';
  }

  let borderColor: ColorTokens = '$brand4';
  let bg: ColorTokens = '$brand2';
  let iconColor: ColorTokens = '$brand11';
  let textColor: ColorTokens = '$brand12';

  if (isDeviceLimitExceeded) {
    borderColor = '$borderCautionSubdued';
    bg = '$bgCautionSubdued';
    iconColor = '$iconCaution';
    textColor = '$textCaution';
  } else if (isFree) {
    borderColor = '$neutral3';
    bg = '$bgSubdued';
    iconColor = '$iconSubdued';
    textColor = '$textSubdued';
  }

  const shouldRenderColoredIcon =
    !isDeviceLimitExceeded && isPrimeColoredIcon(displayIcon);

  return (
    <XStack
      ai="center"
      jc="center"
      gap="$1"
      h={22}
      px="$2"
      borderRadius="$full"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor={borderColor}
      bg={bg}
      opacity={isDeviceLimitExceeded ? 0.7 : 1}
      flexShrink={0}
      onPress={onPress}
      role={!onPress ? undefined : 'button'}
      {...props}
    >
      {showIcon ? (
        <Icon
          name={displayIcon}
          size="$4"
          {...(shouldRenderColoredIcon ? undefined : { color: iconColor })}
        />
      ) : null}
      <SizableText size="$bodySmMedium" color={textColor} userSelect="none">
        {intl.formatMessage({
          id: isFree
            ? ETranslations.prime_status_free
            : ETranslations.prime_status_prime,
        })}
      </SizableText>
    </XStack>
  );
}

export function PrimeUserBadge({
  showFreeStatus = true,
  showIcon = true,
}: {
  showFreeStatus?: boolean;
  showIcon?: boolean;
}) {
  const intl = useIntl();
  const { user } = useOneKeyAuth();
  const navigation = useAppNavigation();
  const primeIcon = usePrimeIconName();

  const isPrime = user?.primeSubscription?.isActive;
  const isDeviceLimitExceeded =
    isPrime && user?.isPrimeDeviceLimitExceeded === true;

  const handleDeviceLimitExceeded = useCallback(
    (e?: GestureResponderEvent) => {
      e?.stopPropagation();
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
    },
    [intl, navigation],
  );

  if (!isPrime && !showFreeStatus) return null;

  return (
    <PrimeBadge
      status={isPrime ? 'prime' : 'free'}
      isDeviceLimitExceeded={isDeviceLimitExceeded}
      icon={primeIcon}
      showIcon={showIcon}
      onPress={isDeviceLimitExceeded ? handleDeviceLimitExceeded : undefined}
    />
  );
}
