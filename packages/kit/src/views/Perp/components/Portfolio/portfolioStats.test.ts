import { computeAccountHealthRisk } from './portfolioStats';

describe('computeAccountHealthRisk', () => {
  it('rates a low margin ratio, leverage and margin use as safe', () => {
    expect(computeAccountHealthRisk(1, 3, 10)).toEqual({ level: 'safe' });
  });

  it('lets a high margin ratio alone reach danger', () => {
    expect(computeAccountHealthRisk(80, 3, 10)).toEqual({ level: 'danger' });
  });

  it('does not count an unknown margin ratio as safe', () => {
    // Known 0% with 20x leverage and 90% margin use is "danger" on those two
    // signals alone once the unknown ratio mirrors them instead of voting safe.
    expect(computeAccountHealthRisk(0, 20, 90)).toEqual({ level: 'danger' });
    expect(computeAccountHealthRisk(null, 20, 60)).toEqual({ level: 'danger' });
    expect(computeAccountHealthRisk(0, 20, 60)).toEqual({ level: 'caution' });
  });

  it('stays safe with an unknown margin ratio when the other signals are safe', () => {
    expect(computeAccountHealthRisk(null, 3, 10)).toEqual({ level: 'safe' });
  });
});
