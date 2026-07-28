import {
  HYPERLIQUID_DEPOSIT_ADDRESS,
  USDC_TOKEN_INFO,
} from '../../types/hyperliquid/perp.constants';
import { EDecodedTxActionType } from '../../types/tx';
import { PERPS_NETWORK_ID } from '../consts/perp';

import {
  PERPS_DEPOSIT_HISTORY_CONFIRMATION_MARKER_TTL_MS,
  isHyperliquidDirectDepositTx,
  prunePerpsDepositHistoryConfirmationMarkers,
} from './hyperliquidDepositUtils';

describe('isHyperliquidDirectDepositTx', () => {
  const buildDecodedTx = ({
    networkId = PERPS_NETWORK_ID,
    to = HYPERLIQUID_DEPOSIT_ADDRESS,
    tokenIdOnNetwork = USDC_TOKEN_INFO.address,
  }: {
    networkId?: string;
    to?: string;
    tokenIdOnNetwork?: string;
  } = {}) => ({
    networkId,
    to,
    actions: [
      {
        type: EDecodedTxActionType.ASSET_TRANSFER,
        from: '0xsender',
        to,
        assetTransfer: {
          from: '0xsender',
          to,
          sends: [
            {
              from: '0xsender',
              to,
              amount: '5',
              icon: '',
              name: 'USD Coin',
              symbol: 'USDC',
              tokenIdOnNetwork,
            },
          ],
          receives: [],
        },
      },
    ],
  });

  it('matches direct Arbitrum USDC transfers to the Hyperliquid deposit address', () => {
    expect(isHyperliquidDirectDepositTx(buildDecodedTx())).toBe(true);
  });

  it('rejects ordinary Arbitrum transfers', () => {
    expect(
      isHyperliquidDirectDepositTx(buildDecodedTx({ to: '0xrecipient' })),
    ).toBe(false);
  });

  it('rejects non-USDC or non-Arbitrum transfers', () => {
    expect(
      isHyperliquidDirectDepositTx(
        buildDecodedTx({ tokenIdOnNetwork: '0xtoken' }),
      ),
    ).toBe(false);
    expect(
      isHyperliquidDirectDepositTx(buildDecodedTx({ networkId: 'evm--1' })),
    ).toBe(false);
  });
});

describe('prunePerpsDepositHistoryConfirmationMarkers', () => {
  it('drops stale history-confirmation markers and keeps active orders', () => {
    const now = 10_000_000;
    const freshMarkerTime =
      now - PERPS_DEPOSIT_HISTORY_CONFIRMATION_MARKER_TTL_MS + 1;
    const staleMarkerTime =
      now - PERPS_DEPOSIT_HISTORY_CONFIRMATION_MARKER_TTL_MS;

    const pendingOrder = { fromTxId: 'pending', time: staleMarkerTime };
    const freshMarker = {
      fromTxId: 'fresh',
      keepForHistoryConfirmation: true,
      time: freshMarkerTime,
    };
    const staleMarker = {
      fromTxId: 'stale',
      keepForHistoryConfirmation: true,
      time: staleMarkerTime,
    };
    const markerWithoutTime = {
      fromTxId: 'missing-time',
      keepForHistoryConfirmation: true,
    };

    expect(
      prunePerpsDepositHistoryConfirmationMarkers(
        [pendingOrder, freshMarker, staleMarker, markerWithoutTime],
        now,
      ).map((order) => order.fromTxId),
    ).toEqual(['pending', 'fresh']);
  });
});
