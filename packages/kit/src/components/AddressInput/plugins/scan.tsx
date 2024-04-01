import { type FC, useCallback } from 'react';

import { IconButton } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useScanQrCode from '@onekeyhq/kit/src/views/ScanQrCode/hooks/useScanQrCode';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import type { IAddressPluginProps } from '../types';

const ScanPluginContent: FC<IAddressPluginProps> = ({ onChange, testID }) => {
  const { start } = useScanQrCode();
  const onPress = useCallback(async () => {
    const address = await start(false);
    onChange?.(address?.raw);
  }, [onChange, start]);
  return (
    <IconButton
      title="Scan"
      variant="tertiary"
      icon="ScanSolid"
      onPress={onPress}
      testID={testID}
    />
  );
};

export const ScanPlugin: FC<IAddressPluginProps> = ({ onChange, testID }) => (
  <AccountSelectorProviderMirror
    config={{
      sceneName: EAccountSelectorSceneName.home,
    }}
    enabledNum={[0]}
  >
    <ScanPluginContent onChange={onChange} testID={testID} />
  </AccountSelectorProviderMirror>
);
