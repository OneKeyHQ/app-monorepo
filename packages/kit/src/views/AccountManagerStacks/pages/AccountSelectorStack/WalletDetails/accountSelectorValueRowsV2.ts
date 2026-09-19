import { isEqual } from 'lodash';

import type { IAccountSelectorValuesMap } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { formatAccountSelectorValueV2 } from './accountSelectorValueV2';

import type { IAccountSelectorRowRecordV2 } from './accountSelectorAccountRowsV2';
import type {
  IdentityRow,
  SelectorTextSegment,
} from '@onekeyfe/react-native-native-list';

type IValueParams = Parameters<typeof formatAccountSelectorValueV2>[0];
type IFormattingContext = Omit<
  IValueParams,
  | 'accountValue'
  | 'activeAccountValue'
  | 'overview'
  | 'linkedAccountId'
  | 'linkedNetworkId'
> & { networkId?: string };
type IRowValueParams = Pick<
  IValueParams,
  'accountValue' | 'activeAccountValue' | 'linkedAccountId' | 'linkedNetworkId'
> & {
  // Text the row last displayed, used until its live value is presentable.
  displayedValue?: SelectorTextSegment;
};

// Where a row's balance text comes from.
export type IAccountSelectorValueSourceV2 =
  // Formatted from the loaded value, including a final "--".
  | 'live'
  // The text shown last time, until the loaded value is presentable.
  | 'displayed'
  // Nothing to show yet.
  | 'pending'
  // The row shows no balance.
  | 'none';

export type IAccountSelectorValueRowsV2 = {
  rows: IdentityRow[];
  sources: Record<string, IAccountSelectorValueSourceV2>;
};

export function createAccountSelectorValueRowsV2(
  formatValue = formatAccountSelectorValueV2,
) {
  let context: IFormattingContext | undefined;
  let previous: IAccountSelectorValueRowsV2 = { rows: [], sources: {} };
  let previousStaticRows: IdentityRow[] | undefined;
  const cache = new Map<
    string,
    {
      params: IRowValueParams;
      value: SelectorTextSegment;
      source: IAccountSelectorValueSourceV2;
      base: IdentityRow;
      row: IdentityRow;
    }
  >();
  return ({
    staticRows,
    records,
    accountValues,
    activeAccountValue,
    displayedValues,
    context: nextContext,
    skipValues,
  }: {
    staticRows: IdentityRow[];
    records: IAccountSelectorRowRecordV2[];
    accountValues: IAccountSelectorValuesMap[number];
    activeAccountValue: IValueParams['activeAccountValue'];
    displayedValues?: Record<string, SelectorTextSegment>;
    context: IFormattingContext;
    skipValues: boolean;
  }): IAccountSelectorValueRowsV2 => {
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
    const sources: Record<string, IAccountSelectorValueSourceV2> = {};
    const rows = staticRows.map((row, index) => {
      const record = records[index];
      if (skipValues || record.shouldShowCreateAddressButton) {
        sources[row.key] = 'none';
        return row;
      }
      const accountValue = accountValues?.[row.key];
      const params: IRowValueParams = {
        accountValue,
        // An active value only overrides its own account in the formatter.
        activeAccountValue:
          accountValue?.accountId === activeAccountValue?.accountId
            ? activeAccountValue
            : undefined,
        linkedAccountId:
          record.indexedAccount?.associateAccount?.id ?? record.item.id,
        linkedNetworkId: record.avatarNetworkId ?? nextContext.networkId,
        displayedValue: displayedValues?.[row.key],
      };
      const cached = cache.get(row.key);
      let value: SelectorTextSegment;
      let source: IAccountSelectorValueSourceV2;
      if (cached && isEqual(cached.params, params)) {
        ({ value, source } = cached);
      } else {
        const { displayedValue, ...valueParams } = params;
        // The overview travels with the value, so both come from one load.
        const live = accountValue
          ? formatValue({
              ...nextContext,
              ...valueParams,
              overview: accountValue.deFi,
            })
          : undefined;
        if (live) {
          value = live;
          source = 'live';
        } else if (displayedValue) {
          value = displayedValue;
          source = 'displayed';
        } else {
          value = {
            text: nextContext.hideValue ? '****' : '--',
            tone: 'disabled',
          };
          source = 'pending';
        }
      }
      sources[row.key] = source;
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
      cache.set(row.key, { params, value, source, base: row, row: valueRow });
      return valueRow;
    });
    if (
      rows.length === previous.rows.length &&
      rows.every((row, index) => row === previous.rows[index])
    ) {
      return previous;
    }
    previous = { rows, sources };
    return previous;
  };
}
