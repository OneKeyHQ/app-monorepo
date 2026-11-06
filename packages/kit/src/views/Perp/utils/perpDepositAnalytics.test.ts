import { PerpDepositScene } from '@onekeyhq/shared/src/logger/scopes/perp/scenes/deposit';
import { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';

import { getPerpDepositErrorCode } from './perpDepositAnalytics';

describe('getPerpDepositErrorCode', () => {
  it('normalizes string and numeric codes', () => {
    expect(getPerpDepositErrorCode({ code: ' 4001 ' })).toBe('4001');
    expect(getPerpDepositErrorCode({ code: 4100 })).toBe('4100');
  });

  it('falls back to the error name without exposing its message', () => {
    const error = new TypeError('sensitive provider response');
    expect(getPerpDepositErrorCode(error)).toBe('TypeError');
  });

  it('uses unknown for unsupported values', () => {
    expect(getPerpDepositErrorCode('raw error message')).toBe('unknown');
  });
});

describe.each(['simple', 'pro'] as const)(
  'deposit analytics %s',
  (tradingUiMode) => {
    it.each([ESwapTxHistoryStatus.SUCCESS, ESwapTxHistoryStatus.FAILED])(
      'preserves mode and the existing token payload on %s',
      (status) => {
        const scene = new PerpDepositScene();
        const emit = jest.spyOn(scene, '_emitLog').mockImplementation(() => {});
        scene.perpDepositInitiate({
          tradingUiMode,
          walletType: 'hd',
          amount: '10',
          toAmount: '10',
          depositRoute: 'relay',
          status,
          token: {
            networkId: 'evm--42161',
            networkLogoURI: '',
            contractAddress: '',
            name: 'USDC',
            symbol: 'USDC',
            decimals: 6,
          },
        });
        expect(emit).toHaveBeenCalledWith(
          'perpDepositInitiate',
          [
            expect.objectContaining({
              tradingUiMode,
              status,
              tokenSymbol: 'USDC',
            }),
          ],
          expect.any(Array),
        );
      },
    );
  },
);
