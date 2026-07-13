import { useIntl } from 'react-intl';

import { Button, IconButton, XStack } from '@onekeyhq/components';
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
      bg="$bgSubdued"
      {...stackProps}
    >
      <Button
        size="small"
        variant="tertiary"
        onPress={onDownloadApp}
        testID="web-account-panel-footer-download"
      >
        {intl.formatMessage({ id: ETranslations.global_download_app })}
      </Button>
      <XStack ai="center" gap="$5">
        <IconButton
          icon="BookOpenOutline"
          size="small"
          variant="tertiary"
          iconSize="$5"
          title={intl.formatMessage({ id: ETranslations.perp_academy })}
          onPress={onArticles}
          testID="web-account-panel-footer-articles"
        />
        <IconButton
          icon="HelpSupportOutline"
          size="small"
          variant="tertiary"
          iconSize="$5"
          title={intl.formatMessage({ id: ETranslations.global_support })}
          onPress={onHelp}
          testID="web-account-panel-footer-help"
        />
        {connected ? (
          <IconButton
            icon="SettingsOutline"
            size="small"
            variant="tertiary"
            iconSize="$5"
            title={intl.formatMessage({ id: ETranslations.global_settings })}
            onPress={onSettings}
            testID="web-account-panel-footer-settings"
          />
        ) : null}
      </XStack>
    </XStack>
  );
}
