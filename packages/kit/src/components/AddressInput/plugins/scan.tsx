import { type FC, useCallback } from 'react';

import { IconButton } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useScanQrCode from '@onekeyhq/kit/src/views/ScanQrCode/hooks/useScanQrCode';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import type { IAddressPluginProps } from '../types';

const ScanPluginContent: FC<IAddressPluginProps> = ({ onChange, testID }) => {
  const { start } = useScanQrCode();
  const onPress = useCallback(async () => {
    const address = await start({
      parseScene: 'none',
      autoHandleResult: false,
    });
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
