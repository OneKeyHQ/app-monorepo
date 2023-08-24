import type { SimpleDbEntityHistory } from '@onekeyhq/engine/src/dbs/simple/entity/SimpleDbEntityHistory';
import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';

import { findMatchingPolicies, updateLastWriteTime } from './utils';

import type { CleanupPolicy, SimpleDbCleanupPolicy } from './types';

const mockCleanupPolicies = jest.fn(() => [] as CleanupPolicy[]);
jest.mock('./policy', () => ({
  get cleanupPolicies() {
    return mockCleanupPolicies();
  },
}));

jest.mock('@onekeyhq/engine/src/dbs/simple/entity/SimpleDbEntityLastWrite');
const mockedSimpleDbLastWrite = simpleDb.lastWrite as jest.Mocked<
  typeof simpleDb.lastWrite
>;

describe('utils', () => {
  const policy: CleanupPolicy = {
    source: 'redux',
    dataPaths: ['accountSelector'],
    strategy: {
      type: 'reset-on-expiry',
      expiry: 3600,
      resetToValue: false,
    },
  };
  beforeEach(() => {
    findMatchingPolicies.clear();
    mockedSimpleDbLastWrite.set.mockClear();
    mockCleanupPolicies.mockReturnValue([policy]);
  });
  describe('findMatchingPolicy', () => {
    describe('redux policy', () => {
      it('supports exact match', () => {
        expect(findMatchingPolicies('accountSelector')).toEqual([policy]);
      });

      it('supports prefix matching for nested keys', () => {
        expect(findMatchingPolicies('accountSelector.isLoading')).toEqual([
          policy,
        ]);
        expect(findMatchingPolicies('accountSelectorDoNotMatchThis')).toEqual(
          [],
        );
      });
    });

    describe('simpleDb policy', () => {
      const simpleDbPolicy: SimpleDbCleanupPolicy<SimpleDbEntityHistory> = {
        source: 'simpleDb',
        simpleDbEntity: simpleDb.history,
        dataPaths: ['items'],
        strategy: {
          type: 'array-slice',
          maxToKeep: 1000,
          keepItemsAt: 'tail',
        },
      };
      beforeEach(() => {
        mockCleanupPolicies.mockReturnValue([simpleDbPolicy]);
      });

      it('supports exact match', () => {
        expect(findMatchingPolicies('history:items')).toEqual([simpleDbPolicy]);
      });

      it('supports prefix matching for nested keys', () => {
        expect(findMatchingPolicies('history:items.nestedField')).toEqual([
          simpleDbPolicy,
        ]);
        expect(findMatchingPolicies('history:itemsDoNotMatchThis')).toEqual([]);
      });
    });
  });

  describe('updateLastWriteTime', () => {
    it('calls appStorage.setSetting with the correct key', () => {
      const now = Date.now();
      updateLastWriteTime('redux', 'accountSelector', now);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockedSimpleDbLastWrite.set).toHaveBeenCalledWith(
        'redux',
        'accountSelector',
        now,
      );
    });

    it('skips if no matching policy', () => {
      mockCleanupPolicies.mockReturnValue([]);
      updateLastWriteTime('redux', 'accountSelector');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockedSimpleDbLastWrite.set).not.toHaveBeenCalled();
    });
  });
});
