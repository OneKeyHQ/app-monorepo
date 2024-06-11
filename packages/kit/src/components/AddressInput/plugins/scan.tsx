import { type FC, useCallback } from 'react';

import { useIntl } from 'react-intl';

import { IconButton } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useScanQrCode from '@onekeyhq/kit/src/views/ScanQrCode/hooks/useScanQrCode';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import type { IAddressPluginProps } from '../types';

const ScanPluginContent: FC<IAddressPluginProps> = ({ onChange, testID }) => {
  const { start } = useScanQrCode();
  const intl = useIntl();
  const onPress = useCallback(async () => {
    const address = await start({
      handlers: [],
      autoHandleResult: false,
    });
    onChange?.(address?.raw);
  }, [onChange, start]);
  return (
    <IconButton
      title={intl.formatMessage({ id: ETranslations.send_to_scan_tooltip })}
      variant="tertiary"
      icon="ScanSolid"
      onPress={onPress}
      testID={testID}
    />
  );
};

type IScanPluginProps = IAddressPluginProps & {
  sceneName: EAccountSelectorSceneName;
};

export const ScanPlugin: FC<IScanPluginProps> = ({
  onChange,
  testID,
  sceneName,
}) => (
  <AccountSelectorProviderMirror
    config={{
      sceneName,
    }}
    enabledNum={[0]}
  >
    <ScanPluginContent onChange={onChange} testID={testID} />
  </AccountSelectorProviderMirror>
);
