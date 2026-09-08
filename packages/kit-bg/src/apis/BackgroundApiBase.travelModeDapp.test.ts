import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import { EPasswordVerifyStatus } from '@onekeyhq/shared/types/password';

import { EAtomNames } from '../states/jotai/atomNames';

import BackgroundApiBase from './BackgroundApiBase';

const mockRunDappRequest = jest.fn(
  async <T>({ onBlocked }: { onBlocked: () => T | Promise<T> }) => onBlocked(),
);

jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: {
    getRuntimeEnvironment: jest.fn(async () => ({
      commands: { isBlocked: true },
    })),
    getRuntimeEnvironmentSync: jest.fn(() => ({
      persistence: {
        runSync: <T>({ operation }: { operation: () => T }) => operation(),
      },
    })),
  },
}));

jest.mock('./TravelModeDappRequestIngress', () => ({
  travelModeDappRequestIngress: {
    run: <T>(params: { onBlocked: () => T | Promise<T> }) =>
      mockRunDappRequest(params),
  },
}));

describe('BackgroundApiBase Travel Mode DApp ingress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ['Browser injected provider', 'https://browser.example'],
    ['WebView provider', 'https://webview.example'],
  ])('rejects %s before loading provider business code', async (_, origin) => {
    const backgroundApi = Object.create(
      BackgroundApiBase.prototype,
    ) as BackgroundApiBase;
    const getProviderApi = jest.fn();
    Object.defineProperty(backgroundApi, 'getProviderApi', {
      value: getProviderApi,
    });

    await expect(
      backgroundApi.handleProviderMethods({
        data: {
          id: 1,
          jsonrpc: '2.0',
          method: 'eth_accounts',
        },
        origin,
        scope: IInjectedProviderNames.ethereum,
      }),
    ).rejects.toMatchObject({
      code: -32_603,
      message: 'Unknown error',
    });

    expect(mockRunDappRequest).toHaveBeenCalledTimes(1);
    expect(getProviderApi).not.toHaveBeenCalled();
  });
});

describe('BackgroundApiBase Travel Mode state control plane', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function buildBackgroundApi() {
    const backgroundApi = Object.create(
      BackgroundApiBase.prototype,
    ) as BackgroundApiBase;
    const passwordState = {
      isPasswordSet: true,
      passwordErrorAttempts: 1,
      passwordErrorProtectionTime: 0,
      passwordMode: 'passcode',
      webAuthCredentialId: 'must-not-be-overwritten',
    };
    const passwordAtom = {
      get: jest.fn(async () => passwordState),
      set: jest.fn(async () => undefined),
    };
    const passwordRuntimeState = {
      unLock: true,
      passwordVerifyStatus: { value: EPasswordVerifyStatus.DEFAULT },
    };
    const passwordRuntimeAtom = {
      get: jest.fn(async () => passwordRuntimeState),
      set: jest.fn(async () => undefined),
    };
    const manualLockState = { manualLocking: true };
    const manualLockAtom = {
      get: jest.fn(async () => manualLockState),
      set: jest.fn(async () => undefined),
    };
    const settingsState = {
      currencyInfo: { id: 'eur', symbol: '€' },
      hapticFeedbackEnabled: false,
      instanceId: 'private-instance-id',
      locale: 'zh-CN',
      sensitiveEncodeKey: 'private-encode-key',
      theme: 'dark',
    };
    const settingsAtom = {
      get: jest.fn(async () => settingsState),
      set: jest.fn(async (_value: unknown) => undefined),
    };
    const currencyState = {
      currencyMap: {
        eur: { id: 'eur', name: 'Euro', type: ['fiat'], unit: '€' },
      },
    };
    const currencyAtom = {
      get: jest.fn(async () => currencyState),
      set: jest.fn(async () => undefined),
    };
    const businessAtom = {
      get: jest.fn(async () => ({ walletId: 'sensitive-wallet' })),
      set: jest.fn(async () => undefined),
    };
    const contextStoreMapAtom = {
      get: jest.fn(async () => ({
        'accountSelector@discover--https://private.example': {
          storeName: 'accountSelector',
          accountSelectorInfo: {
            sceneName: 'discover',
            sceneUrl: 'https://private.example',
            enabledNum: [0],
          },
          count: 1,
        },
      })),
      set: jest.fn(async () => undefined),
    };
    const perpsOrderBookOptionsAtom = {
      get: jest.fn(async () => ({
        coin: 'xyz:NVDA',
        assetId: 12,
        nSigFigs: 5,
        mantissa: 2,
        accountAddress: 'must-not-be-exposed',
      })),
      set: jest.fn(async () => undefined),
    };
    const tradingModeAtom = {
      get: jest.fn(async () => 'spot'),
      set: jest.fn(async () => undefined),
    };
    const resettablePerpsAtoms = {
      [EAtomNames.perpsActiveAssetCtxAtom]: {
        get: jest.fn(async () => ({ coin: 'xyz:NVDA' })),
        set: jest.fn(async () => undefined),
      },
      [EAtomNames.perpsActiveAssetCtxDisplayAtom]: {
        get: jest.fn(async () => ({ coin: 'xyz:NVDA' })),
        set: jest.fn(async () => undefined),
      },
      [EAtomNames.perpsActiveAssetDataAtom]: {
        get: jest.fn(async () => ({ coin: 'xyz:NVDA' })),
        set: jest.fn(async () => undefined),
      },
      [EAtomNames.spotActiveAssetCtxAtom]: {
        get: jest.fn(async () => ({ coin: '@1' })),
        set: jest.fn(async () => undefined),
      },
    };
    backgroundApi.allAtoms = Promise.resolve({
      [EAtomNames.passwordAtom]: passwordRuntimeAtom,
      [EAtomNames.passwordPersistAtom]: passwordAtom,
      [EAtomNames.passwordPersistManualLockStateAtom]: manualLockAtom,
      [EAtomNames.settingsPersistAtom]: settingsAtom,
      [EAtomNames.currencyPersistAtom]: currencyAtom,
      [EAtomNames.jotaiContextStoreMapAtom]: contextStoreMapAtom,
      [EAtomNames.perpsActiveOrderBookOptionsAtom]: perpsOrderBookOptionsAtom,
      [EAtomNames.tradingModeAtom]: tradingModeAtom,
      ...resettablePerpsAtoms,
      [EAtomNames.addressBookPersistAtom]: businessAtom,
    }) as unknown as BackgroundApiBase['allAtoms'];
    return {
      backgroundApi,
      businessAtom,
      currencyAtom,
      contextStoreMapAtom,
      manualLockAtom,
      passwordAtom,
      passwordRuntimeAtom,
      passwordRuntimeState,
      perpsOrderBookOptionsAtom,
      settingsAtom,
      tradingModeAtom,
      resettablePerpsAtoms,
    };
  }

  it('hydrates only the Travel Mode control state when all atoms are requested', async () => {
    const {
      backgroundApi,
      businessAtom,
      currencyAtom,
      contextStoreMapAtom,
      manualLockAtom,
      passwordAtom,
      passwordRuntimeAtom,
      passwordRuntimeState,
      perpsOrderBookOptionsAtom,
      settingsAtom,
      tradingModeAtom,
    } = buildBackgroundApi();

    const { states } = await backgroundApi.getAtomStates();
    expect(states[EAtomNames.passwordPersistAtom]).toEqual(
      expect.objectContaining({
        isPasswordSet: true,
        passwordErrorAttempts: 1,
        passwordMode: 'passcode',
        webAuthCredentialId: '',
      }),
    );
    expect(states[EAtomNames.passwordAtom]).toEqual(passwordRuntimeState);
    expect(states[EAtomNames.passwordPersistManualLockStateAtom]).toEqual({
      manualLocking: true,
    });
    expect(states[EAtomNames.settingsPersistAtom]).toEqual(
      expect.objectContaining({
        currencyInfo: { id: 'eur', symbol: '€' },
        hapticFeedbackEnabled: false,
        locale: 'zh-CN',
        theme: 'dark',
      }),
    );
    expect(
      (states[EAtomNames.settingsPersistAtom] as { instanceId: string })
        .instanceId,
    ).not.toBe('private-instance-id');
    expect(states[EAtomNames.currencyPersistAtom]).toEqual({
      currencyMap: {
        eur: { id: 'eur', name: 'Euro', type: ['fiat'], unit: '€' },
      },
    });
    expect(states[EAtomNames.jotaiContextStoreMapAtom]).toEqual({});
    expect(states[EAtomNames.perpsActiveOrderBookOptionsAtom]).toEqual({
      coin: 'xyz:NVDA',
      assetId: 12,
      nSigFigs: 5,
      mantissa: 2,
    });
    expect(states[EAtomNames.tradingModeAtom]).toBe('spot');

    expect(passwordAtom.get).toHaveBeenCalledTimes(1);
    expect(passwordRuntimeAtom.get).toHaveBeenCalledTimes(1);
    expect(manualLockAtom.get).toHaveBeenCalledTimes(1);
    expect(settingsAtom.get).toHaveBeenCalledTimes(1);
    expect(currencyAtom.get).toHaveBeenCalledTimes(1);
    expect(contextStoreMapAtom.get).toHaveBeenCalledTimes(1);
    expect(perpsOrderBookOptionsAtom.get).toHaveBeenCalledTimes(1);
    expect(tradingModeAtom.get).toHaveBeenCalledTimes(1);
    expect(businessAtom.get).not.toHaveBeenCalled();
  });

  it('rejects an explicit business atom read or write', async () => {
    const { backgroundApi, businessAtom } = buildBackgroundApi();

    await expect(
      backgroundApi.getAtomStates([EAtomNames.addressBookPersistAtom]),
    ).rejects.toThrow('Unknown error');
    await expect(
      backgroundApi.setAtomValue(EAtomNames.addressBookPersistAtom, {
        walletId: 'changed',
      }),
    ).rejects.toThrow('Unknown error');

    expect(businessAtom.get).not.toHaveBeenCalled();
    expect(businessAtom.set).not.toHaveBeenCalled();
  });

  it('keeps only top-level context provider registrations', async () => {
    const { backgroundApi, contextStoreMapAtom } = buildBackgroundApi();

    await backgroundApi.setAtomValue(EAtomNames.jotaiContextStoreMapAtom, {
      'accountSelector@home': {
        storeName: 'accountSelector',
        accountSelectorInfo: {
          sceneName: 'home',
          sceneUrl: '',
          enabledNum: [0, 1, 9],
        },
        count: 2,
      },
      'accountSelector@discover--https://private.example': {
        storeName: 'accountSelector',
        accountSelectorInfo: {
          sceneName: 'discover',
          sceneUrl: 'https://private.example',
          enabledNum: [0],
        },
        count: 1,
      },
      swap: { storeName: 'swap', count: 1 },
      sendConfirm: { storeName: 'sendConfirm', count: 1 },
    });

    expect(contextStoreMapAtom.set).toHaveBeenCalledWith({
      'accountSelector@home': {
        storeName: 'accountSelector',
        accountSelectorInfo: {
          sceneName: 'home',
          sceneUrl: '',
          enabledNum: [0, 1],
        },
        count: 2,
      },
      swap: { storeName: 'swap', count: 1 },
    });
  });

  it('syncs only public Perps order-book subscription options', async () => {
    const { backgroundApi, perpsOrderBookOptionsAtom } = buildBackgroundApi();

    await backgroundApi.setAtomValue(
      EAtomNames.perpsActiveOrderBookOptionsAtom,
      {
        coin: 'xyz:NVDA',
        assetId: 12,
        nSigFigs: 5,
        mantissa: 2,
        accountAddress: 'must-not-be-written',
      },
    );

    expect(perpsOrderBookOptionsAtom.set).toHaveBeenCalledWith({
      coin: 'xyz:NVDA',
      assetId: 12,
      nSigFigs: 5,
      mantissa: 2,
    });
  });

  it('rejects invalid Perps order-book subscription options', async () => {
    const { backgroundApi, perpsOrderBookOptionsAtom } = buildBackgroundApi();

    await expect(
      backgroundApi.setAtomValue(EAtomNames.perpsActiveOrderBookOptionsAtom, {
        coin: 'xyz:NVDA',
        assetId: -1,
        nSigFigs: 99,
      }),
    ).rejects.toThrow('Unknown error');

    expect(perpsOrderBookOptionsAtom.set).not.toHaveBeenCalled();
  });

  it('syncs only valid public Perps runtime state', async () => {
    const { backgroundApi, resettablePerpsAtoms, tradingModeAtom } =
      buildBackgroundApi();

    await backgroundApi.setAtomValue(EAtomNames.tradingModeAtom, 'perp');
    await backgroundApi.setAtomValue(
      EAtomNames.perpsActiveAssetCtxAtom,
      undefined,
    );
    await expect(
      backgroundApi.setAtomValue(EAtomNames.perpsActiveAssetDataAtom, {
        accountAddress: 'must-not-be-written',
      }),
    ).rejects.toThrow('Unknown error');
    await expect(
      backgroundApi.setAtomValue(EAtomNames.tradingModeAtom, 'invalid'),
    ).rejects.toThrow('Unknown error');

    expect(tradingModeAtom.set).toHaveBeenCalledWith('perp');
    expect(
      resettablePerpsAtoms[EAtomNames.perpsActiveAssetCtxAtom].set,
    ).toHaveBeenCalledWith(undefined);
    expect(
      resettablePerpsAtoms[EAtomNames.perpsActiveAssetDataAtom].set,
    ).not.toHaveBeenCalled();
  });

  it('writes only the four supported preferences', async () => {
    const { backgroundApi, settingsAtom } = buildBackgroundApi();

    await backgroundApi.setAtomValue(EAtomNames.settingsPersistAtom, {
      currencyInfo: { id: 'jpy', symbol: '¥' },
      hapticFeedbackEnabled: true,
      instanceId: 'attacker-instance-id',
      locale: 'ja-JP',
      sensitiveEncodeKey: 'attacker-encode-key',
      theme: 'light',
    });

    expect(settingsAtom.set).toHaveBeenCalledWith(
      expect.objectContaining({
        currencyInfo: { id: 'jpy', symbol: '¥' },
        hapticFeedbackEnabled: true,
        locale: 'ja-JP',
        theme: 'light',
      }),
    );
    const nextValue = settingsAtom.set.mock.calls[0]?.[0] as {
      instanceId: string;
      sensitiveEncodeKey: string;
    };
    expect(nextValue.instanceId).not.toBe('attacker-instance-id');
    expect(nextValue.sensitiveEncodeKey).not.toBe('attacker-encode-key');
  });

  it('persists only mutable password-protection fields', async () => {
    const { backgroundApi, passwordAtom } = buildBackgroundApi();

    await backgroundApi.setAtomValue(EAtomNames.passwordPersistAtom, {
      isPasswordSet: false,
      passwordErrorAttempts: 2,
      passwordErrorProtectionTime: 123,
      passwordMode: 'passcode',
      webAuthCredentialId: 'attacker-controlled',
    });

    expect(passwordAtom.set).toHaveBeenCalledWith(
      expect.objectContaining({
        isPasswordSet: true,
        passwordErrorAttempts: 2,
        passwordErrorProtectionTime: 123,
        passwordMode: 'passcode',
        webAuthCredentialId: '',
      }),
    );
  });

  it('publishes an incorrect-passcode status to the password prompt', async () => {
    const { backgroundApi, passwordRuntimeAtom } = buildBackgroundApi();

    await backgroundApi.setAtomValue(EAtomNames.passwordAtom, {
      unLock: false,
      passwordVerifyStatus: {
        value: EPasswordVerifyStatus.ERROR,
        message: 'Incorrect passcode',
      },
    });

    expect(passwordRuntimeAtom.set).toHaveBeenCalledWith({
      unLock: true,
      passwordVerifyStatus: {
        value: EPasswordVerifyStatus.ERROR,
        message: 'Incorrect passcode',
      },
    });
  });
});
