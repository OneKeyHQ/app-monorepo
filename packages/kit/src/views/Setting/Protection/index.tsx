import { useIntl } from 'react-intl';

import { Page, Switch, Text, XStack, YStack } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

const SettingProtectionModal = () => {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  return (
    <Page>
      <YStack px="$5">
        <XStack py="$3" justifyContent="space-between" alignItems="center">
          <Text variant="$bodyMd">
            {intl.formatMessage({ id: 'form__create_transactions' })}
          </Text>
          <Switch
            value={settings.protectCreateTransaction}
            onChange={(value) =>
              backgroundApiProxy.serviceSetting.setProtectCreateTransaction(
                value,
              )
            }
          />
        </XStack>
        <XStack py="$3" justifyContent="space-between" alignItems="center">
          <Text variant="$bodyMd">
            {intl.formatMessage({ id: 'form__create_delete_wallets' })}
          </Text>
          <Switch
            value={settings.protectCreateOrRemoveWallet}
            onChange={(value) =>
              backgroundApiProxy.serviceSetting.setProtectCreateOrRemoveWallet(
                value,
              )
            }
          />
        </XStack>
      </YStack>
    </Page>
  );
};

export default SettingProtectionModal;
