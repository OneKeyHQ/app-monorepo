import type { SimpleDbEntityHistory } from '@onekeyhq/engine/src/dbs/simple/entity/SimpleDbEntityHistory';
import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';

import {
  applyCleanupStrategy,
  cachedMatchingPolicies,
  findMatchingPolicies,
  updateLastWriteTime,
} from './utils';

import type { CleanupPolicy, SimpleDbCleanupPolicy } from './types';

const mockCleanupPolicies = jest.fn(() => [] as CleanupPolicy[]);
jest.mock('./policy', () => ({
  get cleanupPolicies() {
    return mockCleanupPolicies();
  },
}));

jest.mock('@onekeyhq/shared/src/storage/appStorage');

const mockedAppStorage = appStorage as jest.Mocked<typeof appStorage>;

describe('utils', () => {
  const policy: CleanupPolicy = {
    source: 'redux',
    statePath: ['accountSelector'],
    strategy: {
      type: 'reset-on-expiry',
      expiry: 3600,
      resetToValue: false,
    },
  };
  beforeEach(() => {
    cachedMatchingPolicies.clear();
    mockedAppStorage.setSetting.mockClear();
    mockCleanupPolicies.mockReturnValue([policy]);
  });
  describe('findMatchingPolicy', () => {
    it('should cache the matching policy', () => {
      findMatchingPolicies('r:accountSelector');
      expect(cachedMatchingPolicies.get('r:accountSelector')).toEqual([policy]);
    });
    it('should try reading the cached matching policy', () => {
      jest.spyOn(cachedMatchingPolicies, 'get');
      findMatchingPolicies('r:accountSelector');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(cachedMatchingPolicies.get).not.toHaveBeenCalled();
      findMatchingPolicies('r:accountSelector');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(cachedMatchingPolicies.get).toHaveBeenCalledWith(
        'r:accountSelector',
      );
    });

    describe('redux policy', () => {
      it('matches with r:xxx key', () => {
        expect(findMatchingPolicies('r:accountSelector')).toEqual([policy]);
      });

      it('supports prefix matching for nested keys', () => {
        expect(findMatchingPolicies('r:accountSelector.isLoading')).toEqual([
          policy,
        ]);
      });
    });

    describe('simpledb policy', () => {
      const simpleDbPolicy: SimpleDbCleanupPolicy<SimpleDbEntityHistory> = {
        source: 'simpledb',
        simpleDbEntity: simpleDb.history,
        dataPath: ['items'],
        strategy: {
          type: 'array-slice',
          maxToKeep: 1000,
          keepItemsAt: 'tail',
        },
      };
      beforeEach(() => {
        mockCleanupPolicies.mockReturnValue([simpleDbPolicy]);
      });

      it('matches with s:xxx:xxx key', () => {
        expect(findMatchingPolicies('s:history:items')).toEqual([
          simpleDbPolicy,
        ]);
      });

      it('supports prefix matching for nested keys', () => {
        expect(findMatchingPolicies('s:history:items.nestedField')).toEqual([
          simpleDbPolicy,
        ]);
      });
    });
  });

  describe('updateLastWriteTime', () => {
    it('calls appStorage.setSetting with the correct key', () => {
      updateLastWriteTime('r:accountSelector');
      expect(mockedAppStorage.setSetting).toHaveBeenCalledWith(
        'lw:r:accountSelector',
        expect.any(Number),
      );
    });

    it('skips if no matching policy', () => {
      mockCleanupPolicies.mockReturnValue([]);
      updateLastWriteTime('r:accountSelector');
      expect(mockedAppStorage.setSetting).not.toHaveBeenCalled();
    });
  });
});

describe('applyCleanupStrategy', () => {
  describe('reset-on-expiry strategy', () => {
    it('resets the value if the expiry is reached', () => {
      const data = { accountSelector: true };
      applyCleanupStrategy(
        { type: 'reset-on-expiry', expiry: 3600, resetToValue: false },
        data,
        'accountSelector',
        Date.now() - 3600 * 1000 - 1,
      );
      expect(data.accountSelector).toBe(false);
    });

    it('do nothing if the expiry is not reached', () => {
      const data = { accountSelector: true };
      expect(
        applyCleanupStrategy(
          { type: 'reset-on-expiry', expiry: 3600, resetToValue: false },
          data,
          'accountSelector',
          Date.now() - 3600 * 1000 + 1,
        ),
      ).toBe(false);
      expect(data.accountSelector).toBe(true);
    });
  });

  describe('array-slice strategy', () => {
    describe('if array.length > maxToKeep', () => {
      it('slices the array from head', () => {
        const data = { history: [0, 1, 2, 3, 4] };
        applyCleanupStrategy(
          { type: 'array-slice', maxToKeep: 3, keepItemsAt: 'head' },
          data,
          'history',
          Date.now(),
        );
        expect(data.history).toEqual([0, 1, 2]);
      });

      it('slices the array from tail', () => {
        const data = { history: [0, 1, 2, 3, 4] };
        applyCleanupStrategy(
          { type: 'array-slice', maxToKeep: 2, keepItemsAt: 'tail' },
          data,
          'history',
          Date.now(),
        );
        expect(data.history).toEqual([3, 4]);
      });
    });

    it('do nothing if array.length <= maxToKeep', () => {
      const data = { history: [0, 1, 2, 3, 4] };
      expect(
        applyCleanupStrategy(
          { type: 'array-slice', maxToKeep: 5, keepItemsAt: 'tail' },
          data,
          'history',
          Date.now(),
        ),
      ).toBe(false);
      expect(data.history).toEqual([0, 1, 2, 3, 4]);
    });
  });
});
