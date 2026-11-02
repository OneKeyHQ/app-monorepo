import {
  PRIVACY_CHAIN_LIGHT_MIN_BLOCKS_LEFT,
  PRIVACY_CHAIN_TIP_POLL_MS,
  getPrivacyChainBackfillBlocksLeft,
  getPrivacyChainBlocksLeft,
  isTipLagWorthMentioning as isTipLagWorthMentioningWithPolicy,
  nextPrivacyChainScanRate,
  shouldStartBoost,
} from './privacyChainSyncPolicy';

const ZCASH = 'zec--0';
const ALL_NETWORK = 'onekeyall--0';
const TIP_LAG_NOTICEABLE_BLOCKS = 48;

const isTipLagWorthMentioning = (lagBlocks: number | null | undefined) =>
  isTipLagWorthMentioningWithPolicy(lagBlocks, TIP_LAG_NOTICEABLE_BLOCKS);

describe('shouldStartBoost', () => {
  it('accepts an explicit manual sync on a real chain', () => {
    expect(shouldStartBoost({ trigger: 'manual-sync', networkId: ZCASH })).toBe(
      true,
    );
  });

  it('refuses the aggregate view -- landing there is not a request', () => {
    expect(
      shouldStartBoost({ trigger: 'manual-sync', networkId: ALL_NETWORK }),
    ).toBe(false);
  });

  it('refuses a missing network', () => {
    expect(
      shouldStartBoost({ trigger: 'manual-sync', networkId: undefined }),
    ).toBe(false);
  });

  it('runs a manual sync however small the arrears are', () => {
    expect(
      shouldStartBoost({
        trigger: 'manual-sync',
        networkId: ZCASH,
        remainingBlocks: 1,
      }),
    ).toBe(true);
  });

  // Only a long wait is worth a floating window.
  it('starts automatically only for a long wait', () => {
    for (const trigger of ['auto-backfill', 'chain-selected'] as const) {
      expect(
        shouldStartBoost({
          trigger,
          networkId: ZCASH,
          remainingBlocks: PRIVACY_CHAIN_LIGHT_MIN_BLOCKS_LEFT,
        }),
      ).toBe(true);
      expect(
        shouldStartBoost({
          trigger,
          networkId: ZCASH,
          remainingBlocks: PRIVACY_CHAIN_LIGHT_MIN_BLOCKS_LEFT - 1,
        }),
      ).toBe(false);
    }
  });

  it('refuses an automatic boost before any pass has published a position', () => {
    expect(
      shouldStartBoost({
        trigger: 'chain-selected',
        networkId: ZCASH,
        remainingBlocks: null,
      }),
    ).toBe(false);
  });

  it('still refuses the aggregate view for automatic triggers', () => {
    expect(
      shouldStartBoost({
        trigger: 'chain-selected',
        networkId: ALL_NETWORK,
        remainingBlocks: PRIVACY_CHAIN_LIGHT_MIN_BLOCKS_LEFT * 10,
      }),
    ).toBe(false);
  });
});

describe('getPrivacyChainBlocksLeft', () => {
  const progress = {
    isBackfillComplete: false,
    backfillScannedHeight: 1000,
    backfillTargetHeight: 1150,
    tipLag: 20,
  };

  it('adds what the backfill has left to how far the scan trails the tip', () => {
    expect(getPrivacyChainBlocksLeft(progress)).toBe(170);
  });

  it('counts only the tip lag once the backfill is done', () => {
    expect(
      getPrivacyChainBlocksLeft({ ...progress, isBackfillComplete: true }),
    ).toBe(20);
  });

  it('knows nothing before a pass has published a position', () => {
    expect(getPrivacyChainBlocksLeft(undefined)).toBeNull();
    expect(
      getPrivacyChainBlocksLeft({ ...progress, backfillScannedHeight: null }),
    ).toBeNull();
  });
});

describe('isTipLagWorthMentioning', () => {
  it('stays quiet for a wallet that is merely following the chain', () => {
    expect(isTipLagWorthMentioning(0)).toBe(false);
    expect(isTipLagWorthMentioning(TIP_LAG_NOTICEABLE_BLOCKS)).toBe(false);
  });

  it('speaks up once the lag is worth acting on', () => {
    expect(isTipLagWorthMentioning(TIP_LAG_NOTICEABLE_BLOCKS + 1)).toBe(true);
  });

  // A null lag (tip unreadable) is unknown, not behind.
  it('treats an unknown lag as nothing to say', () => {
    expect(isTipLagWorthMentioning(null)).toBe(false);
    expect(isTipLagWorthMentioning(undefined)).toBe(false);
  });
});

describe('PRIVACY_CHAIN_TIP_POLL_MS', () => {
  it('does not continuously poll an unattended local wallet', () => {
    expect(PRIVACY_CHAIN_TIP_POLL_MS).toBeGreaterThanOrEqual(60 * 1000);
  });

  // An unwatched wallet must still notice an incoming payment within minutes.
  it('still notices an incoming payment within a few minutes', () => {
    expect(PRIVACY_CHAIN_TIP_POLL_MS).toBeLessThanOrEqual(5 * 60 * 1000);
  });
});

describe('shouldStartBoost — user pause', () => {
  // Auto-trigger surfaces re-ask on every published progress; without the
  // pause flag a pause would undo itself within one scan pass.
  it('refuses automatic triggers while paused', () => {
    expect(
      shouldStartBoost({
        trigger: 'chain-selected',
        networkId: ZCASH,
        remainingBlocks: PRIVACY_CHAIN_LIGHT_MIN_BLOCKS_LEFT,
        pausedByUser: true,
      }),
    ).toBe(false);
  });

  // Sync is the only resume control, so it must outrank a pause.
  it('lets an explicit manual sync through a pause', () => {
    expect(
      shouldStartBoost({
        trigger: 'manual-sync',
        networkId: ZCASH,
        pausedByUser: true,
      }),
    ).toBe(true);
  });

  it('is inert when the user has not paused', () => {
    expect(
      shouldStartBoost({
        trigger: 'chain-selected',
        networkId: ZCASH,
        remainingBlocks: PRIVACY_CHAIN_LIGHT_MIN_BLOCKS_LEFT,
        pausedByUser: false,
      }),
    ).toBe(true);
  });
});

type IProgress = Parameters<typeof nextPrivacyChainScanRate>[0]['progress'];

const scanPosition = (overrides: Partial<IProgress>): IProgress => ({
  backfillScannedHeight: 100,
  backfillTargetHeight: 1000,
  isBackfillComplete: false,
  ...overrides,
});

describe('getPrivacyChainBackfillBlocksLeft', () => {
  it('prefers the count the chain reports', () => {
    expect(
      getPrivacyChainBackfillBlocksLeft(
        scanPosition({ backfillRemainingBlocks: 40 }),
      ),
    ).toBe(40);
  });

  it('falls back to target minus scanned', () => {
    expect(getPrivacyChainBackfillBlocksLeft(scanPosition({}))).toBe(900);
  });

  it('has nothing left once backfill is complete', () => {
    expect(
      getPrivacyChainBackfillBlocksLeft(
        scanPosition({ isBackfillComplete: true }),
      ),
    ).toBeUndefined();
  });
});

describe('nextPrivacyChainScanRate', () => {
  it('needs the scan to advance before it reports a speed', () => {
    const first = nextPrivacyChainScanRate({
      previous: undefined,
      progress: scanPosition({}),
      now: 0,
    });
    expect(first?.blocksPerSec).toBeNull();
    const second = nextPrivacyChainScanRate({
      previous: first,
      progress: scanPosition({ backfillScannedHeight: 120 }),
      now: 2000,
    });
    expect(second?.blocksPerSec).toBe(10);
  });

  it('measures out-of-order scans by blocks left, not the contiguous cursor', () => {
    const first = nextPrivacyChainScanRate({
      previous: undefined,
      progress: scanPosition({ backfillRemainingBlocks: 900 }),
      now: 0,
    });
    // The cursor stays put while priority ranges get scanned.
    const second = nextPrivacyChainScanRate({
      previous: first,
      progress: scanPosition({ backfillRemainingBlocks: 880 }),
      now: 1000,
    });
    expect(second?.blocksPerSec).toBe(20);
  });

  it('ignores a new tip, which adds to both target and blocks left', () => {
    const first = nextPrivacyChainScanRate({
      previous: undefined,
      progress: scanPosition({ backfillRemainingBlocks: 900 }),
      now: 0,
    });
    const second = nextPrivacyChainScanRate({
      previous: first,
      progress: scanPosition({
        backfillTargetHeight: 1001,
        backfillRemainingBlocks: 901,
      }),
      now: 1000,
    });
    expect(second).toBe(first);
  });

  it('starts over after a rewind or a long gap', () => {
    const measured = { done: 500, at: 0, blocksPerSec: 10 };
    expect(
      nextPrivacyChainScanRate({
        previous: measured,
        progress: scanPosition({ backfillScannedHeight: 50 }),
        now: 1000,
      })?.blocksPerSec,
    ).toBeNull();
    expect(
      nextPrivacyChainScanRate({
        previous: measured,
        progress: scanPosition({ backfillScannedHeight: 600 }),
        now: 10 * 60 * 1000,
      })?.blocksPerSec,
    ).toBeNull();
  });
});
