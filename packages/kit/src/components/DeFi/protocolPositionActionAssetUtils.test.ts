import { EDeFiPositionAction } from '@onekeyhq/shared/types/defi';

import {
  resolveProtocolPositionActionAssetBalanceLabel,
  resolveProtocolPositionActionAssetPill,
} from './protocolPositionActionAssetUtils';

describe('resolveProtocolPositionActionAssetPill', () => {
  it('builds a liquidity-pool pair identity from underlying assets', () => {
    expect(
      resolveProtocolPositionActionAssetPill({
        action: EDeFiPositionAction.RemoveLiquidity,
        selectedAsset: {
          symbol: 'UNI-V3-POS',
          asset: { meta: { logoUrl: 'lp.png' } },
          underlyingAssets: [
            { symbol: 'ETH', meta: { logoUrl: 'eth.png' } },
            { symbol: 'USDC', meta: { logoUrl: 'usdc.png' } },
          ],
        },
      }),
    ).toEqual({
      symbol: 'ETH / USDC',
      logoURI: 'lp.png',
      logoURIs: ['eth.png', 'usdc.png'],
    });
  });
});

describe('resolveProtocolPositionActionAssetBalanceLabel', () => {
  it('uses the withdraw-specific label for ordinary portfolio withdraw', () => {
    expect(
      resolveProtocolPositionActionAssetBalanceLabel(
        EDeFiPositionAction.Withdraw,
      ),
    ).toBe('availableToWithdraw');
  });

  it('uses the remaining-debt label for ordinary portfolio repay', () => {
    expect(
      resolveProtocolPositionActionAssetBalanceLabel(EDeFiPositionAction.Repay),
    ).toBe('remainingDebt');
  });
});
