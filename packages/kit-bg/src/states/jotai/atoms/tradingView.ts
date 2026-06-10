import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

// Persisted decision for the TradingView chart source (online vs offline).
//
// - `online`: whether the chart should be served from the remote online
//   bundle. Defaults to `false` (offline) — the safest fallback when the
//   server has never been reached.
// - `decidedForVersion`: the app version the decision was made for. The
//   server matches the version exactly, so when the app upgrades to a
//   version the decision was NOT made for, consumers must ignore the stale
//   `online` flag and fall back to offline until a fresh decision arrives.
// - `fetchedAt`: timestamp of the last successful fetch (diagnostics only).
//
// This atom is written by `ServiceSetting.fetchChartUseOnline()` on startup
// and read synchronously at cold start by the chart-webview mode snapshot
// (next phase). It is never cleared by a failed fetch — a failed fetch keeps
// the previous decision (or the offline default when none exists yet).
export type IChartSourcePersistAtom = {
  online: boolean;
  decidedForVersion: string;
  fetchedAt: number;
};

export const {
  target: chartSourcePersistAtom,
  use: useChartSourcePersistAtom,
} = globalAtom<IChartSourcePersistAtom>({
  persist: true,
  name: EAtomNames.chartSourcePersistAtom,
  initialValue: {
    online: false,
    decidedForVersion: '',
    fetchedAt: 0,
  },
});
