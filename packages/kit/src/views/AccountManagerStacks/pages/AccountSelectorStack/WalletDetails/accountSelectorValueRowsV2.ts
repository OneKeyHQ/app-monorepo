import { isEqual } from 'lodash';

import type {
  IAccountSelectorDeFiMap,
  IAccountSelectorValuesMap,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { formatAccountSelectorValueV2 } from './accountSelectorValueV2';

import type { IAccountSelectorRowRecordV2 } from './accountSelectorAccountRowsV2';
import type { IdentityRow } from '@onekeyfe/react-native-native-list';

type IValueParams = Parameters<typeof formatAccountSelectorValueV2>[0];
type IFormattingContext = Omit<
  IValueParams,
  | 'accountValue'
  | 'activeAccountValue'
  | 'overview'
  | 'linkedAccountId'
  | 'linkedNetworkId'
> & { networkId?: string };

export function createAccountSelectorValueRowsV2(
  formatValue = formatAccountSelectorValueV2,
) {
  let context: IFormattingContext | undefined;
  let previousRows: IdentityRow[] = [];
  let previousStaticRows: IdentityRow[] | undefined;
  const cache = new Map<
    string,
    {
      params: Pick<
        IValueParams,
        | 'accountValue'
        | 'activeAccountValue'
        | 'overview'
        | 'linkedAccountId'
        | 'linkedNetworkId'
      >;
      value: ReturnType<typeof formatValue>;
      base: IdentityRow;
      row: IdentityRow;
    }
  >();
  return ({
    staticRows,
    records,
    accountValues,
    accountDeFi,
    activeAccountValue,
    context: nextContext,
    skipValues,
  }: {
    staticRows: IdentityRow[];
    records: IAccountSelectorRowRecordV2[];
    accountValues: IAccountSelectorValuesMap[number];
    accountDeFi: IAccountSelectorDeFiMap[number];
    activeAccountValue: IValueParams['activeAccountValue'];
    context: IFormattingContext;
    skipValues: boolean;
  }): IdentityRow[] => {
    // Compare shared network/rate content once, not once per account.
    if (!isEqual(context, nextContext)) {
      context = nextContext;
      cache.clear();
    }
    if (previousStaticRows !== staticRows) {
      const keys = new Set(staticRows.map((row) => row.key));
      for (const key of cache.keys()) {
        if (!keys.has(key)) cache.delete(key);
      }
      previousStaticRows = staticRows;
    }
    const rows = staticRows.map((row, index) => {
      const record = records[index];
      if (skipValues || record.shouldShowCreateAddressButton) return row;
      const accountValue = accountValues?.[row.key];
      const params = {
        accountValue,
        // An active value only overrides its own account in the formatter.
        activeAccountValue:
          accountValue?.accountId === activeAccountValue?.accountId
            ? activeAccountValue
            : undefined,
        overview: accountDeFi?.[row.key],
        linkedAccountId:
          record.indexedAccount?.associateAccount?.id ?? record.item.id,
        linkedNetworkId: record.avatarNetworkId ?? nextContext.networkId,
      };
      const cached = cache.get(row.key);
      const value =
        cached && isEqual(cached.params, params)
          ? cached.value
          : formatValue({ ...nextContext, ...params });
      if (cached?.base === row && cached.value === value) return cached.row;
      const subtitleSegments = [value, ...(row.subtitleSegments ?? [])];
      const valueRow: IdentityRow = {
        ...row,
        subtitleSegments,
        accessibilityLabel: [
          row.title,
          ...subtitleSegments.map((segment) => segment.text),
        ].join(', '),
      };
      cache.set(row.key, { params, value, base: row, row: valueRow });
      return valueRow;
    });
    if (
      rows.length === previousRows.length &&
      rows.every((row, index) => row === previousRows[index])
    ) {
      return previousRows;
    }
    previousRows = rows;
    return rows;
  };
}
