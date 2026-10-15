import {
  PRIVACY_CHAIN_LIGHT_MIN_BLOCKS_LEFT,
  PRIVACY_CHAIN_TIP_POLL_MS,
  getPrivacyChainBlocksLeft,
  isTipLagWorthMentioning as isTipLagWorthMentioningWithPolicy,
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
    for (const trigger of [
      'auto-backfill',
      'chain-selected',
      'compose-send',
    ] as const) {
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

  // getLocalWalletSyncProgress reports null when it could not read a tip.
  // "Unknown" is not "behind" -- claiming a lag we never measured is worse
  // than saying nothing.
  it('treats an unknown lag as nothing to say', () => {
    expect(isTipLagWorthMentioning(null)).toBe(false);
    expect(isTipLagWorthMentioning(undefined)).toBe(false);
  });
});

describe('PRIVACY_CHAIN_TIP_POLL_MS', () => {
  it('does not continuously poll an unattended local wallet', () => {
    expect(PRIVACY_CHAIN_TIP_POLL_MS).toBeGreaterThanOrEqual(60 * 1000);
  });

  // The other direction: a wallet nobody is looking at should still notice an
  // incoming payment in minutes, not on the next app launch. Anyone wanting a
  // longer interval than this should be adding a push/event path instead.
  it('still notices an incoming payment within a few minutes', () => {
    expect(PRIVACY_CHAIN_TIP_POLL_MS).toBeLessThanOrEqual(5 * 60 * 1000);
  });
});

describe('shouldStartBoost — user pause', () => {
  // The point of the pause flag: the surfaces that auto-trigger a boost watch
  // for "nothing is boosting" and re-ask on the next published progress.
  // Without this the pause button would undo itself within one scan pass.
  it('refuses automatic triggers while paused', () => {
    for (const trigger of ['chain-selected', 'compose-send'] as const) {
      expect(
        shouldStartBoost({
          trigger,
          networkId: ZCASH,
          remainingBlocks: PRIVACY_CHAIN_LIGHT_MIN_BLOCKS_LEFT,
          pausedByUser: true,
        }),
      ).toBe(false);
    }
  });

  // Pressing Sync IS the resume; there is no separate un-pause control, so a
  // pause that outranked it would be a dead end.
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
