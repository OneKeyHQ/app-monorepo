import { useIntl } from 'react-intl';

import {
  ESwitchSize,
  Page,
  SizableText,
  Switch,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

function FloatingIconModal() {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.setting_floating_icon })}
      />
      <Page.Body>
        <YStack p="$5">
          <XStack ai="center" jc="space-between">
            <SizableText size="$bodyLgMedium">
              {intl.formatMessage({
                id: ETranslations.setting_floating_icon_always_display,
              })}
            </SizableText>
            <Switch
              size={ESwitchSize.large}
              value={settings.isFloatingIconAlwaysDisplay}
              onChange={async (value) => {
                await backgroundApiProxy.serviceSetting.setIsShowFloatingButton(
                  value,
                );
                defaultLogger.discovery.dapp.enableFloatingIcon({
                  enable: value,
                });
              }}
            />
          </XStack>
          <SizableText size="$bodySm" color="$textSubdued" mt="$3">
            {intl.formatMessage({
              id: ETranslations.setting_floating_icon_always_display_description,
            })}
          </SizableText>
        </YStack>
      </Page.Body>
    </Page>
  );
}

export default FloatingIconModal;
