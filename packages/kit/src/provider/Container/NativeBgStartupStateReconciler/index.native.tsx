import { useEffect } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EAtomNames } from '@onekeyhq/kit-bg/src/states/jotai/atomNames';
import { jotaiUpdateFromUiByBgBroadcast } from '@onekeyhq/kit-bg/src/states/jotai/jotaiInitFromUi';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const NATIVE_BG_STARTUP_RECONCILE_DELAY_MS = 5000;

const STARTUP_RECONCILE_ATOM_NAMES = [EAtomNames.localDbOpenErrorAtom];

async function reconcileNativeBgStartupStates() {
  const { states } = await backgroundApiProxy.getAtomStates(
    STARTUP_RECONCILE_ATOM_NAMES,
  );

  await Promise.all(
    STARTUP_RECONCILE_ATOM_NAMES.map(async (name) => {
      if (!Object.prototype.hasOwnProperty.call(states, name)) {
        return;
      }
      await jotaiUpdateFromUiByBgBroadcast({
        $$isFromBgStatesSyncBroadcast: true,
        name,
        payload: states[name],
      });
    }),
  );
}

export function NativeBgStartupStateReconciler() {
  useEffect(() => {
    if (!platformEnv.enableNativeBackgroundThread) {
      return undefined;
    }

    // Delay the targeted reconciliation until after the cold-start critical
    // path. The RPC waits for bg readiness if the runtime is still starting.
    const timer = setTimeout(() => {
      void reconcileNativeBgStartupStates().catch((error: unknown) => {
        defaultLogger.app.error.log(
          `[NativeBgStartupStateReconciler] ${
            (error as Error)?.message || String(error)
          }`,
        );
      });
    }, NATIVE_BG_STARTUP_RECONCILE_DELAY_MS);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return null;
}
