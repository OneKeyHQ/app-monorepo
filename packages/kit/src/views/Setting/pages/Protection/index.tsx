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
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

const SettingProtectionModal = () => {
  const intl = useIntl();
  const [settings, setSettings] = useSettingsPersistAtom();
  return (
    <Page>
      <YStack>
        <SectionList.SectionHeader title="Token risk protection" />
        <ListItem title="Token risk reminder">
          <Switch
            value={settings.tokenRiskReminder}
            onChange={async (value) => {
              setSettings((v) => ({ ...v, tokenRiskReminder: !!value }));
            }}
          />
        </ListItem>
        <SizableText pl="$5" size="$bodySm" color="$textSubdued">
          When enabled, you'll be reminded when selecting non-verified tokens.
        </SizableText>
        <SectionList.SectionHeader mt="$5" title="Password bypass" />
        <ListItem
          title={intl.formatMessage({ id: 'form__create_transactions' })}
          subtitle="No password needed for transactions"
        >
          <Switch
            value={settings.protectCreateTransaction}
            onChange={async (value) => {
              if (!value) {
                await backgroundApiProxy.servicePassword.promptPasswordVerify({
                  reason: EReasonForNeedPassword.Security,
                });
              }
              await backgroundApiProxy.serviceSetting.setProtectCreateTransaction(
                value,
              );
            }}
          />
        </ListItem>
        <ListItem
          title={intl.formatMessage({ id: 'form__create_delete_wallets' })}
          subtitle="No password needed for creating/removing wallets"
        >
          <Switch
            value={settings.protectCreateOrRemoveWallet}
            onChange={async (value) => {
              if (!value) {
                await backgroundApiProxy.servicePassword.promptPasswordVerify({
                  reason: EReasonForNeedPassword.Security,
                });
              }
              await backgroundApiProxy.serviceSetting.setProtectCreateOrRemoveWallet(
                value,
              );
            }}
          />
        </ListItem>
      </YStack>
    </Page>
  );
};

export default SettingProtectionModal;
