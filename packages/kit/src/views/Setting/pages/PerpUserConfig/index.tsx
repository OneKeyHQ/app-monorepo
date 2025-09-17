import { useCallback } from 'react';

import { Page, Radio, XStack, startViewTransition } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EPerpUserType } from '@onekeyhq/shared/types/hyperliquid/types';

function PerpUserConfig() {
  const [settings] = useSettingsPersistAtom();

  const setPerpUserConfig = useCallback(async (type: EPerpUserType) => {
    startViewTransition(() => {
      void backgroundApiProxy.serviceWebviewPerp.setPerpUserConfig(type);
    });
  }, []);

  return (
    <Page>
      <Page.Header title="Perp User Config" />
      <Page.Body>
        <XStack px="$5">
          <Radio
            value={settings.perpUserConfig.currentUserType}
            onChange={(value) => setPerpUserConfig(value as EPerpUserType)}
            options={[
              {
                label: 'Native',
                value: EPerpUserType.PERP_NATIVE,
                description: 'Perp Native',
              },
              {
                label: 'Web',
                value: EPerpUserType.PERP_WEB,
                description: 'Perp Web',
              },
            ]}
          />
        </XStack>
      </Page.Body>
    </Page>
  );
}

export default PerpUserConfig;
