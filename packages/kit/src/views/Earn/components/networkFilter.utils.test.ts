import { getQuickNetworkIds } from './networkFilter.utils';

const ORDERED = ['evm--1', 'evm--8453', 'evm--42161', 'sol--101', 'evm--56'];

describe('getQuickNetworkIds', () => {
  it('shows the first four networks when nothing beyond them is picked', () => {
    expect(
      getQuickNetworkIds({ orderedIds: ORDERED, selectedIds: ['evm--8453'] }),
    ).toEqual(['evm--1', 'evm--8453', 'evm--42161', 'sol--101']);
  });

  it('adds a network picked from the full list after the four', () => {
    expect(
      getQuickNetworkIds({
        orderedIds: ORDERED,
        selectedIds: ['evm--56', 'evm--1'],
      }),
    ).toEqual(['evm--1', 'evm--8453', 'evm--42161', 'sol--101', 'evm--56']);
  });

  it('keeps the list order for several picks beyond the four', () => {
    expect(
      getQuickNetworkIds({
        orderedIds: [...ORDERED, 'evm--137'],
        selectedIds: ['evm--137', 'evm--56'],
      }),
    ).toEqual([
      'evm--1',
      'evm--8453',
      'evm--42161',
      'sol--101',
      'evm--56',
      'evm--137',
    ]);
  });

  it('shows every network when there are four or fewer', () => {
    expect(
      getQuickNetworkIds({
        orderedIds: ['evm--1', 'sol--101'],
        selectedIds: [],
      }),
    ).toEqual(['evm--1', 'sol--101']);
  });

  it('ignores a pick the list does not have', () => {
    expect(
      getQuickNetworkIds({
        orderedIds: ORDERED,
        selectedIds: ['evm--10'],
      }),
    ).toEqual(['evm--1', 'evm--8453', 'evm--42161', 'sol--101']);
  });
});
