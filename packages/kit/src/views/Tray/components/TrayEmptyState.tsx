import { useIntl } from 'react-intl';

import { SizableText, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

type IEmptyStateType =
  | 'loading'
  | 'locked'
  | 'noWallet'
  | 'noContent'
  | 'offline';

const STATE_CONFIG: Record<
  IEmptyStateType,
  { icon: string; title: ETranslations; subtitle: ETranslations }
> = {
  loading: {
    icon: '⏳',
    title: ETranslations.tray_loading_title,
    subtitle: ETranslations.tray_loading_desc,
  },
  locked: {
    icon: '🔒',
    title: ETranslations.tray_locked_title,
    subtitle: ETranslations.tray_locked_desc,
  },
  noWallet: {
    icon: '👋',
    title: ETranslations.tray_no_wallet_title,
    subtitle: ETranslations.tray_no_wallet_desc,
  },
  noContent: {
    icon: '📊',
    title: ETranslations.tray_no_content_title,
    subtitle: ETranslations.tray_no_content_desc,
  },
  offline: {
    icon: '📡',
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
      <SizableText fontSize={32} marginBottom="$3">
        {config.icon}
      </SizableText>
      <SizableText
        fontSize="$headingSm"
        color="$text"
        marginBottom="$1.5"
        textAlign="center"
      >
        {intl.formatMessage({ id: config.title })}
      </SizableText>
      <SizableText fontSize="$bodySm" color="$textSubdued" textAlign="center">
        {intl.formatMessage({ id: config.subtitle })}
      </SizableText>
    </Stack>
  );
}
