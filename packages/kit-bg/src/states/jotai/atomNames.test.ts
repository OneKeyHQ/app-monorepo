import { EAtomNames, atomsConfig } from './atomNames';

describe('atomsConfig', () => {
  it('replaces Perps snapshot atoms instead of merging stale fields', () => {
    expect(
      atomsConfig[EAtomNames.perpsActiveAssetAtom]?.mergeInitialValue,
    ).toBe(false);
    expect(atomsConfig[EAtomNames.spotActiveAssetAtom]?.mergeInitialValue).toBe(
      false,
    );
    expect(
      atomsConfig[EAtomNames.perpsCommonConfigPersistAtom]?.mergeInitialValue,
    ).toBe(false);
    expect(
      atomsConfig[EAtomNames.perpTokenFavoritesPersistAtom]?.mergeInitialValue,
    ).toBe(false);
    expect(
      atomsConfig[EAtomNames.spotTokenFavoritesPersistAtom]?.mergeInitialValue,
    ).toBe(false);
    expect(
      atomsConfig[EAtomNames.perpsFavoritesOrderPersistAtom]?.mergeInitialValue,
    ).toBe(false);
    expect(
      atomsConfig[EAtomNames.perpsDepositOrderAtom]?.mergeInitialValue,
    ).toBe(false);
  });
});
