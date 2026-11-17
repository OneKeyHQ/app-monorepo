import {
  canAdmitNetworkAccount,
  pickSyncSlotsToRelease,
} from './PrivacyChainSyncSlots';

import type { IPrivacyChainSyncSlot } from './PrivacyChainSyncSlots';

const slot = (
  key: string,
  times: { refreshedAt?: number; enabledAt?: number } = {},
  releasable = true,
): IPrivacyChainSyncSlot => ({
  key,
  networkId: key.split('|')[0],
  accountIds: [key],
  releasable,
  ...times,
});

const keys = (slots: IPrivacyChainSyncSlot[]) => slots.map((item) => item.key);

describe('pickSyncSlotsToRelease', () => {
  it('releases nothing at or under the ceiling', () => {
    expect(
      pickSyncSlotsToRelease({
        slots: [slot('zec|a'), slot('xmr|b')],
        max: 2,
      }),
    ).toEqual([]);
  });

  it('releases the slot refreshed longest ago, across chains', () => {
    expect(
      keys(
        pickSyncSlotsToRelease({
          slots: [
            slot('zec|a', { refreshedAt: 30, enabledAt: 1 }),
            slot('xmr|b', { refreshedAt: 10, enabledAt: 2 }),
            slot('zec|c', { refreshedAt: 20, enabledAt: 3 }),
          ],
          max: 2,
        }),
      ),
    ).toEqual(['xmr|b']);
  });

  it('breaks a refresh tie by the older enable', () => {
    expect(
      keys(
        pickSyncSlotsToRelease({
          slots: [
            slot('zec|a', { refreshedAt: 10, enabledAt: 5 }),
            slot('zec|b', { refreshedAt: 10, enabledAt: 3 }),
          ],
          max: 1,
        }),
      ),
    ).toEqual(['zec|b']);
  });

  it('treats a slot with no recorded times as the oldest', () => {
    expect(
      keys(
        pickSyncSlotsToRelease({
          slots: [slot('zec|a', { refreshedAt: 1 }), slot('xmr|b')],
          max: 1,
        }),
      ),
    ).toEqual(['xmr|b']);
  });

  it('never releases the slot being kept or one held by a deletion', () => {
    expect(
      keys(
        pickSyncSlotsToRelease({
          slots: [
            slot('zec|new'),
            slot('zec|deleting', {}, false),
            slot('xmr|b', { refreshedAt: 50 }),
          ],
          keepKey: 'zec|new',
          max: 2,
        }),
      ),
    ).toEqual(['xmr|b']);
  });

  it('releases several slots when far over, oldest first', () => {
    expect(
      keys(
        pickSyncSlotsToRelease({
          slots: [
            slot('zec|a', { refreshedAt: 4 }),
            slot('zec|b', { refreshedAt: 1 }),
            slot('xmr|c', { refreshedAt: 3 }),
            slot('xmr|d', { refreshedAt: 2 }),
          ],
          max: 2,
        }),
      ),
    ).toEqual(['zec|b', 'xmr|d']);
  });
});

describe('canAdmitNetworkAccount', () => {
  const holders = ['a', 'b', 'c', 'd', 'e'].map((identity) => ({
    accountId: `acct-${identity}`,
    identity,
  }));

  it('admits a new identity below the ceiling', () => {
    expect(
      canAdmitNetworkAccount({
        holders: holders.slice(0, 4),
        accountId: 'acct-new',
      }),
    ).toBe(true);
  });

  it('refuses a sixth identity, however its data is held', () => {
    expect(canAdmitNetworkAccount({ holders, accountId: 'acct-new' })).toBe(
      false,
    );
  });

  it('admits an account that already holds data, such as a paused one', () => {
    expect(canAdmitNetworkAccount({ holders, accountId: 'acct-c' })).toBe(true);
  });

  it('admits an alias of an identity already holding data', () => {
    expect(
      canAdmitNetworkAccount({
        holders,
        accountId: 'acct-twin',
        identity: 'b',
      }),
    ).toBe(true);
  });

  it('counts aliases sharing an identity once', () => {
    expect(
      canAdmitNetworkAccount({
        holders: [
          ...holders.slice(0, 4),
          { accountId: 'acct-a-twin', identity: 'a' },
        ],
        accountId: 'acct-new',
      }),
    ).toBe(true);
  });
});
