import { EMarksUpdateOperationEnum } from '../types';

import {
  EPerpsChartAccountSwitchAction,
  createPerpsChartMarksLedger,
  getPerpsChartAccountSwitchAction,
  recordPerpsChartMarksSent,
  recordPerpsChartSymbol,
} from './perpsChartAccountSwitch';

const { KeepChart, ClearSymbolMarks, ResetAccountMarks, RebuildChart } =
  EPerpsChartAccountSwitchAction;

interface ISwitchCase {
  markedSymbols: string[];
  chartSymbol: string | undefined;
  reset: boolean;
  expected: EPerpsChartAccountSwitchAction;
}

describe('getPerpsChartAccountSwitchAction on BTC', () => {
  it.each`
    markedSymbols     | chartSymbol  | reset    | expected
    ${[]}             | ${undefined} | ${false} | ${KeepChart}
    ${[]}             | ${'ETH'}     | ${false} | ${KeepChart}
    ${['BTC']}        | ${'BTC'}     | ${false} | ${ClearSymbolMarks}
    ${['BTC']}        | ${undefined} | ${false} | ${RebuildChart}
    ${['BTC']}        | ${'ETH'}     | ${false} | ${RebuildChart}
    ${['ETH']}        | ${'BTC'}     | ${false} | ${RebuildChart}
    ${['BTC', 'ETH']} | ${'BTC'}     | ${false} | ${RebuildChart}
    ${['BTC', 'ETH']} | ${undefined} | ${true}  | ${ResetAccountMarks}
    ${[]}             | ${undefined} | ${true}  | ${ResetAccountMarks}
  `(
    'marks $markedSymbols, chart on $chartSymbol, reset $reset -> $expected',
    ({ markedSymbols, chartSymbol, reset, expected }: ISwitchCase) => {
      expect(
        getPerpsChartAccountSwitchAction({
          markedSymbols: new Set(markedSymbols),
          chartSymbol,
          symbol: 'BTC',
          supportsAccountMarksReset: reset,
        }),
      ).toBe(expected);
    },
  );
});

describe('marks cache accounting', () => {
  it('only removes an empty replacement when the chart symbol is still trusted', () => {
    const ledger = createPerpsChartMarksLedger();
    recordPerpsChartSymbol(ledger, 'BTC');
    recordPerpsChartMarksSent(ledger, { symbol: 'BTC', marks: [1] });
    recordPerpsChartMarksSent(ledger, { symbol: 'BTC', marks: [] });
    expect(ledger.markedSymbols.has('BTC')).toBe(true);
    recordPerpsChartMarksSent(ledger, {
      symbol: 'BTC',
      marks: [],
      operation: EMarksUpdateOperationEnum.INCREMENTAL,
    });
    expect(ledger.markedSymbols.has('BTC')).toBe(true);
    recordPerpsChartMarksSent(ledger, {
      symbol: 'BTC',
      marks: [],
      operation: EMarksUpdateOperationEnum.REPLACE,
    });
    expect(ledger.markedSymbols.size).toBe(0);
    recordPerpsChartMarksSent(ledger, { symbol: 'BTC', marks: [1] });
    ledger.symbolChanged = true;
    recordPerpsChartMarksSent(ledger, {
      symbol: 'BTC',
      marks: [],
      operation: EMarksUpdateOperationEnum.CLEAR,
    });
    expect(ledger.markedSymbols.has('BTC')).toBe(true);
  });
});
