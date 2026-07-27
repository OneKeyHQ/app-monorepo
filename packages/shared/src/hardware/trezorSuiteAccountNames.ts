export interface ITrezorSuiteAccountName {
  deviceId: string;
  name: string;
  address: string;
  path: string;
  accountType: string;
  visible: boolean;
}

export type ITrezorSuiteAccountNamesResult =
  | {
      status: 'available';
      accounts: ITrezorSuiteAccountName[];
    }
  | {
      status: 'no_accounts' | 'invalid_source' | 'source_not_found';
      accounts: [];
    };

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const nonEmptyString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const bitcoinAddress = (value: unknown): string | undefined => {
  const address = nonEmptyString(value);
  if (
    address &&
    (/^(?:bc1|tb1|bcrt1)[0-9a-z]{11,90}$/i.test(address) ||
      /^[123mn2][1-9A-HJ-NP-Za-km-z]{25,62}$/.test(address))
  ) {
    return address;
  }
  return undefined;
};

const receivePath = (value: unknown): string | undefined => {
  const path = nonEmptyString(value);
  return path && /^m\/(?:44|49|84|86)'\/0'\/\d+'\/0\/\d+$/.test(path)
    ? path
    : undefined;
};

const sourceDeviceId = (value: unknown): string | undefined => {
  const deviceState = nonEmptyString(value);
  if (!deviceState) {
    return undefined;
  }
  const separator = deviceState.lastIndexOf('@');
  if (separator <= 0) {
    return undefined;
  }
  const deviceWithInstance = deviceState.slice(separator + 1);
  const deviceId = deviceWithInstance.split(':')[0]?.trim();
  return deviceId && /^[0-9a-z-]{4,128}$/i.test(deviceId)
    ? deviceId
    : undefined;
};

export function parseTrezorSuiteAccountNames(
  input: unknown,
): ITrezorSuiteAccountNamesResult {
  if (!Array.isArray(input) || input.length > 500) {
    return { status: 'invalid_source', accounts: [] };
  }
  const result = new Map<string, ITrezorSuiteAccountName>();
  for (const item of input) {
    const account = asRecord(item);
    if (nonEmptyString(account?.symbol)?.toLowerCase() === 'btc') {
      const deviceId = sourceDeviceId(account?.deviceState);
      const address = bitcoinAddress(account?.address);
      const path = receivePath(account?.addressPath);
      const index = account?.index;
      const accountType = nonEmptyString(account?.accountType);
      if (
        deviceId &&
        address &&
        path &&
        Number.isInteger(index) &&
        (index as number) >= 0 &&
        (index as number) <= 1000 &&
        accountType &&
        accountType.length <= 40
      ) {
        const parsed: ITrezorSuiteAccountName = {
          deviceId,
          name: `Bitcoin #${(index as number) + 1}`,
          address,
          path,
          accountType,
          visible: account?.visible !== false,
        };
        result.set(`${deviceId}:${path}:${address}`, parsed);
      }
    }
  }
  const accounts = [...result.values()];
  return accounts.length
    ? { status: 'available', accounts }
    : { status: 'no_accounts', accounts: [] };
}
