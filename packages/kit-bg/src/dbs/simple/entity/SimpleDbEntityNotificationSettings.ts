import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export type IAccountActivityNotificationSettings = Record<
  string,
  {
    enabled: boolean | undefined;
    accounts: Record<string, { enabled: boolean | undefined }>;
  }
>;

export type ISimpleDbNotificationSettings = {
  accountActivity?: IAccountActivityNotificationSettings;
};

export const NOTIFICATION_ACCOUNT_ACTIVITY_DEFAULT_ENABLED: true | false = true;

export class SimpleDbEntityNotificationSettings extends SimpleDbEntityBase<ISimpleDbNotificationSettings> {
  entityName = 'notificationSettings';

  override enableCache = false;

  @backgroundMethod()
  async saveAccountActivityNotificationSettings(
    settings: IAccountActivityNotificationSettings | undefined,
  ) {
    await this.setRawData(({ rawData }) => ({
      ...rawData,
      accountActivity: settings,
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
      settings?.accountActivity?.[walletId]?.enabled ??
      NOTIFICATION_ACCOUNT_ACTIVITY_DEFAULT_ENABLED;
    const accountEnabled: boolean =
      settings?.accountActivity?.[walletId]?.accounts?.[
        accountIdOrIndexedAccountId
      ]?.enabled ?? NOTIFICATION_ACCOUNT_ACTIVITY_DEFAULT_ENABLED;
    return Boolean(walletEnabled && accountEnabled);
  }
}
