import { EAtomNames } from '../states/jotai/atomNames';

import { isBackgroundApiAtomWritable } from './backgroundApiPermissions';

describe('backgroundApiPermissions', () => {
  it('blocks UI writes to the background-owned Unifold recipient', () => {
    expect(
      isBackgroundApiAtomWritable(EAtomNames.perpsUnifoldActiveRecipientAtom),
    ).toBe(false);
  });

  it('blocks UI writes to the inscription protection control', () => {
    expect(
      isBackgroundApiAtomWritable(
        EAtomNames.inscriptionProtectionControlPersistAtom,
      ),
    ).toBe(false);
  });

  it('keeps regular cross-runtime atoms writable', () => {
    expect(isBackgroundApiAtomWritable(EAtomNames.settingsPersistAtom)).toBe(
      true,
    );
  });
});
