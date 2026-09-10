import {
  ZCASH_SPAM_REGION_END_MAINNET,
  ZCASH_SPAM_REGION_START_MAINNET,
  isZcashSpamRegionHeight,
} from '../config/zcash';

import {
  PRIVACY_CHAIN_TIP_POLL_MS,
  isTipLagWorthMentioning as isTipLagWorthMentioningWithPolicy,
  shouldStartBoost as shouldStartBoostWithPolicy,
} from './privacyChainSyncPolicy';

const ZCASH = 'zec--0';
const ALL_NETWORK = 'onekeyall--0';
const MIN_BOOST_REMAINING_BLOCKS = 10_000;
const TIP_LAG_NOTICEABLE_BLOCKS = 48;

const shouldStartBoost = (
  params: Omit<
    Parameters<typeof shouldStartBoostWithPolicy>[0],
    'minRemainingBlocks'
  >,
) =>
  shouldStartBoostWithPolicy({
    ...params,
    minRemainingBlocks: MIN_BOOST_REMAINING_BLOCKS,
  });

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

  it('starts automatically once the arrears are worth explaining', () => {
    for (const trigger of ['chain-selected', 'compose-send'] as const) {
      expect(
        shouldStartBoost({
          trigger,
          networkId: ZCASH,
          remainingBlocks: MIN_BOOST_REMAINING_BLOCKS,
        }),
      ).toBe(true);
    }
  });

  // The banner hides below the threshold, so starting here would spend
  // battery with nothing on screen offering a way to stop it.
  it('refuses an automatic boost the banner would not explain', () => {
    expect(
      shouldStartBoost({
        trigger: 'chain-selected',
        networkId: ZCASH,
        remainingBlocks: MIN_BOOST_REMAINING_BLOCKS - 1,
      }),
    ).toBe(false);
  });

  it('refuses an automatic boost before any pass has published a position', () => {
    expect(
      shouldStartBoost({ trigger: 'chain-selected', networkId: ZCASH }),
    ).toBe(false);
    expect(
      shouldStartBoost({
        trigger: 'compose-send',
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
        remainingBlocks: MIN_BOOST_REMAINING_BLOCKS,
      }),
    ).toBe(false);
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

describe('isZcashSpamRegionHeight', () => {
  it('includes both ends of the measured range', () => {
    expect(isZcashSpamRegionHeight(ZCASH_SPAM_REGION_START_MAINNET)).toBe(true);
    expect(isZcashSpamRegionHeight(ZCASH_SPAM_REGION_END_MAINNET)).toBe(true);
  });

  it('excludes heights on either side of it', () => {
    expect(isZcashSpamRegionHeight(ZCASH_SPAM_REGION_START_MAINNET - 1)).toBe(
      false,
    );
    expect(isZcashSpamRegionHeight(ZCASH_SPAM_REGION_END_MAINNET + 1)).toBe(
      false,
    );
  });

  it('says nothing about a height that was never read', () => {
    expect(isZcashSpamRegionHeight(null)).toBe(false);
    expect(isZcashSpamRegionHeight(undefined)).toBe(false);
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
          remainingBlocks: MIN_BOOST_REMAINING_BLOCKS,
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
        remainingBlocks: MIN_BOOST_REMAINING_BLOCKS,
        pausedByUser: false,
      }),
    ).toBe(true);
  });
});
