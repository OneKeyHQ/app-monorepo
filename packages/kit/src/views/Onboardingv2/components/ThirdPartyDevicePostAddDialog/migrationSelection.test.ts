import {
  buildInitialSelection,
  buildRenames,
} from './migrationSelection';

import type { IThirdPartyAccountNameCandidate } from '@onekeyhq/shared/src/referralCode/type';

// Mirrors the real Ledger Live shape: one account offers a single name, the
// other reuses one address across chains and offers two.
const CANDIDATES: IThirdPartyAccountNameCandidate[] = [
  {
    indexedAccountId: 'hw-1--0',
    currentName: 'Account 1',
    sourceName: 'Ethereum 1',
    sourceNames: ['Ethereum 1', 'New Polygon 1'],
    matchedAddress: `0x${'12'.repeat(20)}`,
    source: 'ledger-live',
  },
  {
    indexedAccountId: 'hw-1--1',
    currentName: 'Account 2',
    sourceName: 'Bitcoin 2',
    sourceNames: ['Bitcoin 2'],
    matchedAddress: `0x${'34'.repeat(20)}`,
    source: 'ledger-live',
  },
];

describe('buildInitialSelection', () => {
  it('checks every candidate and preselects the first name', () => {
    expect(buildInitialSelection(CANDIDATES)).toEqual({
      'hw-1--0': { checked: true, sourceName: 'Ethereum 1' },
      'hw-1--1': { checked: true, sourceName: 'Bitcoin 2' },
    });
  });
});

describe('buildRenames', () => {
  it('renames everything by default without the user touching anything', () => {
    expect(
      buildRenames({
        candidates: CANDIDATES,
        selection: buildInitialSelection(CANDIDATES),
      }),
    ).toEqual([
      { indexedAccountId: 'hw-1--0', name: 'Ethereum 1' },
      { indexedAccountId: 'hw-1--1', name: 'Bitcoin 2' },
    ]);
  });

  it('applies the picked name rather than the first one', () => {
    const selection = buildInitialSelection(CANDIDATES);
    selection['hw-1--0'] = { checked: true, sourceName: 'New Polygon 1' };
    expect(buildRenames({ candidates: CANDIDATES, selection })).toEqual([
      { indexedAccountId: 'hw-1--0', name: 'New Polygon 1' },
      { indexedAccountId: 'hw-1--1', name: 'Bitcoin 2' },
    ]);
  });

  it('skips unchecked rows', () => {
    const selection = buildInitialSelection(CANDIDATES);
    selection['hw-1--1'] = { ...selection['hw-1--1'], checked: false };
    expect(buildRenames({ candidates: CANDIDATES, selection })).toEqual([
      { indexedAccountId: 'hw-1--0', name: 'Ethereum 1' },
    ]);
  });

  it('renames nothing when the user unchecks everything', () => {
    expect(buildRenames({ candidates: CANDIDATES, selection: {} })).toEqual([]);
  });

  it('ignores a picked name that is no longer offered', () => {
    expect(
      buildRenames({
        candidates: CANDIDATES,
        selection: {
          'hw-1--0': { checked: true, sourceName: 'Stale Name' },
        },
      }),
    ).toEqual([]);
  });

  it('falls back to sourceName when sourceNames is absent', () => {
    const legacy = [
      {
        ...CANDIDATES[1],
        sourceNames: undefined,
      } as unknown as IThirdPartyAccountNameCandidate,
    ];
    expect(
      buildRenames({
        candidates: legacy,
        selection: buildInitialSelection(legacy),
      }),
    ).toEqual([{ indexedAccountId: 'hw-1--1', name: 'Bitcoin 2' }]);
  });
});
