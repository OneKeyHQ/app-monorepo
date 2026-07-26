export interface ILedgerLiveAccountName {
  name: string;
  address: string;
}

export type ILedgerLiveAccountNamesResult =
  | {
      status: 'available';
      accounts: ILedgerLiveAccountName[];
    }
  | {
      status:
        | 'no_accounts'
        | 'encrypted_source'
        | 'invalid_source'
        | 'source_not_found';
      accounts: [];
    };

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const nonEmptyString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const ledgerAccountName = (value: unknown): string | undefined => {
  const name = nonEmptyString(value);
  return name && name.length <= 80 ? name : undefined;
};

const ethereumAddress = (value: unknown): string | undefined => {
  const address = nonEmptyString(value);
  return address && /^0x[0-9a-fA-F]{40}$/.test(address) ? address : undefined;
};

type ILedgerLiveAccountDetails = {
  address?: string;
  currencyId?: string;
};

const getAccountDetails = (
  account: Record<string, unknown> | undefined,
): ILedgerLiveAccountDetails => {
  const accountData = asRecord(account?.data);
  return {
    address:
      ethereumAddress(account?.address) ??
      ethereumAddress(accountData?.address) ??
      ethereumAddress(accountData?.freshAddress),
    currencyId:
      nonEmptyString(account?.currencyId) ??
      nonEmptyString(accountData?.currencyId) ??
      nonEmptyString(asRecord(account?.currency)?.id),
  };
};

const getSourceAccountId = (
  account: Record<string, unknown> | undefined,
): string | undefined =>
  nonEmptyString(account?.id) ?? nonEmptyString(asRecord(account?.data)?.id);

const isEthereumAccount = (details: ILedgerLiveAccountDetails): boolean =>
  details.currencyId?.toLowerCase() === 'ethereum';

export function parseLedgerLiveAccountNames(
  input: unknown,
): ILedgerLiveAccountNamesResult {
  const root = asRecord(input);
  const data = asRecord(root?.data);
  if (!root || !data) {
    return { status: 'invalid_source', accounts: [] };
  }

  const wallet = asRecord(data.wallet);
  const accountsData = wallet?.accountsData;
  const rawAccounts = data.accounts;
  if (typeof accountsData === 'string' || typeof rawAccounts === 'string') {
    return { status: 'encrypted_source', accounts: [] };
  }

  const rawAccountNames = asRecord(accountsData)?.accountNames;
  const accountNameEntries: Array<[string, unknown]> = Array.isArray(
    rawAccountNames,
  )
    ? rawAccountNames.flatMap((entry) =>
        Array.isArray(entry) && typeof entry[0] === 'string'
          ? [[entry[0], entry[1]]]
          : [],
      )
    : Object.entries(asRecord(rawAccountNames) ?? {});
  const accounts = Array.isArray(rawAccounts) ? rawAccounts : [];
  const detailsById = new Map<string, Record<string, unknown>>();
  for (const item of accounts) {
    const record = asRecord(item);
    const id = getSourceAccountId(record);
    if (id && record) {
      detailsById.set(id, record);
    }
  }

  const result = new Map<string, ILedgerLiveAccountName>();
  for (const [sourceAccountId, rawName] of accountNameEntries) {
    const name = ledgerAccountName(rawName);
    const details = getAccountDetails(detailsById.get(sourceAccountId));
    if (name && details.address && isEthereumAccount(details)) {
      result.set(sourceAccountId, {
        name,
        address: details.address,
      });
    }
  }

  for (const [index, item] of accounts.entries()) {
    const account = asRecord(item);
    if (account) {
      const accountData = asRecord(account.data);
      const sourceAccountId =
        getSourceAccountId(account) ?? `ledger-live-account-${index}`;
      const name =
        ledgerAccountName(account.name) ?? ledgerAccountName(accountData?.name);
      const details = getAccountDetails(account);
      if (
        name &&
        details.address &&
        isEthereumAccount(details) &&
        !result.has(sourceAccountId)
      ) {
        result.set(sourceAccountId, {
          name,
          address: details.address,
        });
      }
    }
  }

  const parsedAccounts = [...result.values()];
  return parsedAccounts.length
    ? { status: 'available', accounts: parsedAccounts }
    : { status: 'no_accounts', accounts: [] };
}
