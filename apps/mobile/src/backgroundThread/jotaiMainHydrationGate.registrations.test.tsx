/** @jest-environment jsdom */

import { act, cleanup, render, waitFor } from '@testing-library/react';

import { JotaiContextStoreMirrorTracker } from '@onekeyhq/kit/src/states/jotai/utils/JotaiContextStoreMirrorTracker';
import { EAtomNames } from '@onekeyhq/kit-bg/src/states/jotai/atomNames';
import {
  EJotaiContextStoreNames,
  jotaiContextStoreMapAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/jotaiContextStoreMap';
import { jotaiBgSync } from '@onekeyhq/kit-bg/src/states/jotai/jotaiBgSync';
import { jotaiInitFromUi } from '@onekeyhq/kit-bg/src/states/jotai/jotaiInitFromUi';
import { jotaiDefaultStore } from '@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  applyOrQueueJotaiStateBroadcast,
  runJotaiMainHydration,
} from './jotaiMainHydrationGate';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isJest: true,
    isNative: true,
    isNativeMainThread: true,
    enableNativeBackgroundThread: true,
  },
}));

jest.mock(
  '@onekeyhq/kit/src/states/jotai/utils/JotaiContextRootProviderRenderer',
  () => ({ JotaiContextRootProviderRenderer: () => null }),
);

const mapName = EAtomNames.jotaiContextStoreMapAtom;
const mapAtom = jotaiContextStoreMapAtom.atom();

afterEach(async () => {
  await act(async () => cleanup());
  jest.restoreAllMocks();
});

it('keeps a mounted Swap account selector when another mirror registers after a stale startup RPC', async () => {
  const writeToBackground = jest
    .spyOn(jotaiBgSync, 'proxyStateUpdateActionFromUiToBg')
    .mockImplementation(async (update) => {
      applyOrQueueJotaiStateBroadcast(update);
    });
  const swapAccountSelector = {
    storeName: EJotaiContextStoreNames.accountSelector,
    accountSelectorInfo: {
      sceneName: EAccountSelectorSceneName.swap,
      enabledNum: [0, 1],
    },
  };
  const swapRegistration = {
    'accountSelector@swap': { ...swapAccountSelector, count: 1 },
  };

  await runJotaiMainHydration(async () => {
    // BG took this snapshot before the mirror mounted. Its registration
    // reaches BG while the reply is in flight, so the gate buffers the echo.
    const states = { [mapName]: {} };
    render(<JotaiContextStoreMirrorTracker {...swapAccountSelector} />);
    await waitFor(() =>
      expect(writeToBackground).toHaveBeenCalledWith({
        name: mapName,
        payload: swapRegistration,
      }),
    );
    await jotaiInitFromUi({ states });
  });
  expect(jotaiDefaultStore.get(mapAtom)).toEqual(swapRegistration);

  // The replay restored the render atom. The next registration also needs
  // the still-mounted selector in the UI's local reference counts.
  render(
    <JotaiContextStoreMirrorTracker
      storeName={EJotaiContextStoreNames.swapTokenSelector}
    />,
  );
  await waitFor(() => expect(writeToBackground).toHaveBeenCalledTimes(2));
  expect(jotaiDefaultStore.get(mapAtom)).toEqual({
    ...swapRegistration,
    swapTokenSelector: {
      storeName: EJotaiContextStoreNames.swapTokenSelector,
      count: 1,
    },
  });
});

it('hydrates the render atom from a startup RPC with no registration echo', async () => {
  const map = {
    swap: { storeName: EJotaiContextStoreNames.swap, count: 1 },
  };
  await runJotaiMainHydration(() =>
    jotaiInitFromUi({ states: { [mapName]: map } }),
  );
  expect(jotaiDefaultStore.get(mapAtom)).toEqual(map);
});
