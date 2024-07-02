import { useIntl } from 'react-intl';

import {
  Divider,
  Page,
  SectionList,
  SizableText,
  Switch,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const SettingProtectionModal = () => {
  const intl = useIntl();
  const [settings, setSettings] = useSettingsPersistAtom();
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.settings_protection })}
      />
      <Page.Body>
        <YStack>
          <SectionList.SectionHeader
            title={intl.formatMessage({
              id: ETranslations.settings_token_risk_protection,
            })}
          />
          <ListItem
            title={intl.formatMessage({
              id: ETranslations.settings_token_risk_reminder,
            })}
          >
            <Switch
              value={settings.tokenRiskReminder}
              onChange={async (value) => {
                setSettings((v) => ({ ...v, tokenRiskReminder: !!value }));
              }}
            />
          </ListItem>
          <SizableText px="$5" size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.settings_token_risk_reminder_desc,
            })}
          </SizableText>
          <Divider my="$5" mx="$5" />
          <SectionList.SectionHeader
            title={intl.formatMessage({
              id: ETranslations.settings_password_bypass,
            })}
          />
          <ListItem
            title={intl.formatMessage({
              id: ETranslations.settings_create_transactions,
            })}
          >
            <Switch
              value={!settings.protectCreateTransaction}
              onChange={async (value) => {
                await backgroundApiProxy.serviceSetting.setProtectCreateTransaction(
                  !value,
                );
              }}
            />
          </ListItem>
          <ListItem
            title={intl.formatMessage({
              id: ETranslations.settings_create_remove_wallets,
            })}
          >
            <Switch
              value={!settings.protectCreateOrRemoveWallet}
              onChange={async (value) => {
                await backgroundApiProxy.serviceSetting.setProtectCreateOrRemoveWallet(
                  !value,
                );
              }}
            />
          </ListItem>
          <SizableText px="$5" size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.settings_password_bypass_desc,
            })}
          </SizableText>
        </YStack>
      </Page.Body>
    </Page>
  );
};

export default SettingProtectionModal;
