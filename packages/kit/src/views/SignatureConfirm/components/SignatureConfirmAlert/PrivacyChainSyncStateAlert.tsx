import { useIntl } from 'react-intl';

import { Alert } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePrivacyChainBoost } from '@onekeyhq/kit/src/hooks/usePrivacyChainBoost';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { formatPrivacyChainPercent } from '@onekeyhq/kit/src/utils/privacyChainSyncDisplay';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { PRIVACY_CHAIN_SYNC_POLL_MS } from '@onekeyhq/shared/src/utils/privacyChainSyncPolicy';

// Explains a capped spendable balance while a local wallet is still scanning;
// it never blocks, the form's own validation does.
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

  // The spendable balance caps this send, so catch up at full speed meanwhile.
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
  // Resolved once, outside the poll, so no round trip precedes each progress read.
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
