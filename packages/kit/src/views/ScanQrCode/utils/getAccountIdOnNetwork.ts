import { rootNavigationRef } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IChainValue } from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import { OneKeyErrorScanQrCodeCancel } from '@onekeyhq/shared/src/errors';
import {
  type IAddressCreationRequest,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

const activeAddressCreationRequests = new Map<
  string,
  {
    canApplyScanResult: () => boolean;
    controller: AbortController;
    holdForChildScan?: () => () => void;
    awaitingLinkedScannerFocus?: boolean;
  }
>();
const addressCreationRequestByScan = new WeakMap<AbortSignal, string>();

export function getAddressCreationRequestState(
  request?: IAddressCreationRequest,
) {
  if (!request) return 'active';
  if (request.nodeId !== appEventBus.nodeId) return 'foreign';
  const active = activeAddressCreationRequests.get(request.id);
  return active &&
    !active.controller.signal.aborted &&
    active.canApplyScanResult()
    ? 'active'
    : 'inactive';
}

export function getAddressCreationRequestSignal(
  request?: IAddressCreationRequest,
) {
  if (request?.nodeId === appEventBus.nodeId) {
    return activeAddressCreationRequests.get(request.id)?.controller.signal;
  }
}

export function cancelAddressCreationRequest(
  request?: IAddressCreationRequest,
) {
  if (request?.nodeId === appEventBus.nodeId) {
    activeAddressCreationRequests.get(request.id)?.controller.abort();
  }
}

export function holdAddressCreationForChildScan(
  request?: IAddressCreationRequest,
) {
  if (!request) return undefined;
  if (getAddressCreationRequestState(request) !== 'active') {
    throw new OneKeyErrorScanQrCodeCancel();
  }
  const active = activeAddressCreationRequests.get(request.id);
  const release = active?.holdForChildScan?.();
  if (release && active) active.awaitingLinkedScannerFocus = true;
  return release;
}

export async function waitForAddressCreationRequestFocus(
  request?: IAddressCreationRequest,
) {
  if (!request) return;
  const active =
    request.nodeId === appEventBus.nodeId
      ? activeAddressCreationRequests.get(request.id)
      : undefined;
  if (!active || active.controller.signal.aborted) {
    throw new OneKeyErrorScanQrCodeCancel();
  }
  if (!active.canApplyScanResult()) {
    const navigation = rootNavigationRef.current;
    if (!active.awaitingLinkedScannerFocus || !navigation) {
      throw new OneKeyErrorScanQrCodeCancel();
    }
    const signal = active.controller.signal;
    const focused = Promise.withResolvers<void>();
    const cancel = () => focused.reject(new OneKeyErrorScanQrCodeCancel());
    const onNavigationState = () => {
      if (activeAddressCreationRequests.get(request.id) !== active) {
        cancel();
      } else if (active.canApplyScanResult()) {
        focused.resolve();
      }
    };
    const unsubscribe = navigation.addListener('state', onNavigationState);
    signal.addEventListener('abort', cancel, { once: true });
    try {
      if (signal.aborted) cancel();
      else onNavigationState();
      await focused.promise;
    } finally {
      unsubscribe();
      signal.removeEventListener('abort', cancel);
    }
  }
  active.awaitingLinkedScannerFocus = false;
}

export const getAccountIdOnNetwork = async ({
  account,
  network,
  canApplyScanResult,
  scanSignal,
  holdForChildScan,
  lightningInvoiceExpiresAt,
}: {
  account?: INetworkAccount;
  network: IChainValue['network'];
  canApplyScanResult?: () => boolean;
  scanSignal?: AbortSignal;
  holdForChildScan?: () => () => void;
  lightningInvoiceExpiresAt?: number;
}) => {
  if (account?.indexedAccountId) {
    const { accounts } =
      await backgroundApiProxy.serviceAccount.getAccountsInSameIndexedAccountId(
        {
          indexedAccountId: account?.indexedAccountId ?? '',
        },
      );
    const networkAccount = accounts.find((item) => item.impl === network?.impl);
    if (networkAccount) {
      return networkAccount.id;
    }
    // need create account on network
    if (account?.id) {
      let addressCreationRequest: IAddressCreationRequest | undefined;
      let detachScanAbort: (() => void) | undefined;
      if (canApplyScanResult) {
        const previousRequestId =
          scanSignal && addressCreationRequestByScan.get(scanSignal);
        const previousRequest = previousRequestId
          ? activeAddressCreationRequests.get(previousRequestId)
          : undefined;
        if (
          scanSignal?.aborted ||
          !canApplyScanResult() ||
          previousRequest?.canApplyScanResult()
        ) {
          throw new OneKeyErrorScanQrCodeCancel();
        }
        addressCreationRequest = {
          nodeId: appEventBus.nodeId,
          id: generateUUID(),
        };
        const controller = new AbortController();
        const abort = () => controller.abort();
        scanSignal?.addEventListener('abort', abort, { once: true });
        detachScanAbort = () => scanSignal?.removeEventListener('abort', abort);
        activeAddressCreationRequests.set(addressCreationRequest.id, {
          canApplyScanResult,
          controller,
          holdForChildScan,
        });
        if (scanSignal) {
          addressCreationRequestByScan.set(
            scanSignal,
            addressCreationRequest.id,
          );
        }
        previousRequest?.controller.abort();
      }
      try {
        const newAccount =
          await backgroundApiProxy.serviceAccount.createAddressIfNotExists(
            {
              walletId: accountUtils.getWalletIdFromAccountId({
                accountId: account.id,
              }),
              networkId: network?.id || '',
              accountId: account.id,
              indexedAccountId: account.indexedAccountId,
            },
            {
              allowWatchAccount: false,
              addressCreationRequest,
              lightningInvoiceExpiresAt,
            },
          );
        return newAccount?.id;
      } finally {
        detachScanAbort?.();
        if (addressCreationRequest) {
          activeAddressCreationRequests.delete(addressCreationRequest.id);
          if (
            scanSignal &&
            addressCreationRequestByScan.get(scanSignal) ===
              addressCreationRequest.id
          ) {
            addressCreationRequestByScan.delete(scanSignal);
          }
        }
      }
    }
  }
};
