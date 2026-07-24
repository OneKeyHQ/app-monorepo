import { EAccountSelectorSceneName } from '../../types';

import accountSelectorUtils from './accountSelectorUtils';

describe('accountSelectorUtils Prime payment scene', () => {
  it('keeps temporary payment selection out of persisted and global state', () => {
    const sceneName = EAccountSelectorSceneName.primePayment;

    expect(accountSelectorUtils.isSceneCanPersist({ sceneName })).toBe(false);
    expect(accountSelectorUtils.isSceneCanAutoSelect({ sceneName })).toBe(
      false,
    );
    expect(
      accountSelectorUtils.isSceneAutoSaveToGlobalDeriveType({ sceneName }),
    ).toBe(false);
  });
});
