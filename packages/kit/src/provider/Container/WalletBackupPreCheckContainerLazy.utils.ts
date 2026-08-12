import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type {
  EAppEventBusNames,
  IAppEventBusPayload,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

export type IWalletBackupPreCheckPendingEvent =
  IAppEventBusPayload[EAppEventBusNames.CheckWalletBackupStatus];

export async function settleWalletBackupPreCheckPendingEvents({
  error,
  pendingEvents,
  logLoadFailure = false,
}: {
  error: Error;
  pendingEvents: IWalletBackupPreCheckPendingEvent[];
  logLoadFailure?: boolean;
}) {
  if (logLoadFailure) {
    defaultLogger.app.error.log(
      `[WalletBackupPreCheckContainerLazy] load failed: ${error.message}`,
    );
  }
  // The bg callback expires only after a long sweep, so settle every queued
  // request immediately while allowing a future event to retry the import.
  await Promise.allSettled(
    pendingEvents.map((payload) => {
      if (
        payload.walletId &&
        accountUtils.isHdWallet({ walletId: payload.walletId })
      ) {
        // A missing backup check must block sensitive HD-wallet actions.
        return backgroundApiProxy.servicePromise.rejectCallback({
          id: payload.promiseId,
          error,
        });
      }
      return backgroundApiProxy.servicePromise.resolveCallback({
        id: payload.promiseId,
        data: true,
      });
    }),
  );
}
