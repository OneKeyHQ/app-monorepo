import { memo, useEffect } from 'react';

import { EExtOneKeyIdAuthFlow } from '@onekeyhq/shared/src/consts/authConsts';
import { PrimeLoginDialogCancelError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { consumeExtOneKeyIdAuthFlowFromUrl } from './extOneKeyIdAuthExpandTab';
import { useOneKeyAuth } from './useOneKeyAuth';

// Module-level flag: overlapping flows must not stack. A relay can arrive
// while a previous relay's dialog is still open (the popup focuses this tab
// and rewrites the hash). Dedup of the relay params themselves is handled by
// consumeExtOneKeyIdAuthFlowFromUrl, which strips them from the URL on first
// consume, so remounts and repeated hashchange events are naturally no-ops.
let isFlowRunning = false;

// Auto-resumes a OneKey ID auth flow handed off from the extension action
// popup (see extOneKeyIdAuthExpandTab.ts). Only the expand tab runs the
// flow; everywhere else this component is a no-op.
//
// The handoff arrives in two ways:
// - a freshly created expand tab: the relay params are in the initial URL
//   and are consumed on mount;
// - an EXISTING expand tab reused by bg openExpandTab: chrome.tabs.update
//   with a hash-only URL change is a same-document navigation that does NOT
//   reload the page, so the relay is only observable via the 'hashchange'
//   event (same Chrome behavior that
//   useExtensionMarketTokenDetailHashNavigation works around).
function ExtOneKeyIdAuthOnMountCmp() {
  const { loginOneKeyId } = useOneKeyAuth();

  useEffect(() => {
    if (!platformEnv.isExtensionUiExpandTab) {
      return;
    }
    const runPendingAuthFlow = () => {
      // Consume (and strip) the params even when a flow is already running:
      // the URL must never keep stale relay params that a manual refresh
      // would re-trigger.
      const flowInfo = consumeExtOneKeyIdAuthFlowFromUrl();
      if (!flowInfo) {
        return;
      }
      if (isFlowRunning) {
        // The previous relay's dialog is still open and this tab has just
        // been focused, so the user already sees the flow UI.
        return;
      }
      isFlowRunning = true;
      void (async () => {
        // Let the app finish mounting so the dialog overlay renders reliably.
        await timerUtils.wait(600);
        try {
          if (flowInfo.flow === EExtOneKeyIdAuthFlow.Login) {
            await loginOneKeyId({
              toOneKeyIdPageOnLoginSuccess:
                flowInfo.toOneKeyIdPageOnLoginSuccess,
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
        } finally {
          isFlowRunning = false;
        }
      })();
    };

    runPendingAuthFlow();
    globalThis.addEventListener('hashchange', runPendingAuthFlow);
    return () => {
      globalThis.removeEventListener('hashchange', runPendingAuthFlow);
    };
  }, [loginOneKeyId]);

  return null;
}

export const ExtOneKeyIdAuthOnMount = memo(ExtOneKeyIdAuthOnMountCmp);
