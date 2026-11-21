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
    signal?: AbortSignal;
    holdForChildScan?: () => () => void;
  }
>();

export function getAddressCreationRequestState(
  request?: IAddressCreationRequest,
) {
  if (!request) return 'active';
  if (request.nodeId !== appEventBus.nodeId) return 'foreign';
  const active = activeAddressCreationRequests.get(request.id);
  return !active?.signal?.aborted && active?.canApplyScanResult()
    ? 'active'
    : 'inactive';
}

export function getAddressCreationRequestSignal(
  request?: IAddressCreationRequest,
) {
  if (request?.nodeId === appEventBus.nodeId) {
    return activeAddressCreationRequests.get(request.id)?.signal;
  }
}

export function holdAddressCreationForChildScan(
  request?: IAddressCreationRequest,
) {
  if (!request) return undefined;
  if (getAddressCreationRequestState(request) !== 'active') {
    throw new OneKeyErrorScanQrCodeCancel();
  }
  return activeAddressCreationRequests.get(request.id)?.holdForChildScan?.();
}

export const getAccountIdOnNetwork = async ({
  account,
  network,
  canApplyScanResult,
  scanSignal,
  holdForChildScan,
}: {
  account?: INetworkAccount;
  network: IChainValue['network'];
  canApplyScanResult?: () => boolean;
  scanSignal?: AbortSignal;
  holdForChildScan?: () => () => void;
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
      if (canApplyScanResult) {
        if (!canApplyScanResult()) throw new OneKeyErrorScanQrCodeCancel();
        addressCreationRequest = {
          nodeId: appEventBus.nodeId,
          id: generateUUID(),
        };
        activeAddressCreationRequests.set(addressCreationRequest.id, {
          canApplyScanResult,
          signal: scanSignal,
          holdForChildScan,
        });
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
            },
          );
        return newAccount?.id;
      } finally {
        if (addressCreationRequest) {
          activeAddressCreationRequests.delete(addressCreationRequest.id);
        }
      }
    }
  }
};
