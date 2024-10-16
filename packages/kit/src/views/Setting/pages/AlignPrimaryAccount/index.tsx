import { useCallback } from 'react';

import { Page, Radio, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EAlignPrimaryAccountMode } from '@onekeyhq/shared/types/dappConnection';

function AlignPrimaryAccount() {
  const [settings] = useSettingsPersistAtom();

  const setAlignPrimaryAccountMode = useCallback(async (mode: string) => {
    await backgroundApiProxy.serviceSetting.setAlignPrimaryAccountMode(
      mode as EAlignPrimaryAccountMode,
    );
  }, []);

  return (
    <Page>
      <Page.Header title="Align primary account" />
      <Page.Body>
        <Stack p="$5">
          <Radio
            value={settings.alignPrimaryAccountMode}
            onChange={setAlignPrimaryAccountMode}
            options={[
              { label: 'Default', value: EAlignPrimaryAccountMode.Default },
              {
                label: 'Align dApp and wallet account',
                value: EAlignPrimaryAccountMode.AlignDappToWallet,
              },
              {
                label: 'Alway use primary account for all',
                value: EAlignPrimaryAccountMode.AlwaysUsePrimaryAccount,
              },
            ]}
          />
        </Stack>
      </Page.Body>
    </Page>
  );
}

export default AlignPrimaryAccount;
