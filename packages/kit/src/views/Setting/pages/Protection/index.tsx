import { useIntl } from 'react-intl';

import {
  Page,
  SizableText,
  Switch,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';

const SettingProtectionModal = () => {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  return (
    <Page>
      <YStack px="$5">
        <XStack py="$3" justifyContent="space-between" alignItems="center">
          <SizableText size="$bodyMd">
            {intl.formatMessage({ id: 'form__create_transactions' })}
          </SizableText>
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
          <SizableText size="$bodyMd">
            {intl.formatMessage({ id: 'form__create_delete_wallets' })}
          </SizableText>
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
