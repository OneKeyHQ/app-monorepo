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

  describe('explicit revisions on non-event commits', () => {
    it('keeps a requested revision that is ahead of the local clock', () => {
      // An explicit revision carries the caller's ordering; a value ahead of
      // our wall clock must survive as-is, not be clamped down to local time.
      jest.spyOn(Date, 'now').mockReturnValue(1000);
      expect(
        getNextSelectionUpdatedAt({
          currentUpdatedAt: 500,
          requestedUpdatedAt: 9999,
        }),
      ).toBe(9999);
    });

    it('never replaces the requested revision with the wall clock', () => {
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(50_000);
      expect(
        getNextSelectionUpdatedAt({
          currentUpdatedAt: 1000,
          requestedUpdatedAt: 1002,
        }),
      ).toBe(1002);
      expect(nowSpy).not.toHaveBeenCalled();
    });

    it('lifts a requested revision below the committed one to the monotonic floor', () => {
      // An explicit revision must not rewind what we already hold.
      jest.spyOn(Date, 'now').mockReturnValue(50_000);
      expect(
        getNextSelectionUpdatedAt({
          currentUpdatedAt: 1000,
          requestedUpdatedAt: 900,
        }),
      ).toBe(1001);
    });

    it('keeps the requested revision untouched on the very first commit', () => {
      // Initial state: with no committed revision the floor is 0, so an
      // explicit revision far below the wall clock is stored verbatim.
      jest.spyOn(Date, 'now').mockReturnValue(50_000);
      expect(getNextSelectionUpdatedAt({ requestedUpdatedAt: 7 })).toBe(7);
    });
  });
});
