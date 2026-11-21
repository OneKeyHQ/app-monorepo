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

const activeAddressCreationRequests = new Map<string, () => boolean>();

export function getAddressCreationRequestState(
  request?: IAddressCreationRequest,
) {
  if (!request) return 'active';
  if (request.nodeId !== appEventBus.nodeId) return 'foreign';
  return activeAddressCreationRequests.get(request.id)?.()
    ? 'active'
    : 'inactive';
}

export const getAccountIdOnNetwork = async ({
  account,
  network,
  canApplyScanResult,
}: {
  account?: INetworkAccount;
  network: IChainValue['network'];
  canApplyScanResult?: () => boolean;
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
        activeAddressCreationRequests.set(
          addressCreationRequest.id,
          canApplyScanResult,
        );
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
