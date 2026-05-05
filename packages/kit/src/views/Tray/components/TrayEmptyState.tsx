import { useIntl } from 'react-intl';

import { Icon, SizableText, Stack } from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components/src/primitives/Icon';
import { ETranslations } from '@onekeyhq/shared/src/locale';

type IEmptyStateType =
  | 'loading'
  | 'locked'
  | 'noWallet'
  | 'noContent'
  | 'offline';

const STATE_CONFIG: Record<
  IEmptyStateType,
  { icon: IKeyOfIcons; title: ETranslations; subtitle: ETranslations }
> = {
  loading: {
    icon: 'HourglassOutline',
    title: ETranslations.tray_loading_title,
    subtitle: ETranslations.tray_loading_desc,
  },
  locked: {
    icon: 'LockOutline',
    title: ETranslations.tray_locked_title,
    subtitle: ETranslations.tray_locked_desc,
  },
  noWallet: {
    icon: 'WalletOutline',
    title: ETranslations.tray_no_wallet_title,
    subtitle: ETranslations.tray_no_wallet_desc,
  },
  noContent: {
    icon: 'StarOutline',
    title: ETranslations.tray_no_content_title,
    subtitle: ETranslations.tray_no_content_desc,
  },
  offline: {
    icon: 'WifiOutline',
    title: ETranslations.tray_offline_title,
    subtitle: ETranslations.tray_offline_desc,
  },
};

export function TrayEmptyState({
  type,
  onPress,
}: {
  type: IEmptyStateType;
  onPress?: () => void;
}) {
  const intl = useIntl();
  const config = STATE_CONFIG[type];
  return (
    <Stack
      flex={1}
      alignItems="center"
      justifyContent="center"
      padding="$6"
      onPress={onPress}
      cursor={onPress ? 'pointer' : 'default'}
      hoverStyle={onPress ? { backgroundColor: '$bgHover' } : undefined}
    >
      <Stack
        width="$12"
        height="$12"
        borderRadius="$full"
        backgroundColor="$bgStrong"
        alignItems="center"
        justifyContent="center"
        marginBottom="$3.5"
      >
        <Icon name={config.icon} size="$6" color="$iconSubdued" />
      </Stack>
      <SizableText
        size="$bodyMdMedium"
        color="$text"
        marginBottom="$1"
        textAlign="center"
        maxWidth="$64"
      >
        {intl.formatMessage({ id: config.title })}
      </SizableText>
      <SizableText
        size="$bodySm"
        color="$textSubdued"
        textAlign="center"
        maxWidth="$64"
      >
        {intl.formatMessage({ id: config.subtitle })}
      </SizableText>
    </Stack>
  );
}
