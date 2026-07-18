import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

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
