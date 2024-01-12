import { useIntl } from 'react-intl';

import { Page, SizableText, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EOnekeyDomain } from '@onekeyhq/shared/types';

import { ListItemSelect } from '../../components/ListItemSelect';

const useBridgeOptions = () => {
  const intl = useIntl();
  return [
    {
      title: EOnekeyDomain.ONEKEY_SO,
      subtitle: intl.formatMessage({ id: 'form__default' }),
      value: EOnekeyDomain.ONEKEY_SO,
    },
    {
      title: EOnekeyDomain.ONEKEY_CN,
      subtitle: intl.formatMessage({
        id: 'form__optimized_for_china_mainland_network',
      }),
      value: EOnekeyDomain.ONEKEY_CN,
    },
  ];
};

const HardwareSdkUrl = () => {
  const intl = useIntl();
  const options = useBridgeOptions();
  const [settings] = useSettingsPersistAtom();
  return (
    <Page>
      <ListItemSelect
        options={options}
        value={settings.hardwareConnectSrc as string}
        onChange={(value) =>
          backgroundApiProxy.serviceSetting.setHardwareConnectSrc(value)
        }
      />
      <Stack px="$5">
        <SizableText>
          {intl.formatMessage({ id: 'form__hardware_bridge_desc' })}
        </SizableText>
      </Stack>
    </Page>
  );
};

export default HardwareSdkUrl;
