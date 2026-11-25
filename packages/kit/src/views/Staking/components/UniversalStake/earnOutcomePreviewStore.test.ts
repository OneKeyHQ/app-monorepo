import { scaleOutcomeFiat } from './earnOutcomePreviewStore';

describe("an offer's figure from the picked one's", () => {
  it('scales the money figure by the two rates, in its own sign', () => {
    expect(scaleOutcomeFiat('$8.03', 3.81 / 4.05)).toBe('$7.55');
    expect(scaleOutcomeFiat('€1,234.50', 2)).toBe('€2,469.00');
  });

  it('has none where the figure is not money', () => {
    expect(scaleOutcomeFiat('8.0384 USDC', 1.2)).toBeUndefined();
    expect(scaleOutcomeFiat('$8.03', Number.NaN)).toBeUndefined();
    expect(scaleOutcomeFiat('$8.03', -1)).toBeUndefined();
  });
});
