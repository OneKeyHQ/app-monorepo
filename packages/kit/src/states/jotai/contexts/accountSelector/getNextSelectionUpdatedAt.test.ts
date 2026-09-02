import { getNextSelectionUpdatedAt } from './actions';

// actions.tsx transitively imports the full BackgroundApi (WalletConnect native
// deps included) through backgroundApiProxy; stub the proxy so this pure-function
// test does not have to load that world. jest hoists this above the import.
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/kit/src/components/Hardware/Hardware', () => ({
  __esModule: true,
}));

describe('getNextSelectionUpdatedAt', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('local commits (no requestedUpdatedAt)', () => {
    it('takes the wall clock when it is ahead of the committed revision', () => {
      // Normal forward clock: a local commit is stamped with Date.now().
      jest.spyOn(Date, 'now').mockReturnValue(2000);
      expect(getNextSelectionUpdatedAt({ currentUpdatedAt: 1000 })).toBe(2000);
    });

    it('stays strictly ahead of the committed revision when the clock jumps backwards', () => {
      // Clock rollback: revisions must never rewind, so the monotonic floor
      // (currentUpdatedAt + 1) wins over a wall clock that fell behind.
      jest.spyOn(Date, 'now').mockReturnValue(500);
      expect(getNextSelectionUpdatedAt({ currentUpdatedAt: 1000 })).toBe(1001);
    });

    it('advances by one on a same-millisecond consecutive commit', () => {
      // Two local commits inside one millisecond must still produce strictly
      // increasing revisions, or the second one compares as not-newer downstream.
      jest.spyOn(Date, 'now').mockReturnValue(1000);
      expect(getNextSelectionUpdatedAt({ currentUpdatedAt: 1000 })).toBe(1001);
    });

    it('takes the wall clock for the very first commit', () => {
      // Initial state: with no committed revision the floor is 0, so the first
      // local commit is stamped with plain Date.now().
      jest.spyOn(Date, 'now').mockReturnValue(1234);
      expect(getNextSelectionUpdatedAt({})).toBe(1234);
    });
  });

  describe('event commits (requestedUpdatedAt from a peer runtime)', () => {
    it('keeps a peer revision that is ahead of the local clock', () => {
      // A peer revision carries the emitting runtime's ordering; a value ahead
      // of our wall clock (peer clock skew) must survive as-is, not be clamped
      // down to local time.
      jest.spyOn(Date, 'now').mockReturnValue(1000);
      expect(
        getNextSelectionUpdatedAt({
          currentUpdatedAt: 500,
          requestedUpdatedAt: 9999,
        }),
      ).toBe(9999);
    });

    it('never replaces the peer revision with the receive time', () => {
      // Burst scenario from the source comment: re-stamping events with the
      // receive clock would lift the first event far above the second payload's
      // revision, so the second event would read as stale and be dropped. The
      // receive clock therefore plays no part in an event commit at all.
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(50_000);
      expect(
        getNextSelectionUpdatedAt({
          currentUpdatedAt: 1000,
          requestedUpdatedAt: 1002,
        }),
      ).toBe(1002);
      expect(nowSpy).not.toHaveBeenCalled();
    });

    it('lifts a peer revision below the committed one up to the monotonic floor', () => {
      // A stale peer revision must not rewind what we already hold: the floor
      // (currentUpdatedAt + 1) is the only clamp applied to event commits.
      jest.spyOn(Date, 'now').mockReturnValue(50_000);
      expect(
        getNextSelectionUpdatedAt({
          currentUpdatedAt: 1000,
          requestedUpdatedAt: 900,
        }),
      ).toBe(1001);
    });

    it('keeps the peer revision untouched on the very first commit', () => {
      // Initial state: with no committed revision the floor is 0, so a peer
      // revision far below the local wall clock is still stored verbatim.
      jest.spyOn(Date, 'now').mockReturnValue(50_000);
      expect(getNextSelectionUpdatedAt({ requestedUpdatedAt: 7 })).toBe(7);
    });
  });
});
