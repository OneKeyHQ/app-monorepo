import { EMarksUpdateOperationEnum } from '../types';

// Main-runtime record of the account marks one chart WebView instance may hold.
export interface IPerpsChartMarksLedger {
  // The chart caches marks per symbol and serves non-empty caches without asking.
  markedSymbols: Set<string>;
  // Legacy messages cannot acknowledge a symbol switch generation.
  symbolChanged: boolean;
  // Only trusted until this chart instance switches symbols.
  chartSymbol: string | undefined;
}

export function createPerpsChartMarksLedger(): IPerpsChartMarksLedger {
  return {
    markedSymbols: new Set(),
    chartSymbol: undefined,
    symbolChanged: false,
  };
}

export function recordPerpsChartMarksSent(
  ledger: IPerpsChartMarksLedger,
  {
    symbol,
    marks,
    operation,
  }: {
    symbol: string;
    marks: readonly unknown[];
    operation?: EMarksUpdateOperationEnum;
  },
) {
  if (marks.length > 0) {
    ledger.markedSymbols.add(symbol);
  } else if (
    (operation === EMarksUpdateOperationEnum.REPLACE ||
      operation === EMarksUpdateOperationEnum.CLEAR) &&
    !ledger.symbolChanged &&
    ledger.chartSymbol === symbol
  ) {
    // CLEAR/REPLACE may be dropped while the chart is switching symbols.
    // A late MARKS_RESPONSE may be ignored after its request has timed out.
    ledger.markedSymbols.delete(symbol);
  }
}

export function recordPerpsChartSymbol(
  ledger: IPerpsChartMarksLedger,
  symbol: string | undefined,
) {
  if (symbol && !ledger.symbolChanged) {
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
  hasAccountLines = false,
}: {
  markedSymbols: ReadonlySet<string>;
  chartSymbol: string | undefined;
  symbol: string;
  // Reserved for a chart build that declares perpsAccountMarksReset.
  supportsAccountMarksReset?: boolean;
  hasAccountLines?: boolean;
}): EPerpsChartAccountSwitchAction {
  // Legacy line messages have no reset acknowledgement or account identity.
  if (hasAccountLines) {
    return EPerpsChartAccountSwitchAction.RebuildChart;
  }
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
