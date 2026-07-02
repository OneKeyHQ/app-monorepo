import {
  HYPERLIQUID_DEPOSIT_ADDRESS,
  USDC_TOKEN_INFO,
} from '../../types/hyperliquid/perp.constants';
import { PERPS_NETWORK_ID } from '../consts/perp';

import type { IDecodedTx } from '../../types/tx';

function normalize(value: string | undefined): string | undefined {
  return value?.toLowerCase();
}

export function isHyperliquidDirectDepositTx(
  decodedTx: Pick<IDecodedTx, 'actions' | 'networkId' | 'to'>,
): boolean {
  if (decodedTx.networkId !== PERPS_NETWORK_ID) {
    return false;
  }
  const depositAddress = normalize(HYPERLIQUID_DEPOSIT_ADDRESS);
  const usdcAddress = normalize(USDC_TOKEN_INFO.address);
  return decodedTx.actions.some((action) => {
    const transfer = action.assetTransfer;
    const to = normalize(transfer?.to ?? decodedTx.to);
    if (!transfer || to !== depositAddress) {
      return false;
    }
    return transfer.sends.some(
      (send) => normalize(send.tokenIdOnNetwork) === usdcAddress,
    );
  });
}
