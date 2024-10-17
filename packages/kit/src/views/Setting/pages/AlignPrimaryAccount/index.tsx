import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Page, Radio, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAlignPrimaryAccountMode } from '@onekeyhq/shared/types/dappConnection';

function AlignPrimaryAccount() {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();

  const setAlignPrimaryAccountMode = useCallback(async (mode: string) => {
    await backgroundApiProxy.serviceSetting.setAlignPrimaryAccountMode(
      mode as EAlignPrimaryAccountMode,
    );
  }, []);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.settings_account_sync_modal_title,
        })}
      />
      <Page.Body>
        <Stack px="$5">
          <Radio
            value={settings.alignPrimaryAccountMode}
            onChange={setAlignPrimaryAccountMode}
            options={[
              {
                label: intl.formatMessage({
                  id: ETranslations.settings_account_sync_independent_mode_title,
                }),
                value: EAlignPrimaryAccountMode.Independent,
                description: intl.formatMessage({
                  id: ETranslations.settings_account_sync_independent_mode_description,
                }),
              },
              {
                label: intl.formatMessage({
                  id: ETranslations.settings_account_sync_dapp_to_wallet_mode_title,
                }),
                value: EAlignPrimaryAccountMode.AlignDappToWallet,
                description: intl.formatMessage({
                  id: ETranslations.settings_account_sync_dapp_to_wallet_mode_description,
                }),
              },
              // {
              //   label: intl.formatMessage({
              //     id: ETranslations.settings_account_sync_wallet_to_all_mode_title,
              //   }),
              //   value: EAlignPrimaryAccountMode.AlwaysUsePrimaryAccount,
              //   description: intl.formatMessage({
              //     id: ETranslations.settings_account_sync_wallet_to_all_mode_description,
              //   }),
              // },
            ]}
          />
        </Stack>
      </Page.Body>
    </Page>
  );
}

export default AlignPrimaryAccount;
