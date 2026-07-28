import {
  HYPERLIQUID_DEPOSIT_ADDRESS,
  USDC_TOKEN_INFO,
} from '../../types/hyperliquid/perp.constants';
import { PERPS_NETWORK_ID } from '../consts/perp';

import type { IDecodedTx } from '../../types/tx';

export const PERPS_DEPOSIT_HISTORY_CONFIRMATION_MARKER_TTL_MS = 30 * 60 * 1000;

function normalize(value: string | undefined): string | undefined {
  return value?.toLowerCase();
}

export function prunePerpsDepositHistoryConfirmationMarkers<
  T extends {
    keepForHistoryConfirmation?: boolean;
    time?: number;
  },
>(
  orders: T[],
  now = Date.now(),
  ttlMs = PERPS_DEPOSIT_HISTORY_CONFIRMATION_MARKER_TTL_MS,
): T[] {
  return orders.filter((order) => {
    if (!order.keepForHistoryConfirmation) {
      return true;
    }
    const markerCreatedAt = order.time;
    if (!markerCreatedAt || markerCreatedAt <= 0) {
      return false;
    }
    return now - markerCreatedAt < ttlMs;
  });
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
