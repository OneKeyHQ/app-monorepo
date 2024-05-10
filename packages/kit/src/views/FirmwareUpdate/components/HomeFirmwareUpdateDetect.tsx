import { memo, useEffect, useMemo } from 'react';

import { useIsFocused } from '@react-navigation/native';

import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

function HomeFirmwareUpdateDetectCmp() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const connectId = activeAccount.device?.connectId;

  const isFocused = useIsFocused();

  // const activeAccountRef = useRef(activeAccount);
  // activeAccountRef.current = activeAccount;
  const isHardware = useMemo(
    () =>
      accountUtils.isHwWallet({
        walletId: activeAccount.wallet?.id,
      }),
    [activeAccount.wallet?.id],
  );

  useEffect(() => {
    if (isHardware && connectId && isFocused) {
      // TODO check firmware update only for current device or all device?
      // TODO only works for home scene, TODO throttle
      // get sdk instance will register device events automatically
      void backgroundApiProxy.serviceFirmwareUpdate.detectActiveAccountFirmwareUpdates(
        {
          connectId,
        },
      );
    }
  }, [isHardware, connectId, isFocused]);

  return null;
}

export function HomeFirmwareUpdateDetectWithProvider() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[0]}
    >
      <HomeFirmwareUpdateDetectCmp />
    </AccountSelectorProviderMirror>
  );
}

export const HomeFirmwareUpdateDetect = memo(
  HomeFirmwareUpdateDetectWithProvider,
);
