import { EDeFiPositionAction } from '@onekeyhq/shared/types/defi';

import { resolveProtocolPositionActionAssetPill } from './protocolPositionActionAssetUtils';

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
