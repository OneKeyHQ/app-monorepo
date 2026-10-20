import { useIntl } from 'react-intl';

import { Alert } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePrivacyChainBoost } from '@onekeyhq/kit/src/hooks/usePrivacyChainBoost';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { formatPrivacyChainPercent } from '@onekeyhq/kit/src/utils/privacyChainSyncDisplay';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { PRIVACY_CHAIN_SYNC_POLL_MS } from '@onekeyhq/shared/src/utils/privacyChainSyncPolicy';

// Ledger-style sync-state banner inside the send confirm flow: the pool block
// on TokenDetails shows the same facts, but the user composing a send is on
// THIS page when "why can't I spend yet" matters. Never blocks anything --
// the form's own validation does the blocking; this explains it.
//
// Which chains get it is a capability question (`localWallet`), not a
// chain-name one: any wallet whose balance is scanned client-side can be
// mid-scan while its owner is trying to spend.
function LocalWalletSyncStateAlert({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
}) {
  const intl = useIntl();
  // An account that never turned privacy on has no scan to wait for.
  const { result: accountState } = usePromiseResult(async () => {
    if (!accountId) return undefined;
    return backgroundApiProxy.servicePrivacyChain
      .getLocalWalletAccountState({ networkId, accountId })
      .catch(() => undefined);
  }, [networkId, accountId]);
  const isScanning = accountState?.enabled === true;

  // The one place where waiting on the scan has a cost the user can feel: the
  // spendable balance caps what this form will let them send. Catching up at
  // full speed while they are composing is the difference between "I can't
  // send my own money" and a wait with a number on it. Ends with the page.
  usePrivacyChainBoost({
    networkId,
    accountId,
    trigger: 'compose-send',
    enabled: isScanning,
  });

  const { result: progress } = usePromiseResult(
    async () => {
      if (!accountId || !isScanning) return null;
      return backgroundApiProxy.servicePrivacyChain.getLocalWalletSyncProgress({
        networkId,
        accountId,
      });
    },
    [networkId, accountId, isScanning],
    {
      pollingInterval: isScanning ? PRIVACY_CHAIN_SYNC_POLL_MS : undefined,
    },
  );

  if (!progress) return null;

  if (!progress.isBackfillComplete) {
    const pct =
      progress.backfillProgress === null
        ? ''
        : ` ${formatPrivacyChainPercent(progress.backfillProgress)}`;
    return (
      <Alert
        type="info"
        icon="RefreshCcwOutline"
        title={intl.formatMessage(
          {
            id: ETranslations.privacy_send_history_syncing__msg,
          },
          { pct },
        )}
      />
    );
  }
  return null;
}

function PrivacyChainSyncStateAlert({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
}) {
  // Resolved once, outside the poll: awaiting the settings inside it put a
  // round trip in FRONT of the progress read, on every poll, which is
  // precisely the wait this alert is meant to explain. Other chains mount
  // nothing past this check.
  const { result: vaultSettings } = usePromiseResult(
    () => backgroundApiProxy.serviceNetwork.getVaultSettings({ networkId }),
    [networkId],
  );
  if (!vaultSettings?.localWallet) return null;
  return (
    <LocalWalletSyncStateAlert networkId={networkId} accountId={accountId} />
  );
}

export default PrivacyChainSyncStateAlert;
