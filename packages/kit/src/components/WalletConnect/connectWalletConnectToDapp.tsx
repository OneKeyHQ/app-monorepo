import { useEffect, useRef } from 'react';

import { Dialog } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { WALLET_CONNECT_RELAY_URL } from '@onekeyhq/shared/src/walletConnect/constant';
import { getWalletConnectAttemptBaseline } from '@onekeyhq/shared/src/walletConnect/diagnostics';
import type { IWalletConnectDiagnostics } from '@onekeyhq/shared/src/walletConnect/diagnostics';

import {
  WALLET_CONNECT_PROGRESS_MAX_ATTEMPTS,
  WalletConnectConnectionProgressView,
} from './WalletConnectConnectionProgressView';

type IConnectionProgress = Pick<
  IWalletConnectDiagnostics,
  | 'connected'
  | 'connecting'
  | 'providerConnecting'
  | 'connectionAttempts'
  | 'lastFailedConnectionAttempt'
  | 'connectionSuccesses'
  | 'relaySwitchPending'
  | 'relayUrl'
>;

function WalletConnectConnectionProgress({
  initial,
  onFinished,
}: {
  initial?: IConnectionProgress;
  onFinished: (reason?: 'exhausted') => Promise<void>;
}) {
  const { result } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceWalletConnect
        .getWalletSideDiagnostics()
        .catch(() => undefined),
    [],
    {
      pollingInterval: 1000,
      checkIsFocused: false,
      revalidateOnReconnect: true,
    },
  );
  const baseline = useRef(initial);
  baseline.current ??= result;
  const started = baseline.current;

  // Count attempts for this interaction, including an in-flight attempt that
  // started during session restoration before the user scanned or opened a link.
  const attemptsBeforeInteraction = getWalletConnectAttemptBaseline(started);
  const attempt = Math.max(
    0,
    (result?.connectionAttempts ?? initial?.connectionAttempts ?? 0) -
      attemptsBeforeInteraction,
  );

  const connected = Boolean(
    result?.connected ||
    (started &&
      result &&
      result.connectionSuccesses > started.connectionSuccesses),
  );
  const exhausted = Boolean(
    result &&
    (result.lastFailedConnectionAttempt - attemptsBeforeInteraction >=
      WALLET_CONNECT_PROGRESS_MAX_ATTEMPTS ||
      attempt > WALLET_CONNECT_PROGRESS_MAX_ATTEMPTS),
  );

  useEffect(() => {
    if (connected || exhausted) {
      // Dismiss only the UI. SDK heartbeat, network recovery and relay fallback
      // continue independently, and cannot reopen this interaction's dialog.
      void onFinished(connected ? undefined : 'exhausted');
    }
  }, [connected, exhausted, onFinished]);

  return (
    <WalletConnectConnectionProgressView
      progress={{
        attempt,
        relayUrl:
          result?.relayUrl ?? initial?.relayUrl ?? WALLET_CONNECT_RELAY_URL,
      }}
    />
  );
}

type IConnectionDialog = {
  close: (reason?: 'exhausted') => Promise<void>;
  onClose: () => void;
  pendingConnections: number;
  attemptsBeforeInteraction: number;
};

let activeDialog: IConnectionDialog | undefined;
let progressGeneration = 0;

export async function closeWalletConnectConnectionProgress() {
  // Invalidate a pending diagnostics read so it cannot show loading over the
  // session proposal after navigation has already started.
  progressGeneration += 1;
  await activeDialog?.close();
}

// Register with the progress module, before a scan can show or queue loading.
// Direct proposal navigation does not depend on any React listener mounting.
appEventBus.on(EAppEventBusNames.WalletConnectCloseConnectionProgress, () => {
  void closeWalletConnectConnectionProgress().catch(() => undefined);
});

function isPairingUri(uri: string) {
  if (!/^wc:(?:\/\/)?[a-f\d]{64}@2\?/i.test(uri)) return false;
  const params = new URLSearchParams(uri.slice(uri.indexOf('?') + 1));
  return (
    /^[a-f\d]{64}$/i.test(params.get('symKey') ?? '') &&
    Boolean(params.get('relay-protocol'))
  );
}

// Only explicit UI entry points call this helper. Background session restoration
// and SDK reconnects never create a dialog.
export async function connectWalletConnectToDapp(uri: string) {
  if ((!platformEnv.isNative && !platformEnv.isDesktop) || !isPairingUri(uri)) {
    return backgroundApiProxy.walletConnect.connectToDapp(uri);
  }

  const generation = progressGeneration;
  let progress = activeDialog;
  let initial: IConnectionProgress | undefined;
  if (progress) {
    initial = await backgroundApiProxy.serviceWalletConnect
      .getWalletSideDiagnostics()
      .catch(() => undefined);
    progress = activeDialog;
    if (
      progress &&
      initial &&
      initial.lastFailedConnectionAttempt -
        progress.attemptsBeforeInteraction >=
        WALLET_CONNECT_PROGRESS_MAX_ATTEMPTS
    ) {
      // A retry can arrive before the old dialog's next polling tick.
      // Give it a fresh counter instead of joining an exhausted interaction.
      await progress.close('exhausted');
      progress = activeDialog;
    }
  }
  if (!progress) {
    initial ??= await backgroundApiProxy.serviceWalletConnect
      .getWalletSideDiagnostics()
      .catch(() => undefined);
    // Another scan or deep link may have opened the dialog during the RPC.
    progress = activeDialog;
    if (!progress && !initial?.connected && generation === progressGeneration) {
      let closed = false;
      let exhausted = false;
      const dialogRef: { current?: ReturnType<typeof Dialog.show> } = {};
      const connectionDialog: IConnectionDialog = {
        pendingConnections: 0,
        attemptsBeforeInteraction: getWalletConnectAttemptBaseline(initial),
        onClose: () => {
          closed = true;
          if (activeDialog === connectionDialog) {
            // Exhaustion must not invalidate a new scan awaiting diagnostics.
            if (!exhausted) progressGeneration += 1;
            activeDialog = undefined;
          }
        },
        close: async (reason) => {
          if (closed) return;
          exhausted = reason === 'exhausted';
          // Release ownership before the UI callback, which may fail or stall.
          connectionDialog.onClose();
          try {
            await dialogRef.current?.close();
          } catch {
            // Progress dismissal must not interfere with pairing or later scans.
          }
        },
      };
      dialogRef.current = Dialog.show({
        showFooter: false,
        showExitButton: true,
        dismissOnOverlayPress: false,
        disableDrag: true,
        onClose: connectionDialog.onClose,
        renderContent: (
          <WalletConnectConnectionProgress
            initial={initial}
            onFinished={connectionDialog.close}
          />
        ),
      });
      activeDialog = connectionDialog;
      progress = connectionDialog;
    }
  }

  if (progress) progress.pendingConnections += 1;
  try {
    await backgroundApiProxy.walletConnect.connectToDapp(uri);
  } catch (error) {
    if (progress?.pendingConnections === 1) void progress.close();
    throw error;
  } finally {
    if (progress) progress.pendingConnections -= 1;
  }
}
