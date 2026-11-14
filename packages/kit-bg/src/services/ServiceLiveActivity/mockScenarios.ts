import type {
  ILiveActivityMockScenario,
  ILiveActivitySnapshot,
  ILiveActivityStatus,
} from '@onekeyhq/shared/types/liveActivity';

const scenarioStates: Record<ILiveActivityMockScenario, ILiveActivityStatus[]> =
  {
    success: ['confirming', 'swapping', 'receiving', 'done'],
    refund: ['confirming', 'swapping', 'refunding', 'refunded'],
    failed: ['confirming', 'failed'],
    canceled: ['confirming', 'canceled'],
    almostDone: ['confirming'],
    longTicker: ['confirming', 'receiving', 'done'],
  };

export function createLiveActivityMockScenario({
  scenario,
  nowMs,
  sequence,
}: {
  scenario: ILiveActivityMockScenario;
  nowMs: number;
  sequence: number;
}): { snapshot: ILiveActivitySnapshot; states: ILiveActivityStatus[] } {
  const suffix = `${nowMs}-${sequence}`;
  const durationSeconds = scenario === 'almostDone' ? 15 : 4 * 60;
  return {
    states: scenarioStates[scenario],
    snapshot: {
      order: {
        schemaVersion: 1,
        orderKey: `mock:btc:${suffix}`,
        depositTxId: `mock-deposit-${suffix}`,
        networkId: 'btc--0',
        provider: 'mock',
        fromToken: {
          symbol: 'BTC',
          iconUrl: '',
          networkName: 'Bitcoin',
        },
        toToken: {
          symbol: scenario === 'longTicker' ? 'LONGTOKENNAME' : 'USDC',
          iconUrl: '',
          networkName: 'Ethereum',
        },
        startedAtMs: nowMs,
        estimatedEndAtMs: nowMs + durationSeconds * 1000,
        expiresAtMs: nowMs + 8 * 60 * 60 * 1000,
        isMock: true,
      },
      content: { status: 'confirming', updatedAtMs: nowMs, revision: 1 },
    },
  };
}
