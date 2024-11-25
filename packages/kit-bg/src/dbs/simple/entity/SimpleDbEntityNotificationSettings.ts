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
};

export const NOTIFICATION_ACCOUNT_ACTIVITY_DEFAULT_ENABLED: true | false =
  false;
export const NOTIFICATION_ACCOUNT_ACTIVITY_DEFAULT_MAX_ACCOUNT_COUNT = 20;

export class SimpleDbEntityNotificationSettings extends SimpleDbEntityBase<ISimpleDbNotificationSettings> {
  entityName = 'notificationSettings';

  override enableCache = false;

  @backgroundMethod()
  async saveAccountActivityNotificationSettings(
    settings: IAccountActivityNotificationSettings | undefined,
  ) {
    await this.setRawData((rawData) => ({
      ...rawData,
      accountActivity: settings,
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
