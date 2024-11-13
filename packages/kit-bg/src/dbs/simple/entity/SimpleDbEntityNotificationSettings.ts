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
  // accountActivity?: IAccountActivityNotificationSettings;
  accountActivityV2?: IAccountActivityNotificationSettings;
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
    await this.setRawData(({ rawData }) => ({
      ...rawData,
      accountActivity: null,
      accountActivityV2: settings,
    }));
  }

  async isAccountActivityEnabled({
    walletId,
    accountId,
    indexedAccountId,
  }: {
    walletId?: string;
    accountId?: string;
    indexedAccountId?: string;
  }) {
    const settings = await this.getRawData();
    const accountIdOrIndexedAccountId = indexedAccountId || accountId;
    if (!walletId || !accountIdOrIndexedAccountId) {
      return false;
    }
    const walletEnabled: boolean =
      settings?.accountActivityV2?.[walletId]?.enabled ??
      NOTIFICATION_ACCOUNT_ACTIVITY_DEFAULT_ENABLED;
    const accountEnabled: boolean =
      settings?.accountActivityV2?.[walletId]?.accounts?.[
        accountIdOrIndexedAccountId
      ]?.enabled ?? NOTIFICATION_ACCOUNT_ACTIVITY_DEFAULT_ENABLED;
    return Boolean(walletEnabled && accountEnabled);
  }
}
