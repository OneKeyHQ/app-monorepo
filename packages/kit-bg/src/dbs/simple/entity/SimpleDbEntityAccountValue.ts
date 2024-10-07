import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IAccountValueDb {
  data: Record<
    string,
    {
      value: string;
      currency: string;
    }
  >; // <accountId, value>
  all: Record<
    string,
    {
      value: Record<string, string>; // <networkId, value>
      currency: string; // Currency for all networks is always USD
    }
  >;
}

export class SimpleDbEntityAccountValue extends SimpleDbEntityBase<IAccountValueDb> {
  entityName = 'accountValue';

  override enableCache = false;

  async getAccountsValue({ accounts }: { accounts: { accountId: string }[] }) {
    const rawData = await this.getRawData();

    return accounts.map(({ accountId }) => ({
      accountId,
      value: rawData?.data[accountId]?.value,
      currency: rawData?.data[accountId]?.currency,
    }));
  }

  async updateAccountValue({
    accountId,
    value,
    currency,
  }: {
    accountId: string;
    value: string;
    currency: string;
  }) {
    await this.setRawData(({ rawData }) => {
      const data = { ...rawData?.data };
      if (data[accountId]) {
        data[accountId].value = value;
        data[accountId].currency = currency;
      } else {
        data[accountId] = { value, currency };
      }
      return { data, all: { ...rawData?.all } };
    });
  }

  async updateAllNetworkAccountValue({
    allNetworkAccountId,
    value,
    currency,
    updateAll,
  }: {
    allNetworkAccountId: string;
    value: Record<string, string>;
    currency: string;
    updateAll?: boolean;
  }) {
    if (updateAll) {
      await this.setRawData(({ rawData }) => {
        const all = { ...rawData?.all };
        all[allNetworkAccountId] = { value, currency };
        return { all, data: { ...rawData?.data } };
      });
    } else {
      await this.setRawData(({ rawData }) => {
        const all = { ...rawData?.all };
        all[allNetworkAccountId] = {
          value: {
            ...all[allNetworkAccountId]?.value,
            ...value,
          },
          currency,
        };
        return { all, data: { ...rawData?.data } };
      });
    }
  }

  async getAllNetworkAccountsValue({
    accounts,
  }: {
    accounts: { allNetworkAccountId: string }[];
  }) {
    const rawData = await this.getRawData();

    return accounts.map(({ allNetworkAccountId }) => ({
      allNetworkAccountId,
      value: rawData?.all[allNetworkAccountId]?.value,
      currency: rawData?.all[allNetworkAccountId]?.currency,
    }));
  }
}
