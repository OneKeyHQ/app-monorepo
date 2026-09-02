import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  EJotaiContextStoreNames,
  JotaiContextStoreRegistrationRegistry,
} from './jotaiContextStoreMap';

describe('jotaiContextStoreMap', () => {
  it('includes the market swap review store name', () => {
    expect(EJotaiContextStoreNames.marketSwapReview).toBe('marketSwapReview');
    expect(EJotaiContextStoreNames.marketSwap).toBe('marketSwap');
  });

  it('merges interleaved extension runtime registrations in background ownership order', () => {
    const registry = new JotaiContextStoreRegistrationRegistry();
    const storeId = 'accountSelector:swap';
    const update = ({
      action = 'add',
      enabledNum,
      registrationId,
      revision,
    }: {
      action?: 'add' | 'remove';
      enabledNum: number[];
      registrationId: string;
      revision: number;
    }) =>
      registry.update({
        action,
        data: {
          storeName: EJotaiContextStoreNames.accountSelector,
          accountSelectorInfo: {
            enabledNum,
            sceneName: EAccountSelectorSceneName.swap,
          },
        },
        registrationId,
        revision,
        storeId,
      });

    update({ enabledNum: [0], registrationId: 'popup:1', revision: 1 });
    const bothRuntimes = update({
      enabledNum: [1],
      registrationId: 'side-panel:1',
      revision: 1,
    });
    expect(bothRuntimes.map[storeId]).toMatchObject({
      accountSelectorInfo: { enabledNum: [0, 1] },
      count: 2,
    });

    const popupChanged = update({
      enabledNum: [0, 2],
      registrationId: 'popup:1',
      revision: 3,
    });
    expect(popupChanged.map[storeId]).toMatchObject({
      accountSelectorInfo: { enabledNum: [0, 1, 2] },
      count: 2,
    });

    const stalePopupCleanup = update({
      action: 'remove',
      enabledNum: [0],
      registrationId: 'popup:1',
      revision: 2,
    });
    expect(stalePopupCleanup.map[storeId]).toMatchObject({
      accountSelectorInfo: { enabledNum: [0, 1, 2] },
      count: 2,
    });

    const popupClosed = update({
      action: 'remove',
      enabledNum: [0, 2],
      registrationId: 'popup:1',
      revision: 4,
    });
    expect(popupClosed.map[storeId]).toMatchObject({
      accountSelectorInfo: { enabledNum: [1] },
      count: 1,
    });

    const allClosed = update({
      action: 'remove',
      enabledNum: [1],
      registrationId: 'side-panel:1',
      revision: 2,
    });
    expect(allClosed.map[storeId]).toBeUndefined();
    expect(allClosed.registrationCount).toBe(0);
  });
});
