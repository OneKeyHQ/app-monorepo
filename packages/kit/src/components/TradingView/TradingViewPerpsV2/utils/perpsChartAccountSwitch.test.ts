import { EMarksUpdateOperationEnum } from '../types';

import {
  createPerpsChartMarksLedger,
  recordPerpsChartMarksSent,
  recordPerpsChartSymbol,
} from './perpsChartAccountSwitch';

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
