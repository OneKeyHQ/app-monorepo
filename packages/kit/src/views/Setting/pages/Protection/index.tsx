import { useIntl } from 'react-intl';

import { Page, SizableText, Switch, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';

const SettingProtectionModal = () => {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  return (
    <Page>
      <YStack>
        <ListItem
          title={intl.formatMessage({ id: 'form__create_transactions' })}
        >
          <Switch
            value={settings.protectCreateTransaction}
            onChange={(value) =>
              backgroundApiProxy.serviceSetting.setProtectCreateTransaction(
                value,
              )
            }
          />
        </ListItem>
        <ListItem
          title={intl.formatMessage({ id: 'form__create_delete_wallets' })}
        >
          <Switch
            value={settings.protectCreateOrRemoveWallet}
            onChange={(value) =>
              backgroundApiProxy.serviceSetting.setProtectCreateOrRemoveWallet(
                value,
              )
            }
          />
        </ListItem>
        <YStack px="$5">
          <SizableText size="$bodySm" color="$textSubdued">
            Your password will be required in these cases even you've already
            unlocked OneKey.
          </SizableText>
        </YStack>
      </YStack>
    </Page>
  );
};

export default SettingProtectionModal;
