import {
  type ComponentProps,
  type ReactElement,
  useCallback,
  useMemo,
} from 'react';

import { useIntl } from 'react-intl';
import { type GestureResponderEvent, StyleSheet } from 'react-native';

import type { ColorTokens, IKeyOfIcons } from '@onekeyhq/components';
import {
  Dialog,
  Icon,
  SizableText,
  Tooltip,
  XStack,
  YStack,
  useThemeName,
} from '@onekeyhq/components';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { formatDateFns } from '@onekeyhq/shared/src/utils/dateUtils';

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
  const themeName = useThemeName() as 'light' | 'dark';
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
  let textColor: ColorTokens = themeName === 'light' ? '$brand12' : '$brand11';

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
      {isDeviceLimitExceeded ? (
        <Icon name="InfoCircleOutline" size="$3.5" color={iconColor} />
      ) : null}
    </XStack>
  );
}

type IPrimeStatusMetaBase = {
  title?: string;
  dialogTitle: string;
  lines: string[];
  isDeviceLimitExceeded?: boolean;
};

type IPrimeStatusMeta =
  | (IPrimeStatusMetaBase & {
      type: 'warning';
      icon: IKeyOfIcons;
      tone: 'warning';
    })
  | (IPrimeStatusMetaBase & {
      type: 'prime';
      renderIcon: ReactElement;
    });

function PrimeStatusTooltipContent({ status }: { status: IPrimeStatusMeta }) {
  return (
    <YStack gap="$1">
      {status.title ? (
        <SizableText
          size="$bodySmMedium"
          color={status.isDeviceLimitExceeded ? '$textCaution' : '$text'}
        >
          {status.title}
        </SizableText>
      ) : null}
      {status.lines.map((line) => (
        <SizableText key={line} size="$bodySm" color="$textSubdued">
          {line}
        </SizableText>
      ))}
    </YStack>
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
  const primeIcon = usePrimeIconName();

  const isPrime = user?.primeSubscription?.isActive;
  const isDeviceLimitExceeded =
    isPrime && user?.isPrimeDeviceLimitExceeded === true;
  const primeExpiredAt = user?.primeSubscription?.expiresAt;

  const statusMeta = useMemo<IPrimeStatusMeta | undefined>(() => {
    if (!isPrime) {
      return undefined;
    }

    const formattedExpiresAt = primeExpiredAt
      ? formatDateFns(new Date(primeExpiredAt))
      : undefined;

    if (isDeviceLimitExceeded) {
      const title = intl.formatMessage({
        id: ETranslations.prime_device_limit_reached,
      });
      const lines = [
        intl.formatMessage({
          id: ETranslations.prime_device_limit_reached_desc,
        }),
      ];

      if (formattedExpiresAt) {
        lines.push(
          intl.formatMessage(
            {
              id: ETranslations.prime_membership_valid_until__desc,
            },
            {
              date: formattedExpiresAt,
            },
          ),
        );
      }

      return {
        type: 'warning',
        title,
        dialogTitle: title,
        lines,
        icon: 'InfoCircleOutline',
        tone: 'warning',
        isDeviceLimitExceeded: true,
      };
    }

    if (!formattedExpiresAt) {
      return undefined;
    }

    return {
      type: 'prime',
      dialogTitle: intl.formatMessage({
        id: ETranslations.prime_status_prime,
      }),
      lines: [
        intl.formatMessage(
          {
            id: ETranslations.prime_end_date,
          },
          {
            data: formattedExpiresAt,
          },
        ),
      ],
      renderIcon: <Icon name={primeIcon} size="$8" />,
    };
  }, [intl, isDeviceLimitExceeded, isPrime, primeExpiredAt, primeIcon]);

  const canShowPrimeStatus = Boolean(statusMeta);
  const shouldOpenStatusDialog =
    canShowPrimeStatus && (platformEnv.isNative || platformEnv.isWebMobile);

  const handlePrimeStatusPress = useCallback(
    (e?: GestureResponderEvent) => {
      e?.stopPropagation();
      if (!statusMeta) {
        return;
      }
      const dialogIconProps =
        statusMeta.type === 'warning'
          ? { icon: statusMeta.icon, tone: statusMeta.tone }
          : { renderIcon: statusMeta.renderIcon };

      Dialog.show({
        ...dialogIconProps,
        title: statusMeta.dialogTitle,
        description: statusMeta.lines.join('\n'),
        showCancelButton: false,
        onConfirmText: intl.formatMessage({
          id: ETranslations.global_got_it,
        }),
      });
    },
    [intl, statusMeta],
  );

  if (!isPrime && !showFreeStatus) return null;

  const badge = (
    <PrimeBadge
      status={isPrime ? 'prime' : 'free'}
      isDeviceLimitExceeded={isDeviceLimitExceeded}
      icon={primeIcon}
      showIcon={showIcon}
      onPress={shouldOpenStatusDialog ? handlePrimeStatusPress : undefined}
    />
  );

  if (!statusMeta || shouldOpenStatusDialog) {
    return badge;
  }

  return (
    <Tooltip
      renderTrigger={badge}
      renderContent={<PrimeStatusTooltipContent status={statusMeta} />}
    />
  );
}
