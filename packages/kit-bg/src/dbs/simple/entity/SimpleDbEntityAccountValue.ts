import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IAccountValueDb {
  data: Record<
    string,
    {
      value: string;
      currency: string;
    }
  >; // <accountId, value>
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
      return { data };
    });
  }
}
