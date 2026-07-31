import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

export type IBulkExportHistoryAccountIdentity =
  | {
      type: 'indexed';
      indexedAccountId: string;
    }
  | {
      type: 'singleton';
      accountId: string;
    };

export type IBulkExportHistoryAccountMeta = {
  accountAddress: string | undefined;
  xpub: string | undefined;
};

export type IBulkExportHistoryAccountMetaMap = Record<
  string,
  IBulkExportHistoryAccountMeta | undefined
>;

export type IBulkExportHistoryAccountNetworkCompatibility =
  | {
      accountId: string;
      walletId?: never;
    }
  | {
      accountId?: never;
      walletId: string;
    };

export function resolveBulkExportHistoryAccountIdentity({
  accountId,
  indexedAccountId,
}: {
  accountId: string | undefined;
  indexedAccountId: string | undefined;
}): IBulkExportHistoryAccountIdentity | undefined {
  if (indexedAccountId) {
    return {
      type: 'indexed',
      indexedAccountId,
    };
  }

  if (
    !accountId ||
    accountUtils.isUrlAccountFn({ accountId }) ||
    (!accountUtils.isWatchingAccount({ accountId }) &&
      !accountUtils.isImportedAccount({ accountId }))
  ) {
    return undefined;
  }

  return {
    type: 'singleton',
    accountId,
  };
}

export function getBulkExportHistoryAccountTypeForTracking(
  accountIdentity: IBulkExportHistoryAccountIdentity,
): 'indexed' | 'watching' | 'imported' {
  if (accountIdentity.type === 'indexed') {
    return 'indexed';
  }
  return accountUtils.isWatchingAccount({
    accountId: accountIdentity.accountId,
  })
    ? 'watching'
    : 'imported';
}

export function getBulkExportHistoryAccountIdentifiers(
  accountMeta: IBulkExportHistoryAccountMeta | undefined,
): string[] {
  return Array.from(
    new Set(
      [accountMeta?.accountAddress, accountMeta?.xpub].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  );
}

export function getBulkExportHistoryAccountNetworkCompatibility({
  accountIdentity,
  indexedAccountWalletId,
}: {
  accountIdentity: IBulkExportHistoryAccountIdentity | undefined;
  indexedAccountWalletId: string | undefined;
}): IBulkExportHistoryAccountNetworkCompatibility | undefined {
  if (accountIdentity?.type === 'singleton') {
    return { accountId: accountIdentity.accountId };
  }
  if (accountIdentity?.type === 'indexed' && indexedAccountWalletId) {
    return { walletId: indexedAccountWalletId };
  }
  return undefined;
}

// Look up the indexed account's network account under the global derive type.
// The lookup throws "record not found" when the account has never been derived
// on that network (e.g. a task list containing BCH/DOGE tasks created by
// another account); bulk export treats that as "owns no addresses on this
// network" rather than an error, mirroring the tolerant per-derive-type lookup
// in ServiceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes.
// Derive type resolution failures still propagate as genuine errors.
export async function getBulkExportHistoryNetworkAccountSafe({
  networkId,
  indexedAccountId,
}: {
  networkId: string;
  indexedAccountId: string;
}): Promise<INetworkAccount | undefined> {
  const deriveType =
    await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
      networkId,
    });
  try {
    const { accounts } =
      await backgroundApiProxy.serviceAccount.getAccountsByIndexedAccounts({
        indexedAccountIds: [indexedAccountId],
        networkId,
        deriveType,
      });
    return accounts[0];
  } catch (error) {
    // Only the "record not found" thrown for never-derived accounts is
    // tolerated; any other failure (DB open, bridge call, etc.) must reach
    // the caller so the page shows a retry state instead of silently
    // dropping the account's tasks.
    if (
      errorUtils.isErrorByClassName({
        error,
        className: EOneKeyErrorClassNames.LocalDBRecordNotFoundError,
      })
    ) {
      return undefined;
    }
    throw error;
  }
}

export function buildBulkExportHistoryAccountIdentifierMap({
  networkIds,
  accountMetaMap,
}: {
  networkIds: string[];
  accountMetaMap: IBulkExportHistoryAccountMetaMap | undefined;
}): {
  networkIdToAddressArray: Record<string, string[]>;
  missingNetworkIds: string[];
} {
  const networkIdToAddressArray = Object.fromEntries(
    networkIds.map((networkId) => [
      networkId,
      getBulkExportHistoryAccountIdentifiers(accountMetaMap?.[networkId]),
    ]),
  );
  return {
    networkIdToAddressArray,
    missingNetworkIds: networkIds.filter(
      (networkId) => !networkIdToAddressArray[networkId]?.length,
    ),
  };
}
