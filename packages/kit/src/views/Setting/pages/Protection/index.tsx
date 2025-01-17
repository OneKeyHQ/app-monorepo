import { useIntl } from 'react-intl';

import {
  Divider,
  ESwitchSize,
  Page,
  SectionList,
  SizableText,
  Switch,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useIsEnableTransferAllowList } from '@onekeyhq/kit/src/components/AddressInput/hooks';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import PassCodeProtectionSwitch from '@onekeyhq/kit/src/components/Password/container/PassCodeProtectionSwitch';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const SettingProtectionModal = () => {
  const intl = useIntl();
  const [settings, setSettings] = useSettingsPersistAtom();
  const isEnableTransferAllowList = useIsEnableTransferAllowList();
  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.settings_protection })}
      />
      <Page.Body>
        <YStack pb="$10">
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
              size={ESwitchSize.small}
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
          <ListItem
            title={intl.formatMessage({
              id: ETranslations.settings_protection_allowlist_title,
            })}
          >
            <Switch
              size={ESwitchSize.small}
              value={isEnableTransferAllowList}
              onChange={async (value) => {
                setSettings((v) => ({ ...v, transferAllowList: !!value }));
              }}
            />
          </ListItem>
          <SizableText px="$5" size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.settings_protection_allowlist_content,
            })}
          </SizableText>
          <Divider my="$5" mx="$5" />
          <SectionList.SectionHeader
            title={intl.formatMessage({
              id: ETranslations.settings_passcode_bypass,
            })}
          />
          <ListItem
            title={intl.formatMessage({
              id: ETranslations.settings_create_transactions,
            })}
          >
            <Switch
              size={ESwitchSize.small}
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
              size={ESwitchSize.small}
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
              id: ETranslations.settings_passcode_bypass_desc,
            })}
          </SizableText>
          <Divider my="$5" mx="$5" />
          <SectionList.SectionHeader
            title={intl.formatMessage({
              id: ETranslations.settings_protection_passcode_section_title,
            })}
          />
          <ListItem
            title={intl.formatMessage({
              id: ETranslations.settings_reset_app,
            })}
          >
            <PassCodeProtectionSwitch />
          </ListItem>
          <SizableText px="$5" size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.Setting_Reset_app_description,
            })}
          </SizableText>
        </YStack>
      </Page.Body>
    </Page>
  );
};

export default SettingProtectionModal;
