import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

export type IBulkSendSelectorAccountItem = {
  address: string;
  walletName: string;
  accountName: string;
  accountId: string;
  indexedAccountId?: string;
};

export type IBulkSendSenderSelectorAccountItem = IBulkSendSelectorAccountItem;

export const buildBulkSendSelectorAddressKey = (address: string) =>
  address.trim();

export const buildSenderSelectorAddressKey = buildBulkSendSelectorAddressKey;

type IResolvedBulkSendSelectorFallback =
  | {
      type: 'resolved';
      accountId: string;
      indexedAccountId?: string;
    }
  | {
      type: 'error';
      errorMessageId: ETranslations;
    };

export async function resolveBulkSendSelectorFallbackAccount({
  fallbackAccountItem,
  networkId,
}: {
  fallbackAccountItem?: IBulkSendSelectorAccountItem;
  networkId: string;
}): Promise<IResolvedBulkSendSelectorFallback | undefined> {
  if (!fallbackAccountItem) {
    return undefined;
  }

  if (
    accountUtils.isWatchingAccount({
      accountId: fallbackAccountItem.accountId,
    })
  ) {
    return {
      type: 'error',
      errorMessageId: ETranslations.wallet_bulk_send_error_watching_account,
    };
  }

  if (
    accountUtils.isHdAccount({
      accountId: fallbackAccountItem.accountId,
    }) ||
    accountUtils.isHwAccount({
      accountId: fallbackAccountItem.accountId,
    })
  ) {
    if (!fallbackAccountItem.indexedAccountId) {
      return {
        type: 'error',
        errorMessageId: ETranslations.wallet_bulk_send_error_address_not_found,
      };
    }

    try {
      const networkAccounts =
        await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountId(
          {
            indexedAccountId: fallbackAccountItem.indexedAccountId,
            networkIds: [networkId],
          },
        );
      if (networkAccounts[0]?.account) {
        return {
          type: 'resolved',
          accountId: networkAccounts[0].account.id,
          indexedAccountId: fallbackAccountItem.indexedAccountId,
        };
      }
    } catch {
      // Fall through to a validation error when the target-network account
      // cannot be resolved.
    }

    return {
      type: 'error',
      errorMessageId: ETranslations.wallet_bulk_send_error_address_not_found,
    };
  }

  return {
    type: 'resolved',
    accountId: fallbackAccountItem.accountId,
    indexedAccountId: fallbackAccountItem.indexedAccountId,
  };
}

export const resolveSenderSelectorFallbackAccount =
  resolveBulkSendSelectorFallbackAccount;
