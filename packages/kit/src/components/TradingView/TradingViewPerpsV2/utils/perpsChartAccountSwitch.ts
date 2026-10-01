// Main-runtime record of the account marks one chart WebView instance may hold.
export interface IPerpsChartMarksLedger {
  // The chart caches marks per symbol and serves non-empty caches without asking.
  markedSymbols: Set<string>;
  // Symbol of the latest chart message, cleared when the app switches symbols.
  chartSymbol: string | undefined;
}

export function createPerpsChartMarksLedger(): IPerpsChartMarksLedger {
  return { markedSymbols: new Set(), chartSymbol: undefined };
}

export function recordPerpsChartMarksSent(
  ledger: IPerpsChartMarksLedger,
  { symbol, marks }: { symbol: string; marks: readonly unknown[] },
) {
  if (marks.length > 0) {
    ledger.markedSymbols.add(symbol);
  }
}

export function recordPerpsChartSymbol(
  ledger: IPerpsChartMarksLedger,
  symbol: string | undefined,
) {
  if (symbol) {
    ledger.chartSymbol = symbol;
  }
}

export enum EPerpsChartAccountSwitchAction {
  KeepChart = 'keepChart',
  ClearSymbolMarks = 'clearSymbolMarks',
  ResetAccountMarks = 'resetAccountMarks',
  RebuildChart = 'rebuildChart',
}

export function getPerpsChartAccountSwitchAction({
  markedSymbols,
  chartSymbol,
  symbol,
  supportsAccountMarksReset = false,
}: {
  markedSymbols: ReadonlySet<string>;
  chartSymbol: string | undefined;
  symbol: string;
  // Reserved for a chart build that declares perpsAccountMarksReset.
  supportsAccountMarksReset?: boolean;
}): EPerpsChartAccountSwitchAction {
  if (supportsAccountMarksReset) {
    return EPerpsChartAccountSwitchAction.ResetAccountMarks;
  }
  if (markedSymbols.size === 0) {
    return EPerpsChartAccountSwitchAction.KeepChart;
  }
  // The chart drops a CLEAR for a symbol it has not resolved yet.
  if (
    markedSymbols.size === 1 &&
    markedSymbols.has(symbol) &&
    chartSymbol === symbol
  ) {
    return EPerpsChartAccountSwitchAction.ClearSymbolMarks;
  }
  return EPerpsChartAccountSwitchAction.RebuildChart;
}
