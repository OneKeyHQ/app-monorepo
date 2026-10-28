import { useCallback, useMemo } from 'react';

import { useAtomValue } from 'jotai';
import { selectAtom } from 'jotai/utils';
import { useIntl } from 'react-intl';

import { Button } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { privacyChainAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EGalleryRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';

import type {
  ITokenPrivacyPanelProps,
  ITokenPrivacyPanelState,
} from './TokenPrivacyPanel';
import type { ILocalWalletPool } from './useLocalWalletPool';

// Keep status presentation aligned with the shared account sync controls.
export function useTokenPrivacyStatus({
  networkId,
  pool: lw,
}: {
  networkId: string;
  pool: ILocalWalletPool;
}): ITokenPrivacyPanelProps {
  const intl = useIntl();
  const dataBlockedAtom = useMemo(
    () =>
      selectAtom(privacyChainAtom.atom(), (value) =>
        value.dataBlockedNetworkIds.includes(networkId),
      ),
    [networkId],
  );
  const dataBlocked = useAtomValue(dataBlockedAtom);
  const preparingAtom = useMemo(
    () =>
      selectAtom(privacyChainAtom.atom(), (value) =>
        value.preparingNetworkIds.includes(networkId),
      ),
    [networkId],
  );
  const networkPreparing = useAtomValue(preparingAtom);
  const handleSync = useCallback(() => {
    let action = lw.refreshBalanceNow;
    if (lw.state?.paused) {
      action = () => lw.enableAccount({});
    } else if (lw.isNetworkPaused) {
      action = lw.resumeNetworkSync;
    }
    void action().catch((error: unknown) => {
      console.error('[privacyChain] refresh failed', {
        error: error instanceof Error ? error.message : '',
      });
    });
  }, [lw]);
  const progress = lw.syncProgress;
  let state: ITokenPrivacyPanelState = 'preparing';
  let description: string | undefined;
  let detail: string | undefined;

  if (
    lw.isReady &&
    lw.isStateSettled &&
    lw.state?.pendingOperation !== 'enable'
  ) {
    if (!lw.enabled) {
      state = 'disabled';
    } else if (
      lw.state?.paused &&
      !lw.isNetworkPaused &&
      lw.lastSyncedAt !== undefined
    ) {
      // Rotated out of the sync slots: reads as synced up to its last
      // catch-up, and Sync resumes it.
      state = 'synced';
    } else if (lw.isSyncPaused) {
      state = 'stopped';
    } else if (lw.hasSyncError) {
      state = 'error';
      detail = lw.syncStatusText ?? undefined;
    } else if (dataBlocked || networkPreparing || lw.isPreparing) {
      state = 'preparing';
    } else if (progress?.isSyncing) {
      state = 'syncing';
    } else if (progress?.isBackfillComplete && progress.isTipCaughtUp) {
      state = 'synced';
    }
  }

  if (lw.isUnsupportedWallet) {
    state = 'disabled';
    const id = lw.isTempWallet
      ? ETranslations.privacy_temp_wallet_unavailable__desc
      : ETranslations.privacy_balance_wallet_not_supported__desc;
    description = intl.formatMessage({ id, defaultMessage: id });
  }
  if (lw.state?.privacyDisabled) {
    state = 'disabled';
    description = intl.formatMessage({
      id: ETranslations.global_not_available,
    });
  }

  if (state !== 'error') {
    if (dataBlocked && state === 'preparing') {
      detail = intl.formatMessage({
        id: ETranslations.privacy_sync_waiting_wifi__msg,
      });
    } else if (state === 'syncing' || state === 'stopped') {
      detail = lw.syncStatusText ?? undefined;
    }
  }

  return {
    state,
    description,
    detail,
    enableUnavailable: lw.isUnsupportedWallet || !!lw.state?.privacyDisabled,
    busy: lw.busy,
    onSync:
      lw.isReady &&
      lw.enabled &&
      !lw.isUnsupportedWallet &&
      !lw.state?.privacyDisabled
        ? handleSync
        : undefined,
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
