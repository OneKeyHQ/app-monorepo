import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Page, Radio, YStack, startViewTransition } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePerpsUserConfigPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EPerpUserType } from '@onekeyhq/shared/types/hyperliquid/types';

function PerpUserConfig() {
  const intl = useIntl();
  const [{ perpUserConfig }] = usePerpsUserConfigPersistAtom();
  const setPerpUserConfig = useCallback(async (type: EPerpUserType) => {
    startViewTransition(() => {
      void backgroundApiProxy.serviceWebviewPerp.setPerpUserConfig(type);
    });
  }, []);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.perp_setting_interface,
        })}
      />
      <Page.Body>
        <YStack px="$5">
          <Radio
            value={perpUserConfig.currentUserType}
            onChange={(value) => setPerpUserConfig(value as EPerpUserType)}
            options={[
              {
                label: intl.formatMessage({
                  id: ETranslations.perp_setting_interface_native_title,
                }),
                value: EPerpUserType.PERP_NATIVE,
                description: intl.formatMessage({
                  id: ETranslations.perp_setting_interface_native_desc,
                }),
              },
              {
                label: intl.formatMessage({
                  id: ETranslations.perp_setting_interface_web_title,
                }),
                value: EPerpUserType.PERP_WEB,
                description: intl.formatMessage({
                  id: ETranslations.perp_setting_interface_web_desc,
                }),
              },
            ]}
          />
        </YStack>
      </Page.Body>
    </Page>
  );
}

export default PerpUserConfig;
