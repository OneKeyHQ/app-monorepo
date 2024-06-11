import { useIntl } from 'react-intl';

import {
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
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

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
          <SizableText pl="$5" size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.settings_token_risk_reminder_desc,
            })}
          </SizableText>
          <SectionList.SectionHeader
            mt="$5"
            title={intl.formatMessage({
              id: ETranslations.settings_password_bypass,
            })}
          />
          <ListItem
            title={intl.formatMessage({
              id: ETranslations.settings_create_transactions,
            })}
            subtitle={intl.formatMessage({
              id: ETranslations.settings_create_transactions_desc,
            })}
          >
            <Switch
              value={settings.protectCreateTransaction}
              onChange={async (value) => {
                if (!value) {
                  await backgroundApiProxy.servicePassword.promptPasswordVerify(
                    {
                      reason: EReasonForNeedPassword.Security,
                    },
                  );
                }
                await backgroundApiProxy.serviceSetting.setProtectCreateTransaction(
                  value,
                );
              }}
            />
          </ListItem>
          <ListItem
            title={intl.formatMessage({
              id: ETranslations.settings_create_remove_wallets,
            })}
            subtitle={intl.formatMessage({
              id: ETranslations.settings_create_remove_wallets_desc,
            })}
          >
            <Switch
              value={settings.protectCreateOrRemoveWallet}
              onChange={async (value) => {
                if (!value) {
                  await backgroundApiProxy.servicePassword.promptPasswordVerify(
                    {
                      reason: EReasonForNeedPassword.Security,
                    },
                  );
                }
                await backgroundApiProxy.serviceSetting.setProtectCreateOrRemoveWallet(
                  value,
                );
              }}
            />
          </ListItem>
        </YStack>
      </Page.Body>
    </Page>
  );
};

export default SettingProtectionModal;
