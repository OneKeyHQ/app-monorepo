import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import type { ILocalWalletSyncStatus } from '@onekeyhq/kit-bg/src/utils/privacyChainSyncStatus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EGalleryRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';

import { getLocalWalletSyncAction } from './useLocalWalletPool';

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
  ownerKey,
}: {
  pool: ILocalWalletPool;
  ownerKey: string;
}): ITokenPrivacyPanelProps {
  const intl = useIntl();
  const { formatDate } = useFormatDate();
  type IControlRequest = { ownerKey: string; pool: ILocalWalletPool };
  const requestRef = useRef<IControlRequest>(undefined);
  const [pendingControl, setPendingControl] = useState<IControlRequest>();
  const canKeepDisplay =
    lw.isReady &&
    lw.enabled &&
    !lw.isUnsupportedWallet &&
    lw.syncStatus !== 'error' &&
    lw.syncStatus !== 'storageUnsupported' &&
    lw.syncStatus !== 'unavailable' &&
    lw.syncStatus !== 'off';
  const currentControl =
    pendingControl?.ownerKey === ownerKey ? pendingControl : undefined;
  // Account state and scan progress arrive separately while a control request runs.
  // Keep the previous panel and its action slot until that request settles.
  const display = currentControl && canKeepDisplay ? currentControl.pool : lw;
  useEffect(() => {
    if (pendingControl && (!currentControl || !canKeepDisplay)) {
      setPendingControl(undefined);
    }
  }, [canKeepDisplay, currentControl, pendingControl]);
  useEffect(
    () => () => {
      requestRef.current = undefined;
    },
    [],
  );
  const runControl = useCallback(
    async (operation: () => Promise<void>) => {
      if (requestRef.current?.ownerKey === ownerKey || lw.actionBusy) return;
      const request = { ownerKey, pool: lw };
      requestRef.current = request;
      setPendingControl(request);
      try {
        await operation();
      } finally {
        if (requestRef.current === request) {
          requestRef.current = undefined;
          setPendingControl(undefined);
        }
      }
    },
    [lw, ownerKey],
  );
  const status: ILocalWalletSyncStatus | undefined = display.isUnsupportedWallet
    ? 'unavailable'
    : display.syncStatus;
  const handleSync = useCallback(() => {
    void runControl(getLocalWalletSyncAction(lw)).catch((error: unknown) => {
      console.error('[privacyChain] refresh failed', {
        error: error instanceof Error ? error.message : '',
      });
    });
  }, [lw, runControl]);
  const handleAllowMobileData = useCallback(() => {
    void backgroundApiProxy.servicePrivacyChain.setAllowCellularSync({
      allow: true,
    });
  }, []);
  const handleStop = useCallback(() => {
    void runControl(lw.pauseSync).catch((error: unknown) => {
      console.error('[privacyChain] pause failed', {
        error: error instanceof Error ? error.message : '',
      });
    });
  }, [lw, runControl]);
  const state: ITokenPrivacyPanelState =
    display.isReady && status ? PANEL_STATES[status] : 'preparing';

  let description: string | undefined;
  if (status === 'unavailable') {
    let id = ETranslations.global_not_available;
    if (display.isTempWallet) {
      id = ETranslations.privacy_temp_wallet_unavailable__desc;
    } else if (display.isUnsupportedWallet) {
      id = ETranslations.privacy_balance_wallet_not_supported__desc;
    }
    description = intl.formatMessage({ id, defaultMessage: id });
  }
  // The title already names the state; the detail adds figures or the reason.
  let detail: string | undefined;
  if (['syncing', 'waitingWifi', 'error'].includes(state)) {
    detail = display.syncStatusText ?? undefined;
  }
  let updatedAtLabel: string | undefined;
  if (
    state === 'stopped' &&
    typeof display.lastSyncedAt === 'number' &&
    display.lastSyncedAt > 0
  ) {
    updatedAtLabel = intl.formatMessage(
      { id: ETranslations.backup_updated_time },
      {
        time: formatDate(new Date(display.lastSyncedAt), { hideTheYear: true }),
      },
    );
  }
  const progress = display.syncProgress;
  const canPause =
    display.isReady &&
    display.enabled &&
    display.state?.pendingOperation !== 'enable' &&
    (status === 'syncing' || status === 'preparing');

  return {
    state,
    description,
    detail,
    updatedAtLabel,
    enableUnavailable: status === 'unavailable',
    busy: Boolean(currentControl) || (canPause ? lw.actionBusy : lw.busy),
    onStop: canPause ? handleStop : undefined,
    // Nothing to retry until the WebView is updated.
    onSync:
      display.isReady &&
      display.enabled &&
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
