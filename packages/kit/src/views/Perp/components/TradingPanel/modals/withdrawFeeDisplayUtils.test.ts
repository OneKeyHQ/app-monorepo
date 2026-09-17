import type { IUsdcWithdrawFeeQuote } from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import { formatUsdcWithdrawFeeText } from './withdrawFeeDisplayUtils';

const cctpQuote: IUsdcWithdrawFeeQuote = {
  components: [
    {
      kind: 'cctpForwarding',
      amount: '0.2',
      token: 'USDC',
      debitedFrom: 'withdrawAmount',
      isEstimate: false,
    },
  ],
  quotedAt: 1,
};

describe('formatUsdcWithdrawFeeText', () => {
  it('shows an account-specific reserve with the CCTP forwarding fee', () => {
    expect(
      formatUsdcWithdrawFeeText({
        feeQuote: cctpQuote,
        reserve: '1',
        includeReserve: true,
      }),
    ).toBe('$1.20');
  });

  it('keeps the sub-cent indicator for the minimum reserve', () => {
    expect(
      formatUsdcWithdrawFeeText({
        feeQuote: cctpQuote,
        reserve: '0.01',
        includeReserve: true,
      }),
    ).toBe('< $0.21');
  });

  it('keeps the estimate indicator when summing an estimated forwarding fee', () => {
    expect(
      formatUsdcWithdrawFeeText({
        feeQuote: {
          ...cctpQuote,
          components: cctpQuote.components.map((component) => ({
            ...component,
            isEstimate: true,
          })),
        },
        reserve: '0.01',
        includeReserve: true,
      }),
    ).toBe('≈ $0.21');
  });

  it('keeps a standalone fee unchanged without a reserve', () => {
    expect(
      formatUsdcWithdrawFeeText({
        feeQuote: cctpQuote,
        reserve: undefined,
        includeReserve: false,
      }),
    ).toBe('$0.20');
  });

  it('replaces the HyperEVM preview instead of showing it twice', () => {
    const hyperEvmQuote: IUsdcWithdrawFeeQuote = {
      components: [
        {
          kind: 'hyperEvmGas',
          amount: '0.01',
          token: 'USDC',
          debitedFrom: 'spotHypeOrSourceUsdc',
          isEstimate: true,
          displayAsLessThan: true,
        },
      ],
      quotedAt: 1,
    };

    expect(
      formatUsdcWithdrawFeeText({
        feeQuote: hyperEvmQuote,
        reserve: '1.2345678',
        includeReserve: true,
      }),
    ).toBe('$1.23');
  });

  it('does not show the preview while the account reserve is unknown', () => {
    expect(
      formatUsdcWithdrawFeeText({
        feeQuote: cctpQuote,
        reserve: undefined,
        includeReserve: true,
      }),
    ).toBeUndefined();
  });
});
