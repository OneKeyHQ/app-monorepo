import { memo, useEffect } from 'react';

import { EExtOneKeyIdAuthFlow } from '@onekeyhq/shared/src/consts/authConsts';
import { PrimeLoginDialogCancelError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { consumeExtOneKeyIdAuthFlowFromUrl } from './extOneKeyIdAuthExpandTab';
import { useOneKeyAuth } from './useOneKeyAuth';

// Module-level flag: the flow must run at most once per expand-tab document,
// even if the host page remounts.
let isFlowConsumed = false;

// Auto-resumes a OneKey ID auth flow handed off from the extension action
// popup (see extOneKeyIdAuthExpandTab.ts). Only the expand tab runs the
// flow; everywhere else this component is a no-op.
function ExtOneKeyIdAuthOnMountCmp() {
  const { loginOneKeyId } = useOneKeyAuth();

  useEffect(() => {
    if (!platformEnv.isExtensionUiExpandTab || isFlowConsumed) {
      return;
    }
    isFlowConsumed = true;
    const flowInfo = consumeExtOneKeyIdAuthFlowFromUrl();
    if (!flowInfo) {
      return;
    }
    void (async () => {
      // Let the app finish mounting so the dialog overlay renders reliably.
      await timerUtils.wait(600);
      try {
        if (flowInfo.flow === EExtOneKeyIdAuthFlow.Login) {
          await loginOneKeyId({
            toOneKeyIdPageOnLoginSuccess: flowInfo.toOneKeyIdPageOnLoginSuccess,
          });
        } else if (flowInfo.flow === EExtOneKeyIdAuthFlow.LegacyOAuthBind) {
          // Lazy import keeps the Prime bind dialog out of the home bundle
          // on platforms that never run this flow.
          const { showOneKeyIdLegacyOAuthBindDialog } =
            await import('../../views/Prime/components/OneKeyIdLegacyOAuthBind/OneKeyIdLegacyOAuthBind');
          await showOneKeyIdLegacyOAuthBindDialog();
        }
      } catch (error) {
        if (error instanceof PrimeLoginDialogCancelError) {
          return;
        }
        console.error('ExtOneKeyIdAuthOnMount: auth flow failed:', error);
      }
    })();
  }, [loginOneKeyId]);

  return null;
}

export const ExtOneKeyIdAuthOnMount = memo(ExtOneKeyIdAuthOnMountCmp);
