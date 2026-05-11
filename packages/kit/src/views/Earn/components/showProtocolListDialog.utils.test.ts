import { shouldShowProtocolListBalances } from './showProtocolListDialog.utils';

function buildProtocol(networkId?: string) {
  return {
    network: {
      networkId,
    },
  };
}

describe('showProtocolListDialog utils', () => {
  it('hides balances when all protocols are on the same network', () => {
    expect(
      shouldShowProtocolListBalances([
        buildProtocol('sol--101'),
        buildProtocol('sol--101'),
      ]),
    ).toBe(false);
  });

  it('hides balances for a single-network protocol list', () => {
    expect(shouldShowProtocolListBalances([buildProtocol('sol--101')])).toBe(
      false,
    );
  });

  it('shows balances when protocols span multiple networks', () => {
    expect(
      shouldShowProtocolListBalances([
        buildProtocol('evm--1'),
        buildProtocol('evm--8453'),
      ]),
    ).toBe(true);
  });

  it('keeps balance display when network data is missing', () => {
    expect(shouldShowProtocolListBalances([buildProtocol('')])).toBe(true);
    expect(shouldShowProtocolListBalances([])).toBe(true);
  });
});
