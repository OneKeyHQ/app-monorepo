import { useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Divider,
  ESwitchSize,
  Page,
  ScrollView,
  SectionList,
  SizableText,
  Spinner,
  Stack,
  Switch,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useIsEnableTransferAllowList } from '@onekeyhq/kit/src/components/AddressInput/hooks';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import PassCodeProtectionSwitch from '@onekeyhq/kit/src/components/Password/container/PassCodeProtectionSwitch';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

const SettingProtectionModal = () => {
  const intl = useIntl();
  const [
    {
      tokenRiskReminder,
      protectCreateTransaction,
      protectCreateOrRemoveWallet,
    },
    setSettings,
  ] = useSettingsPersistAtom();
  const isEnableTransferAllowList = useIsEnableTransferAllowList();
  const [enableProtection, setEnableProtection] = useState(false);
  const navigation = useAppNavigation();
  useEffect(() => {
    if (!enableProtection) {
      const checkEnableProtection = async () => {
        try {
          const passwordRes =
            await backgroundApiProxy.servicePassword.promptPasswordVerify({
              reason: EReasonForNeedPassword.Security,
            });
          if (passwordRes) {
            setEnableProtection(true);
          } else {
            navigation.pop();
          }
        } catch (e) {
          navigation.pop();
        }
      };
      void checkEnableProtection();
    }
  }, [enableProtection, navigation]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.settings_protection })}
      />
      <Page.Body>
        {enableProtection ? (
          <ScrollView>
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
                  value={tokenRiskReminder}
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
                    await backgroundApiProxy.serviceSetting.setIsEnableTransferAllowList(
                      value,
                    );
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
                  value={!protectCreateTransaction}
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
                  value={!protectCreateOrRemoveWallet}
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
                <PassCodeProtectionSwitch size={ESwitchSize.small} />
              </ListItem>
              <SizableText px="$5" size="$bodySm" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.Setting_Reset_app_description,
                })}
              </SizableText>
            </YStack>
          </ScrollView>
        ) : (
          <Stack h="100%" flex={1} alignItems="center" justifyContent="center">
            <Spinner size="large" />
          </Stack>
        )}
      </Page.Body>
    </Page>
  );
};

export default SettingProtectionModal;
