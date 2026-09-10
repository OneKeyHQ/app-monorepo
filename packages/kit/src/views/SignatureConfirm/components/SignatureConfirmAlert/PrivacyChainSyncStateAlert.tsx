import { Alert } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import { usePrivacyChainBoost } from '@onekeyhq/kit/src/hooks/usePrivacyChainBoost';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  PRIVACY_CHAIN_SYNC_POLL_MS,
  isTipLagWorthMentioning,
} from '@onekeyhq/shared/src/utils/privacyChainSyncPolicy';

// Ledger-style sync-state banner inside the send confirm flow: the pool block
// on TokenDetails shows the same facts, but the user composing a send is on
// THIS page when "why can't I spend yet" matters. Never blocks anything --
// the form's own validation does the blocking; this explains it.
//
// Which chains get it is a capability question (`localWallet`), not a
// chain-name one: any wallet whose balance is scanned client-side can be
// mid-scan while its owner is trying to spend.
function PrivacyChainSyncStateAlert({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
}) {
  // Capability off useAccountData, not a fetch of its own: awaiting the
  // settings inside the poll put a round trip in FRONT of the progress read,
  // on every poll, which is precisely the wait this alert is meant to explain.
  const { vaultSettings } = useAccountData({ networkId, accountId });
  const hasLocalWallet = !!vaultSettings?.localWallet;

  // The one place where waiting on the scan has a cost the user can feel: the
  // spendable balance caps what this form will let them send. Catching up at
  // full speed while they are composing is the difference between "I can't
  // send my own money" and a wait with a number on it. Ends with the page.
  usePrivacyChainBoost({
    networkId,
    accountId,
    trigger: 'compose-send',
    enabled: hasLocalWallet,
  });

  const { result: progress } = usePromiseResult(
    async () => {
      if (!accountId || !hasLocalWallet) return null;
      return backgroundApiProxy.servicePrivacyChain.getLocalWalletSyncProgress({
        networkId,
        accountId,
      });
    },
    [networkId, accountId, hasLocalWallet],
    {
      pollingInterval: hasLocalWallet ? PRIVACY_CHAIN_SYNC_POLL_MS : undefined,
    },
  );

  if (!progress) return null;

  if (!progress.isBackfillComplete) {
    const pct =
      progress.backfillProgress === null
        ? ''
        : ` ${Math.floor(progress.backfillProgress * 100)}%`;
    return (
      <Alert
        type="info"
        icon="RefreshCcwOutline"
        title={`Private history is still syncing${pct} — the spendable balance may grow as it completes.`}
      />
    );
  }
  if (
    isTipLagWorthMentioning(
      progress.tipLag,
      vaultSettings?.localWallet?.tipLagWarningBlocks ??
        Number.MAX_SAFE_INTEGER,
    )
  ) {
    return (
      <Alert
        type="default"
        icon="ClockTimeHistoryOutline"
        title="Private balance may be slightly out of date — it refreshes automatically while you are here."
      />
    );
  }
  return null;
}

export default PrivacyChainSyncStateAlert;
