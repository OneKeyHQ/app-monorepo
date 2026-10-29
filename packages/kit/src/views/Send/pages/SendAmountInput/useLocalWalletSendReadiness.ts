import { useEffect, useMemo, useRef } from 'react';

import { useAtomValue } from 'jotai';
import { selectAtom } from 'jotai/utils';
import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { formatPrivacyChainSyncError } from '@onekeyhq/kit/src/utils/privacyChainSyncDisplay';
import { privacyChainAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ILocalWalletSendReadiness } from '@onekeyhq/kit-bg/src/vaults/localWallet/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { PRIVACY_CHAIN_SYNC_POLL_MS } from '@onekeyhq/shared/src/utils/privacyChainSyncPolicy';

import type { IntlShape } from 'react-intl';

export function getLocalWalletSendSyncStatusText({
  readiness,
  intl,
}: {
  readiness: ILocalWalletSendReadiness | undefined;
  intl: Pick<IntlShape, 'formatMessage'>;
}): string | undefined {
  if (readiness?.canSend !== false) return undefined;
  if (readiness.paused) {
    return intl.formatMessage({
      id: ETranslations.privacy_send_private_paused__msg,
    });
  }
  const errorText = formatPrivacyChainSyncError(readiness.syncError, intl);
  if (errorText) return errorText;
  // Published progress already at the tip while the requested pass runs.
  if (readiness.blocksLeft === 0) {
    return intl.formatMessage({ id: ETranslations.global_syncing });
  }
  return intl.formatMessage(
    { id: ETranslations.privacy_send_waiting_sync__msg },
    { blocks: readiness.blocksLeft ?? '—' },
  );
}

// The send page's sync gate. A chain with a blocks-left rule (Monero) is only
// read; one with a send sync (Zcash private pools) syncs on entering the
// amount step and blocks Continue until that sync has caught up.
export function useLocalWalletSendReadiness({
  enabled,
  networkId,
  accountId,
  sourcePool,
}: {
  enabled: boolean;
  networkId: string;
  accountId: string | undefined;
  sourcePool: string | undefined;
}) {
  const intl = useIntl();
  const scope = `${networkId}:${accountId ?? ''}:${sourcePool ?? ''}`;

  // Keyed on account and pool only, so typing an amount never restarts it.
  useEffect(() => {
    if (!enabled || !accountId) return;
    void backgroundApiProxy.servicePrivacyChain
      .requestLocalWalletSendSync({ networkId, accountId, sourcePool })
      .catch(() => undefined);
  }, [enabled, networkId, accountId, sourcePool]);

  const { result, run } = usePromiseResult(
    async () => {
      if (!enabled || !accountId) return undefined;
      const readiness =
        await backgroundApiProxy.servicePrivacyChain.getLocalWalletSendReadiness(
          { networkId, accountId, sourcePool },
        );
      return { scope, readiness };
    },
    [enabled, networkId, accountId, sourcePool, scope],
    {
      pollingInterval: enabled ? PRIVACY_CHAIN_SYNC_POLL_MS : undefined,
    },
  );
  const runRef = useRef(run);
  runRef.current = run;

  // A finished pass publishes progress: read again then, not on the next poll.
  const progressAtom = useMemo(
    () =>
      selectAtom(
        privacyChainAtom.atom(),
        (value) => value.progress[`${networkId}:${accountId ?? ''}`],
      ),
    [networkId, accountId],
  );
  const publishedProgress = useAtomValue(progressAtom);
  const isFirstProgressRef = useRef(true);
  useEffect(() => {
    if (isFirstProgressRef.current) {
      isFirstProgressRef.current = false;
      return;
    }
    if (enabled) void runRef.current();
  }, [enabled, publishedProgress]);

  const isCurrent = enabled && result?.scope === scope;
  const readiness = isCurrent ? result.readiness : undefined;
  return {
    readiness,
    // Unanswered for this account and pool yet: wait rather than let one
    // Continue through.
    isWaitingForSync:
      enabled && !!accountId && (!isCurrent || readiness?.canSend === false),
    statusText: getLocalWalletSendSyncStatusText({ readiness, intl }),
  };
}
