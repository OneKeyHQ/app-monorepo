import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export type IAccountActivityNotificationSettings = {
  [walletId: string]: {
    enabled: boolean | undefined;
    accounts: {
      [accountId: string]: { enabled: boolean | undefined };
    };
  };
};

export type ISimpleDbNotificationSettings = {
  accountActivity?: IAccountActivityNotificationSettings;
  primeBackupAccountActivity?: IAccountActivityNotificationSettings;
};

export class SimpleDbEntityNotificationSettings extends SimpleDbEntityBase<ISimpleDbNotificationSettings> {
  entityName = 'notificationSettings';

  override enableCache = false;

  async backupPrimeAccountActivityNotificationSettings() {
    await this.setRawData((rawData) => ({
      ...rawData,
      primeBackupAccountActivity: rawData?.accountActivity,
    }));
  }

  @backgroundMethod()
  async updateBackupPrimeAccountActivityNotificationSettings({
    accountId,
    walletId,
    enabled,
  }: {
    walletId: string;
    enabled: boolean;
    accountId: string | null;
  }) {
    await this.setRawData((rawData) => {
      const currentPrimeBackup = rawData?.primeBackupAccountActivity || {};

      // Skip if wallet doesn't exist in primeBackupAccountActivity
      if (!currentPrimeBackup[walletId]) {
        console.log(
          'Wallet not found in primeBackupAccountActivity, skipping:',
          walletId,
        );
        return rawData || {};
      }

      const newPrimeBackup = { ...currentPrimeBackup };

      if (accountId === null) {
        // Update wallet enabled
        newPrimeBackup[walletId] = {
          ...newPrimeBackup[walletId],
          enabled,
        };
      } else {
        // Update account enabled - skip if account doesn't exist
        if (!currentPrimeBackup[walletId]?.accounts?.[accountId]) {
          console.log(
            'Account not found in primeBackupAccountActivity, skipping:',
            { walletId, accountId },
          );
          return rawData || {};
        }

        newPrimeBackup[walletId] = {
          ...newPrimeBackup[walletId],
          accounts: {
            ...newPrimeBackup[walletId].accounts,
            [accountId]: {
              ...newPrimeBackup[walletId].accounts[accountId],
              enabled,
            },
          },
        };
      }

      return {
        ...(rawData || {}),
        primeBackupAccountActivity: newPrimeBackup,
      };
    });
  }

  @backgroundMethod()
  async saveAccountActivityNotificationSettings(
    settings: IAccountActivityNotificationSettings | undefined,
  ) {
    await this.setRawData((rawData) => ({
      ...rawData,
      accountActivity: settings,
    }));
  }

  @backgroundMethod()
  async savePrimeBackupAccountActivityNotificationSettings(
    settings: IAccountActivityNotificationSettings | undefined,
  ) {
    await this.setRawData((rawData) => ({
      ...rawData,
      primeBackupAccountActivity: settings,
    }));
  }

  async isAccountActivityEnabled({
    notificationSettingsRawData,
    walletId,
    accountId,
    indexedAccountId,
  }: {
    notificationSettingsRawData:
      | ISimpleDbNotificationSettings
      | null
      | undefined;
    walletId?: string;
    accountId?: string;
    indexedAccountId?: string;
  }) {
    const settings = notificationSettingsRawData || (await this.getRawData());
    const accountIdOrIndexedAccountId = indexedAccountId || accountId;
    if (!walletId || !accountIdOrIndexedAccountId) {
      return false;
    }
    const walletEnabled: boolean | undefined =
      settings?.accountActivity?.[walletId]?.enabled;
    const accountEnabled: boolean | undefined =
      settings?.accountActivity?.[walletId]?.accounts?.[
        accountIdOrIndexedAccountId
      ]?.enabled;
    return Boolean(walletEnabled && accountEnabled);
  }

  @backgroundMethod()
  async getEnabledAccountCount() {
    const settings = await this.getRawData();
    let count = 0;
    Object.values(settings?.accountActivity || {}).forEach((wallet) => {
      if (wallet?.enabled) {
        Object.values(wallet?.accounts || {}).forEach((account) => {
          if (account?.enabled) {
            count += 1;
          }
        });
      }
    });
    return count;
  }
}
