import { useIntl } from 'react-intl';

import { IconButton, SizableText, XStack } from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export interface IWebAccountPanelFooterProps extends IXStackProps {
  connected?: boolean;
  onDownloadApp?: () => void;
  onArticles?: () => void;
  onHelp?: () => void;
  onSettings?: () => void;
}

export function WebAccountPanelFooter({
  connected = true,
  onDownloadApp,
  onArticles,
  onHelp,
  onSettings,
  ...stackProps
}: IWebAccountPanelFooterProps) {
  const intl = useIntl();
  return (
    <XStack
      ai="center"
      jc="space-between"
      pt="$4"
      pb="$4"
      px="$5"
      w="100%"
      borderTopWidth={1}
      borderTopColor="$neutral2"
      bg="$neutral1"
      {...stackProps}
    >
      <XStack
        ai="center"
        cursor={onDownloadApp ? 'pointer' : undefined}
        onPress={onDownloadApp}
        role={onDownloadApp ? 'button' : undefined}
        hoverStyle={onDownloadApp ? { opacity: 0.85 } : undefined}
        pressStyle={onDownloadApp ? { opacity: 0.7 } : undefined}
      >
        <SizableText size="$bodyMdMedium" color="$textInteractive">
          {intl.formatMessage({ id: ETranslations.global_download_app })}
        </SizableText>
      </XStack>
      <XStack ai="center" gap="$5">
        <IconButton
          icon="BookOpenOutline"
          size="small"
          variant="tertiary"
          iconSize="$5"
          onPress={onArticles}
          testID="web-account-panel-footer-articles"
        />
        <IconButton
          icon="HelpSupportOutline"
          size="small"
          variant="tertiary"
          iconSize="$5"
          onPress={onHelp}
          testID="web-account-panel-footer-help"
        />
        {connected ? (
          <IconButton
            icon="SettingsOutline"
            size="small"
            variant="tertiary"
            iconSize="$5"
            onPress={onSettings}
            testID="web-account-panel-footer-settings"
          />
        ) : null}
      </XStack>
    </XStack>
  );
}
