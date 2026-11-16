import {
  EMPTY_PROFILE_DRAWER_SEEN,
  computeProfileDrawerMarks,
  firmwareUpdateKey,
  parseProfileDrawerSeen,
  seenOnOpen,
  settleSeen,
} from './profileDrawerMarks';

import type {
  IProfileDrawerSeen,
  IProfileDrawerSignals,
} from './profileDrawerMarks';

const QUIET: IProfileDrawerSignals = {
  isTravelMode: false,
  notificationGuideOpened: true,
  unreadNotifications: 0,
  unreadSupport: 0,
  notificationsKnown: true,
  supportKnown: true,
  appUpdate: undefined,
  firmwareUpdateKeys: [],
};
const OPENED: IProfileDrawerSeen = {
  ...EMPTY_PROFILE_DRAWER_SEEN,
  opened: true,
};
const FIRMWARE_A = firmwareUpdateKey({ connectId: 'a', toVersion: '4.12.0' });
const FIRMWARE_A_NEXT = firmwareUpdateKey({
  connectId: 'a',
  toVersion: '4.13.0',
});

function marks(signals: Partial<IProfileDrawerSignals>, seen = OPENED) {
  return computeProfileDrawerMarks({ ...QUIET, ...signals }, seen);
}

describe('profile drawer marks', () => {
  it('shows nothing when nothing waits', () => {
    expect(marks({})).toEqual({
      avatarReasons: [],
      notifications: undefined,
      support: 0,
      appUpdate: undefined,
      firmwareUpdate: false,
    });
  });

  it('lights the avatar for a never-opened notification list only until the drawer is first opened', () => {
    const signals = { notificationGuideOpened: false };
    expect(marks(signals, EMPTY_PROFILE_DRAWER_SEEN).avatarReasons).toEqual([
      'notifications',
    ]);
    const after = marks(signals, OPENED);
    expect(after.avatarReasons).toEqual([]);
    // The row keeps its dot until the list itself is opened.
    expect(after.notifications).toEqual({ count: undefined });
  });

  it('lights the avatar for notifications that arrive after the drawer was open', () => {
    const seen = seenOnOpen({ ...QUIET, unreadNotifications: 9 }, OPENED);
    expect(marks({ unreadNotifications: 9 }, seen).avatarReasons).toEqual([]);
    expect(marks({ unreadNotifications: 9 }, seen).notifications).toEqual({
      count: 9,
    });
    expect(marks({ unreadNotifications: 10 }, seen).avatarReasons).toEqual([
      'notifications',
    ]);
  });

  it('lowers the bar when unread items are read elsewhere', () => {
    const seen = seenOnOpen({ ...QUIET, unreadNotifications: 9 }, OPENED);
    const settled = settleSeen({ ...QUIET, unreadNotifications: 2 }, seen);
    expect(settled.notifications).toBe(2);
    expect(marks({ unreadNotifications: 3 }, settled).avatarReasons).toEqual([
      'notifications',
    ]);
    // Nothing went down: the same record comes back.
    expect(settleSeen({ ...QUIET, unreadNotifications: 9 }, seen)).toBe(seen);
  });

  it('lights the avatar for a new support reply and keeps the row dot until read', () => {
    const seen = seenOnOpen({ ...QUIET, unreadSupport: 1 }, OPENED);
    expect(marks({ unreadSupport: 1 }, seen).avatarReasons).toEqual([]);
    expect(marks({ unreadSupport: 1 }, seen).support).toBe(1);
    expect(marks({ unreadSupport: 2 }, seen).avatarReasons).toEqual([
      'support',
    ]);
  });

  it('lights the avatar once per firmware version', () => {
    expect(marks({ firmwareUpdateKeys: [FIRMWARE_A] }).avatarReasons).toEqual([
      'firmware',
    ]);
    const seen = seenOnOpen(
      { ...QUIET, firmwareUpdateKeys: [FIRMWARE_A] },
      OPENED,
    );
    const still = marks({ firmwareUpdateKeys: [FIRMWARE_A] }, seen);
    expect(still.avatarReasons).toEqual([]);
    expect(still.firmwareUpdate).toBe(true);
    expect(
      marks({ firmwareUpdateKeys: [FIRMWARE_A_NEXT] }, seen).avatarReasons,
    ).toEqual(['firmware']);
  });

  it('never lights the avatar for an app update; Settings carries it', () => {
    const result = marks({ appUpdate: 'available' }, EMPTY_PROFILE_DRAWER_SEEN);
    expect(result.avatarReasons).toEqual([]);
    expect(result.appUpdate).toBe('available');
  });

  it('shows no avatar dot and no message marks in travel mode', () => {
    const result = marks(
      {
        isTravelMode: true,
        notificationGuideOpened: false,
        unreadNotifications: 4,
        unreadSupport: 1,
        firmwareUpdateKeys: [FIRMWARE_A],
      },
      EMPTY_PROFILE_DRAWER_SEEN,
    );
    expect(result.avatarReasons).toEqual([]);
    expect(result.notifications).toBeUndefined();
    expect(result.support).toBe(0);
    expect(result.firmwareUpdate).toBe(false);
  });

  it('does not replay a seen support reply after a restart', () => {
    // Seen with the drawer open: one reply.
    const seen = seenOnOpen({ ...QUIET, unreadSupport: 1 }, OPENED);
    // Restart: the support SDK has not synced, so the count reads 0.
    const coldStart = { ...QUIET, unreadSupport: 0, supportKnown: false };
    const settled = settleSeen(coldStart, seen);
    expect(settled).toBe(seen);
    expect(marks(coldStart, settled).avatarReasons).toEqual([]);
    // Opening the drawer before the sync keeps what was seen.
    expect(seenOnOpen(coldStart, settled).support).toBe(1);
    // The sync brings back the same reply: still not new.
    expect(marks({ unreadSupport: 1 }, settled).avatarReasons).toEqual([]);
    expect(marks({ unreadSupport: 2 }, settled).avatarReasons).toEqual([
      'support',
    ]);
  });

  it('does not replay seen notifications while the count is not loaded', () => {
    const seen = seenOnOpen({ ...QUIET, unreadNotifications: 9 }, OPENED);
    const loading = {
      ...QUIET,
      unreadNotifications: 0,
      notificationsKnown: false,
    };
    const settled = settleSeen(loading, seen);
    expect(settled.notifications).toBe(9);
    expect(marks({ unreadNotifications: 9 }, settled).avatarReasons).toEqual(
      [],
    );
  });

  it('never lights the avatar without a lit row to point at', () => {
    const seenRecords: IProfileDrawerSeen[] = [
      EMPTY_PROFILE_DRAWER_SEEN,
      OPENED,
      { opened: true, notifications: 5, support: 1, firmware: [FIRMWARE_A] },
    ];
    for (const known of [false, true]) {
      for (const isTravelMode of [false, true]) {
        for (const notificationGuideOpened of [false, true]) {
          for (const unreadNotifications of [0, 3, 6]) {
            for (const unreadSupport of [0, 2]) {
              for (const firmwareUpdateKeys of [
                [],
                [FIRMWARE_A],
                [FIRMWARE_A_NEXT],
              ]) {
                for (const seen of seenRecords) {
                  const result = computeProfileDrawerMarks(
                    {
                      isTravelMode,
                      notificationGuideOpened,
                      unreadNotifications,
                      unreadSupport,
                      notificationsKnown: known,
                      supportKnown: known,
                      appUpdate: undefined,
                      firmwareUpdateKeys,
                    },
                    seen,
                  );
                  const rowLit =
                    !!result.notifications ||
                    result.support > 0 ||
                    result.firmwareUpdate;
                  expect(result.avatarReasons.length === 0 || rowLit).toBe(
                    true,
                  );
                }
              }
            }
          }
        }
      }
    }
  });

  it('reads a stored record defensively', () => {
    expect(parseProfileDrawerSeen(undefined)).toBe(EMPTY_PROFILE_DRAWER_SEEN);
    expect(parseProfileDrawerSeen('not json')).toBe(EMPTY_PROFILE_DRAWER_SEEN);
    expect(
      parseProfileDrawerSeen(
        JSON.stringify({ opened: true, notifications: 3, firmware: [1, 'x'] }),
      ),
    ).toEqual({ opened: true, notifications: 3, support: 0, firmware: ['x'] });
  });
});
