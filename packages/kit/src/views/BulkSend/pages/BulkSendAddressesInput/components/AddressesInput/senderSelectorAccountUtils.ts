import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IDBWalletType } from '@onekeyhq/kit-bg/src/dbs/local/types';
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

export type IBulkSendAddressWalletCandidate = {
  walletName: string;
  accountName: string;
  accountId: string;
  walletId: string;
  walletType: IDBWalletType;
  isCurrentWallet: boolean;
  isConnected: boolean;
};

type IBulkSendWalletAccountItem = {
  walletName: string;
  accountName: string;
  accountId: string;
  walletId?: string;
  walletType?: IDBWalletType;
  walletDeviceId?: string;
  walletDeviceUsbId?: string;
};

function getBulkSendWalletType(accountId: string): IDBWalletType | undefined {
  if (accountUtils.isHdAccount({ accountId })) {
    return 'hd';
  }

  if (accountUtils.isHwAccount({ accountId })) {
    return 'hw';
  }

  if (accountUtils.isQrAccount({ accountId })) {
    return 'qr';
  }

  if (accountUtils.isImportedAccount({ accountId })) {
    return 'imported';
  }

  if (accountUtils.isExternalAccount({ accountId })) {
    return 'external';
  }

  if (accountUtils.isWatchingAccount({ accountId })) {
    return 'watching';
  }

  return undefined;
}

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
    }) ||
    accountUtils.isQrAccount({
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

function getBulkSendSenderCandidateRank(
  candidate: IBulkSendAddressWalletCandidate,
): number {
  if (candidate.isCurrentWallet) {
    return 0;
  }

  if (candidate.walletType === 'hd') {
    return 1;
  }

  if (candidate.walletType === 'hw') {
    return candidate.isConnected ? 2 : 3;
  }

  if (candidate.walletType === 'imported') {
    return 4;
  }

  if (candidate.walletType === 'qr') {
    return 5;
  }

  if (candidate.walletType === 'external') {
    return 6;
  }

  return 7;
}

async function resolveBulkSendCandidateAccount({
  candidate,
  networkId,
}: {
  candidate: IBulkSendAddressWalletCandidate;
  networkId: string;
}): Promise<
  | {
      accountId: string;
      indexedAccountId?: string;
    }
  | undefined
> {
  if (
    accountUtils.isHdAccount({ accountId: candidate.accountId }) ||
    accountUtils.isHwAccount({ accountId: candidate.accountId }) ||
    accountUtils.isQrAccount({ accountId: candidate.accountId })
  ) {
    const networkAccounts =
      await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountId(
        {
          indexedAccountId: candidate.accountId,
          networkIds: [networkId],
        },
      );
    if (networkAccounts[0]?.account) {
      return {
        accountId: networkAccounts[0].account.id,
        indexedAccountId: candidate.accountId,
      };
    }
    return undefined;
  }

  if (
    accountUtils.isImportedAccount({ accountId: candidate.accountId }) ||
    accountUtils.isExternalAccount({ accountId: candidate.accountId })
  ) {
    return {
      accountId: candidate.accountId,
    };
  }

  return undefined;
}

export async function buildBulkSendSenderCandidates({
  walletAccountItems,
  currentWalletId,
  connectedDeviceIds,
}: {
  walletAccountItems: IBulkSendWalletAccountItem[];
  currentWalletId?: string;
  connectedDeviceIds?: Set<string>;
}): Promise<IBulkSendAddressWalletCandidate[]> {
  const candidates = await Promise.all(
    walletAccountItems.map(async (item) => {
      const walletId =
        item.walletId ||
        accountUtils.getWalletIdFromAccountId({
          accountId: item.accountId,
        });

      const walletType =
        item.walletType || getBulkSendWalletType(item.accountId);

      if (!walletId || !walletType) {
        return undefined;
      }

      const deviceId = item.walletDeviceId;
      const deviceUsbId = item.walletDeviceUsbId;
      const isConnected =
        (deviceId ? (connectedDeviceIds?.has(deviceId) ?? false) : false) ||
        (deviceUsbId ? (connectedDeviceIds?.has(deviceUsbId) ?? false) : false);

      return {
        walletName: item.walletName,
        accountName: item.accountName,
        accountId: item.accountId,
        walletId,
        walletType,
        isCurrentWallet: walletId === currentWalletId,
        isConnected,
      };
    }),
  );

  return candidates.filter(Boolean);
}

export function sortBulkSendSenderCandidates(
  candidates: IBulkSendAddressWalletCandidate[],
): IBulkSendAddressWalletCandidate[] {
  return candidates
    .map((candidate, index) => ({ candidate, index }))
    .toSorted((a, b) => {
      const rankDiff =
        getBulkSendSenderCandidateRank(a.candidate) -
        getBulkSendSenderCandidateRank(b.candidate);

      if (rankDiff !== 0) {
        return rankDiff;
      }

      return a.index - b.index;
    })
    .map(({ candidate }) => candidate);
}

export async function resolveBulkSendSenderSelection({
  walletAccountItems,
  currentWalletId,
  networkId,
  connectedDeviceIds,
}: {
  walletAccountItems: IBulkSendWalletAccountItem[];
  currentWalletId?: string;
  networkId: string;
  connectedDeviceIds?: Set<string>;
}): Promise<
  | {
      type: 'resolved';
      accountId: string;
      indexedAccountId?: string;
      candidate: IBulkSendAddressWalletCandidate;
    }
  | {
      type: 'error';
      errorMessageId: ETranslations;
      candidate?: IBulkSendAddressWalletCandidate;
    }
> {
  const sortedCandidates = sortBulkSendSenderCandidates(
    await buildBulkSendSenderCandidates({
      walletAccountItems,
      currentWalletId,
      connectedDeviceIds,
    }),
  );

  // Always use sortedCandidates — the ranking system already sorts
  // current-wallet candidates to rank 0 (tried first), while still
  // allowing fallback to other wallets when all current-wallet
  // candidates are unusable (e.g., watching accounts).
  const candidatesToResolve = sortedCandidates;
  const preferredCandidate = candidatesToResolve[0];
  let sawWatchingCandidate = false;
  let sawNonWatchingCandidate = false;

  for (const candidate of candidatesToResolve) {
    if (accountUtils.isWatchingAccount({ accountId: candidate.accountId })) {
      sawWatchingCandidate = true;
    } else {
      sawNonWatchingCandidate = true;

      const resolvedAccount = await resolveBulkSendCandidateAccount({
        candidate,
        networkId,
      });
      if (resolvedAccount) {
        return {
          type: 'resolved',
          ...resolvedAccount,
          candidate,
        };
      }
    }
  }

  if (sawWatchingCandidate && !sawNonWatchingCandidate) {
    return {
      type: 'error',
      errorMessageId: ETranslations.wallet_bulk_send_error_watching_account,
      candidate: preferredCandidate,
    };
  }

  return {
    type: 'error',
    errorMessageId: ETranslations.wallet_bulk_send_error_address_not_found,
    candidate: preferredCandidate,
  };
}

export async function resolveBulkSendSenderFallbackSelection({
  fallbackAccountItem,
  currentWalletId,
  networkId,
  connectedDeviceIds,
}: {
  fallbackAccountItem?: IBulkSendSelectorAccountItem;
  currentWalletId?: string;
  networkId: string;
  connectedDeviceIds?: Set<string>;
}): Promise<
  | {
      type: 'resolved';
      accountId: string;
      indexedAccountId?: string;
      candidate: {
        walletName: string;
        accountName: string;
      };
    }
  | {
      type: 'error';
      errorMessageId: ETranslations;
      candidate?: {
        walletName: string;
        accountName: string;
      };
    }
  | undefined
> {
  if (!fallbackAccountItem) {
    return undefined;
  }

  const accountId =
    fallbackAccountItem.indexedAccountId ?? fallbackAccountItem.accountId;
  const selection = await resolveBulkSendSenderSelection({
    walletAccountItems: [
      {
        walletName: fallbackAccountItem.walletName,
        accountName: fallbackAccountItem.accountName,
        accountId,
        walletId: accountUtils.getWalletIdFromAccountId({
          accountId,
        }),
      },
    ],
    currentWalletId,
    networkId,
    connectedDeviceIds,
  });

  if (selection.type === 'error') {
    return {
      type: 'error',
      errorMessageId: selection.errorMessageId,
      candidate: selection.candidate
        ? {
            walletName: selection.candidate.walletName,
            accountName: selection.candidate.accountName,
          }
        : {
            walletName: fallbackAccountItem.walletName,
            accountName: fallbackAccountItem.accountName,
          },
    };
  }

  return {
    type: 'resolved',
    accountId: selection.accountId,
    indexedAccountId: selection.indexedAccountId,
    candidate: {
      walletName: selection.candidate.walletName,
      accountName: selection.candidate.accountName,
    },
  };
}
