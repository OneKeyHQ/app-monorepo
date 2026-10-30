import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import type { ILocalWalletSyncStatus } from '@onekeyhq/kit-bg/src/vaults/localWallet/syncStatus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EGalleryRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';

import type {
  ITokenPrivacyPanelProps,
  ITokenPrivacyPanelState,
} from './TokenPrivacyPanel';
import type { ILocalWalletPool } from './useLocalWalletPool';

const PANEL_STATES: Record<ILocalWalletSyncStatus, ITokenPrivacyPanelState> = {
  unavailable: 'disabled',
  enabling: 'preparing',
  accountPaused: 'stopped',
  off: 'disabled',
  chainPaused: 'stopped',
  storageUnsupported: 'error',
  waitingWifi: 'waitingWifi',
  error: 'error',
  preparing: 'preparing',
  syncing: 'syncing',
  synced: 'synced',
};

// The token page's panel for the account's one sync status.
export function useTokenPrivacyStatus({
  pool: lw,
}: {
  pool: ILocalWalletPool;
}): ITokenPrivacyPanelProps {
  const intl = useIntl();
  const { formatDate } = useFormatDate();
  const status: ILocalWalletSyncStatus | undefined = lw.isUnsupportedWallet
    ? 'unavailable'
    : lw.syncStatus;
  const handleSync = useCallback(() => {
    let action = lw.refreshBalanceNow;
    if (status === 'accountPaused') {
      action = () => lw.enableAccount({});
    } else if (status === 'chainPaused') {
      action = lw.resumeNetworkSync;
    }
    void action().catch((error: unknown) => {
      console.error('[privacyChain] refresh failed', {
        error: error instanceof Error ? error.message : '',
      });
    });
  }, [lw, status]);
  const handleAllowMobileData = useCallback(() => {
    void backgroundApiProxy.servicePrivacyChain.setAllowCellularSync({
      allow: true,
    });
  }, []);
  const state: ITokenPrivacyPanelState =
    lw.isReady && status ? PANEL_STATES[status] : 'preparing';

  let description: string | undefined;
  if (status === 'unavailable') {
    let id = ETranslations.global_not_available;
    if (lw.isTempWallet) {
      id = ETranslations.privacy_temp_wallet_unavailable__desc;
    } else if (lw.isUnsupportedWallet) {
      id = ETranslations.privacy_balance_wallet_not_supported__desc;
    }
    description = intl.formatMessage({ id, defaultMessage: id });
  }
  // The title already names the state; the detail adds figures or the reason.
  let detail: string | undefined;
  if (['syncing', 'waitingWifi', 'error'].includes(state)) {
    detail = lw.syncStatusText ?? undefined;
  }
  let updatedAtLabel: string | undefined;
  if (
    state === 'stopped' &&
    typeof lw.lastSyncedAt === 'number' &&
    lw.lastSyncedAt > 0
  ) {
    updatedAtLabel = intl.formatMessage(
      { id: ETranslations.backup_updated_time },
      { time: formatDate(new Date(lw.lastSyncedAt), { hideTheYear: true }) },
    );
  }
  const progress = lw.syncProgress;

  return {
    state,
    description,
    detail,
    updatedAtLabel,
    enableUnavailable: status === 'unavailable',
    busy: lw.busy,
    // Nothing to retry until the WebView is updated.
    onSync:
      lw.isReady &&
      lw.enabled &&
      status !== 'unavailable' &&
      status !== 'storageUnsupported'
        ? handleSync
        : undefined,
    onAllowMobileData: handleAllowMobileData,
    progress:
      progress &&
      !progress.isBackfillComplete &&
      progress.backfillProgress !== null
        ? progress.backfillProgress * 100
        : undefined,
  };
}

export function TokenPrivacyPreviewEntry() {
  const navigation = useAppNavigation();
  if (!platformEnv.isDev) return null;

  return (
    <Button
      testID="token-privacy-open-preview"
      alignSelf="flex-start"
      mx="$5"
      mb="$3"
      size="small"
      variant="tertiary"
      onPress={() => {
        navigation.pushModal(EModalRoutes.DeveloperModal, {
          screen: EGalleryRoutes.ComponentPrivacyTokenDetails,
        });
      }}
    >
      Preview UI states
    </Button>
  );
}
