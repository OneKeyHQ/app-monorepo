import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { ColorTokens, IKeyOfIcons } from '@onekeyhq/components';
import {
  Dialog,
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

type IInfoItemProps = {
  icon: IKeyOfIcons;
  iconColor: ColorTokens;
  title: string;
  description: string;
};

function InfoItem({ icon, iconColor, title, description }: IInfoItemProps) {
  return (
    <XStack gap="$3" alignItems="center">
      <Icon name={icon} size="$6" color={iconColor} />
      <YStack gap="$1" flex={1}>
        <SizableText size="$bodyLgMedium">{title}</SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {description}
        </SizableText>
      </YStack>
    </XStack>
  );
}

function InfoSection({
  title,
  items,
}: {
  title: string;
  items: IInfoItemProps[];
}) {
  return (
    <YStack gap="$3" p="$4" bg="$bgSubdued" borderRadius="$4">
      <SizableText size="$headingSm" color="$textSubdued">
        {title}
      </SizableText>
      <YStack gap="$3">
        {items.map((item) => (
          <InfoItem key={item.title} {...item} />
        ))}
      </YStack>
    </YStack>
  );
}

function DialogForgetDeviceContent() {
  const intl = useIntl();

  const whatHappenItems: IInfoItemProps[] = [
    {
      icon: 'BrokenLinkOutline',
      iconColor: '$iconCritical',
      title: intl.formatMessage({ id: ETranslations.global_device_disconnect }),
      description: intl.formatMessage({
        id: ETranslations.global_device_disconnect_content,
      }),
    },
    {
      icon: 'BlockOutline',
      iconColor: '$iconCritical',
      title: intl.formatMessage({ id: ETranslations.global_session_stop }),
      description: intl.formatMessage({
        id: ETranslations.global_session_stop_content,
      }),
    },
  ];

  const whatStaySafeItems: IInfoItemProps[] = [
    {
      icon: 'Shield2CheckOutline',
      iconColor: '$iconSuccess',
      title: intl.formatMessage({ id: ETranslations.global_data_remain_safe }),
      description: intl.formatMessage({
        id: ETranslations.global_data_remain_safe_detail,
      }),
    },
    {
      icon: 'LinkOutline',
      iconColor: '$iconSuccess',
      title: intl.formatMessage({ id: ETranslations.global_connect_anytime }),
      description: intl.formatMessage({
        id: ETranslations.global_connect_anytime_detail,
      }),
    },
  ];

  return (
    <YStack gap="$2">
      <InfoSection
        title={intl.formatMessage({ id: ETranslations.global_what_happen })}
        items={whatHappenItems}
      />
      <InfoSection
        title={intl.formatMessage({ id: ETranslations.global_what_stay_safe })}
        items={whatStaySafeItems}
      />
    </YStack>
  );
}

export function useDialogForgetDevice() {
  const intl = useIntl();

  const show = useCallback(
    ({
      onConfirmForgetDevice,
    }: {
      onConfirmForgetDevice: () => Promise<void>;
    }) => {
      Dialog.show({
        title: intl.formatMessage({ id: ETranslations.global_forget_device }),
        renderContent: <DialogForgetDeviceContent />,
        onConfirmText: intl.formatMessage({
          id: ETranslations.global_button_forget_device,
        }),
        onCancelText: intl.formatMessage({ id: ETranslations.global_cancel }),
        confirmButtonProps: {
          variant: 'primary',
        },
        cancelButtonProps: {
          variant: 'secondary',
        },
        onConfirm: async ({ close }) => {
          await onConfirmForgetDevice?.();
          void close();
        },
      });
    },
    [intl],
  );

  return { show };
}
