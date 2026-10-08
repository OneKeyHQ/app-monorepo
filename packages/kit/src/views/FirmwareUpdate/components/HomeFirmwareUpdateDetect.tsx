import { memo, useEffect, useMemo } from 'react';

import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { createActiveAccountFirmwareUpdateDetector } from '../activeAccountFirmwareUpdateDetection';

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
    if (!isHardware || !connectId || !isFocused) {
      return undefined;
    }

    // The background service owns throttling and the complete detect workflow.
    const detector = createActiveAccountFirmwareUpdateDetector({
      detect: async () => {
        return backgroundApiProxy.serviceFirmwareUpdate.detectActiveAccountFirmwareUpdates(
          { connectId },
        );
      },
    });
    detector.start();

    return detector.cancel;
  }, [isHardware, connectId, isFocused]);

  return null;
}

export function HomeFirmwareUpdateDetectWithProvider() {
  const [isLocked] = useAppIsLockedAtom();
  // Prohibit hardware detection in lock screen state
  return isLocked ? null : (
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
