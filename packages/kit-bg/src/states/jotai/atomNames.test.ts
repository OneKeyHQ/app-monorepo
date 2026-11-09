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

  it('replaces the app update snapshot instead of resurrecting cleared fields', () => {
    // On native the UI runtime hydrates the atom's initialValue from a
    // cold-start MMKV snapshot; merging writes with it brought a cleared
    // featuredChangelog back after "clear app update cache" (OK-54862).
    expect(
      atomsConfig[EAtomNames.appUpdatePersistAtom]?.mergeInitialValue,
    ).toBe(false);
  });

  it('replaces firmware update dev settings instead of merging target arrays', () => {
    expect(
      atomsConfig[EAtomNames.firmwareUpdateDevSettingsPersistAtom]
        ?.mergeInitialValue,
    ).toBe(false);
  });
});
