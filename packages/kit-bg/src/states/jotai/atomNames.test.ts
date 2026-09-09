import { EAtomNames, atomsConfig } from './atomNames';

describe('atomsConfig', () => {
  it('replaces the Market chart settings snapshot instead of merging legacy fields', () => {
    expect(
      atomsConfig[EAtomNames.marketTradingViewSubIndicatorCountPersistAtom]
        ?.mergeInitialValue,
    ).toBe(false);
  });

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

  it('replaces firmware update dev settings instead of merging target arrays', () => {
    expect(
      atomsConfig[EAtomNames.firmwareUpdateDevSettingsPersistAtom]
        ?.mergeInitialValue,
    ).toBe(false);
  });
});
