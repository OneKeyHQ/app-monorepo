// Loaded ONLY via dynamic import from ServiceSetting.fetchCurrencyList —
// keeps this reconciliation helper out of the native background startup
// graph (Startup Graph Budget CI check). Do not add static imports.
import type { ICurrencyItem } from '@onekeyhq/shared/types';

import { settingsPersistAtom } from '../../states/jotai/atoms/settings';

// settings.currencyInfo.symbol is a snapshot copied from the server map at
// selection time and never re-checked, so a transient bad unit (e.g. "US$"
// for usd) sticks forever while surfaces reading the live map recover and
// disagree on screen. Reconcile the snapshot on every map refresh.
export async function reconcileCurrencyInfoSymbolSnapshot({
  currencyMap,
}: {
  currencyMap: Record<string, ICurrencyItem>;
}) {
  const { currencyInfo } = await settingsPersistAtom.get();
  const serverUnit = currencyMap[currencyInfo.id]?.unit;
  if (serverUnit && serverUnit !== currencyInfo.symbol) {
    await settingsPersistAtom.set((prev) =>
      prev.currencyInfo.id === currencyInfo.id
        ? {
            ...prev,
            currencyInfo: { ...prev.currencyInfo, symbol: serverUnit },
          }
        : prev,
    );
  }
}
