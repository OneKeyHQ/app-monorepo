import { pickHoldingInvestmentCells } from './holdingInvestmentCells.utils';

import type { IHoldingInvestmentCell } from './holdingInvestmentCells.utils';

const tooltip = { type: 'text', data: { title: { text: 't' } } };
const cell = (title: string, withTooltip: boolean) =>
  ({
    title: { text: title },
    description: { text: '1' },
    ...(withTooltip ? { tooltip } : {}),
  }) as unknown as IHoldingInvestmentCell;

describe('pickHoldingInvestmentCells', () => {
  it('keeps the phone-made cells but the effective deposits, which the deposit row shows (Spark)', () => {
    const cells = [
      cell('Effective deposits', true),
      cell('Effective APY', true),
      cell('Est. 24h earnings', false),
    ];
    expect(
      pickHoldingInvestmentCells(cells, 'Effective deposits').map(
        (c) => c.title?.text,
      ),
    ).toEqual(['Effective APY']);
  });

  it('keeps none of the wide layout cells, which come without a tooltip', () => {
    expect(
      pickHoldingInvestmentCells(
        [cell('Est. 24h earnings', false), cell('APY', false)],
        undefined,
      ),
    ).toEqual([]);
    expect(pickHoldingInvestmentCells(undefined, undefined)).toEqual([]);
  });
});
