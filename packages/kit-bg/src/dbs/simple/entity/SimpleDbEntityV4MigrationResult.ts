import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export type IV4MigrationResultDetailV4 = {
  // devices?: Partial<{
  //   [deviceId: string]: string;
  // }>;
  wallets?: Partial<{
    [walletId: string]: string;
  }>;
  accounts?: Partial<{
    [accountId: string]: string;
  }>;
};
export type IV4MigrationResultDetailV5 = IV4MigrationResultDetailV4 & {
  indexedAccounts?: Partial<{
    [indexedAccountId: string]: true;
  }>;
};
export type IV4MigrationResult = {
  migrated:
    | {
        // v4dbId -> v5dbId
        v4: IV4MigrationResultDetailV4 | undefined;
        // v5dbId -> v4dbId
        v5: IV4MigrationResultDetailV5 | undefined;
      }
    | undefined;
};
export class SimpleDbEntityV4MigrationResult extends SimpleDbEntityBase<IV4MigrationResult> {
  entityName = 'v4MigrationResult';

  override enableCache = false;

  async getV5WalletIdByV4WalletId({ v4walletId }: { v4walletId: string }) {
    return this.getRawData().then((rawData) => {
      const v4: IV4MigrationResultDetailV4 = rawData?.migrated?.v4 ?? {};
      return v4?.wallets?.[v4walletId];
    });
  }

  async getV5AccountIdByV4AccountId({ v4accountId }: { v4accountId: string }) {
    return this.getRawData().then((rawData) => {
      const v4: IV4MigrationResultDetailV4 = rawData?.migrated?.v4 ?? {};
      return v4?.accounts?.[v4accountId];
    });
  }

  async isV5IndexedAccountIdMigrated({
    v5indexedAccountId,
  }: {
    v5indexedAccountId: string;
  }) {
    const rawData = await this.getRawData();
    return Boolean(
      rawData?.migrated?.v5?.indexedAccounts?.[v5indexedAccountId],
    );
  }

  saveMigratedWalletId({
    v4walletId,
    v5walletId,
  }: {
    v4walletId: string;
    v5walletId: string;
  }) {
    if (!v4walletId || !v5walletId) {
      return;
    }
    return this.setRawData(({ rawData }) => {
      const v4: IV4MigrationResultDetailV4 = rawData?.migrated?.v4 ?? {};
      const v5: IV4MigrationResultDetailV4 = rawData?.migrated?.v5 ?? {};
      return {
        migrated: {
          ...rawData?.migrated,
          v4: {
            ...v4,
            wallets: {
              ...v4?.wallets,
              [v4walletId]: v5walletId,
            },
          },
          v5: {
            ...v5,
            wallets: {
              ...v5?.wallets,
              [v5walletId]: v4walletId,
            },
          },
        },
      };
    });
  }

  saveMigratedAccountId({
    v4accountId,
    v5accountId,
  }: {
    v4accountId: string;
    v5accountId: string;
  }) {
    if (!v4accountId || !v5accountId) {
      return;
    }
    return this.setRawData(({ rawData }) => {
      const v4: IV4MigrationResultDetailV4 = rawData?.migrated?.v4 ?? {};
      const v5: IV4MigrationResultDetailV4 = rawData?.migrated?.v5 ?? {};
      return {
        migrated: {
          ...rawData?.migrated,
          v4: {
            ...v4,
            accounts: {
              ...v4?.accounts,
              [v4accountId]: v5accountId,
            },
          },
          v5: {
            ...v5,
            accounts: {
              ...v5?.accounts,
              [v5accountId]: v4accountId,
            },
          },
        },
      };
    });
  }

  saveMigratedIndexedAccountId({
    v5indexedAccountId,
  }: {
    v5indexedAccountId: string;
  }) {
    return this.setRawData(({ rawData }) => {
      const v4: IV4MigrationResultDetailV4 = rawData?.migrated?.v4 ?? {};
      const v5: IV4MigrationResultDetailV5 = rawData?.migrated?.v5 ?? {};
      return {
        migrated: {
          ...rawData?.migrated,
          v4: {
            ...v4,
          },
          v5: {
            ...v5,
            indexedAccounts: {
              ...v5?.indexedAccounts,
              [v5indexedAccountId]: true,
            },
          },
        },
      };
    });
  }
}
