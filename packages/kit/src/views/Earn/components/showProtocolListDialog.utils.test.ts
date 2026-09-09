import {
  getProtocolAprColor,
  shouldShowProtocolListBalances,
} from './showProtocolListDialog.utils';

function buildProtocol(networkId?: string) {
  return {
    network: {
      networkId,
    },
  };
}

describe('showProtocolListDialog utils', () => {
  it('uses the server-provided normal APR color for bonus protocols', () => {
    expect(
      getProtocolAprColor({
        normal: {
          text: '22.61% APY',
          color: '$textSuccess',
        },
      }),
    ).toBe('$textSuccess');
  });

  it('keeps the APR style defaults when the server does not provide a color', () => {
    expect(
      getProtocolAprColor({
        normal: {
          text: '2.12% APY',
        },
      }),
    ).toBeUndefined();
  });

  it('uses the same priority as the visible APR value', () => {
    expect(
      getProtocolAprColor({
        highlight: {
          text: '3.12% APY',
          color: '$textSuccess',
        },
        normal: {
          text: '2.61% APY',
          color: '$textInfo',
        },
        deprecated: {
          text: '2.12% APY',
          color: '$textSubdued',
        },
      }),
    ).toBe('$textSuccess');
  });

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
