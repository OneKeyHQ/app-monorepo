import { EPerpPageEnterSource } from '@onekeyhq/shared/src/logger/scopes/perp/type';
import { EHyperLiquidAbstractionMode } from '@onekeyhq/shared/types/hyperliquid';

import { buildPerpAccountStatusAnalyticsParams } from './perpAccountStatusAnalytics';

const source = EPerpPageEnterSource.TabBar;
const walletType = 'hd';
const accountAddress =
  '0x1111111111111111111111111111111111111111' as `0x${string}`;

function buildReadyParams() {
  return {
    source,
    walletType,
    selectAccountLoading: false,
    accountCreationPending: false,
    accountStatus: {
      accountAddress,
      canTrade: true,
      canCreateAddress: false,
      accountNotSupport: false,
      details: {
        activatedOk: true,
        agentOk: true,
        referralCodeOk: true,
        builderFeeOk: true,
        internalRebateBoundOk: true,
        abstractionOk: false,
      },
    },
    computedAccountValue: {
      accountValue: '125.5',
      withdrawable: '80.25',
      isLoading: false,
    },
    positionsState: {
      accountAddress,
      activePositions: [{ coin: 'BTC' }, { coin: 'ETH' }],
    },
    abstractionMode: {
      accountAddress,
      mode: EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT,
      source: 'live' as const,
    },
  };
}

describe('buildPerpAccountStatusAnalyticsParams', () => {
  it('builds a ready account snapshot', () => {
    expect(buildPerpAccountStatusAnalyticsParams(buildReadyParams())).toEqual(
      expect.objectContaining({
        snapshotStatus: 'ready',
        isTradingEnabled: true,
        abstractionOk: true,
        accountMode: EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT,
        accountValue: 125.5,
        withdrawable: 80.25,
        positionCount: 2,
      }),
    );
  });

  it('waits until status and account-scoped positions are ready', () => {
    const readyParams = buildReadyParams();
    expect(
      buildPerpAccountStatusAnalyticsParams({
        ...readyParams,
        accountStatus: {
          ...readyParams.accountStatus,
          details: {
            ...readyParams.accountStatus.details,
            activatedOk: undefined,
          },
        },
      }),
    ).toBeUndefined();
    expect(
      buildPerpAccountStatusAnalyticsParams({
        ...readyParams,
        selectAccountLoading: true,
      }),
    ).toBeUndefined();
    expect(
      buildPerpAccountStatusAnalyticsParams({
        ...readyParams,
        abstractionMode: {
          ...readyParams.abstractionMode,
          source: 'cache',
        },
      }),
    ).toBeUndefined();
    expect(
      buildPerpAccountStatusAnalyticsParams({
        ...readyParams,
        positionsState: {
          ...readyParams.positionsState,
          accountAddress: '0x2222222222222222222222222222222222222222',
        },
      }),
    ).toBeUndefined();
  });
});
