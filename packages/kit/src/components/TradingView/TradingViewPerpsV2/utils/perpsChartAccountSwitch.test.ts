import {
  EPerpsChartAccountSwitchAction,
  getPerpsChartAccountSwitchAction,
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
