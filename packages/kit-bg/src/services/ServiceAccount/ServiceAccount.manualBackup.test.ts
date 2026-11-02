/* eslint-disable @typescript-eslint/unbound-method */
import { mnemonicFromEntropy } from '@onekeyhq/core/src/secret';
import {
  LocalSecretEnvelopeUnavailable,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { createNativeStorageMigrationInconsistentErrorMessage } from '@onekeyhq/shared/src/storage/nativeStorageTypes';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import { EHardwareCallContext } from '@onekeyhq/shared/types/device';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import BackgroundApiBase from '../../apis/BackgroundApiBase';
import localDb from '../../dbs/local/localDb';
import simpleDb from '../../dbs/simple/simpleDb';
import { EAtomNames } from '../../states/jotai/atomNames';
import { devSettingsPersistAtom } from '../../states/jotai/atoms/devSettings';
import {
  appIsLocked,
  passwordPersistAtom,
} from '../../states/jotai/atoms/password';

import ServiceAccount from './ServiceAccount';

jest.mock('@onekeyhq/core/src/secret', () => ({
  ...jest.requireActual<typeof import('@onekeyhq/core/src/secret')>(
    '@onekeyhq/core/src/secret',
  ),
  mnemonicFromEntropy: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/storage/nativeStorageExecutor', () => ({
  isNativeAppStorageEmergencyModeActive: jest.fn(() => false),
}));
jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    isPasswordSet: jest.fn(async () => true),
    getCredentialInner: jest.fn(),
    getCredentialRaw: jest.fn(),
    getWallet: jest.fn(),
  },
}));
jest.mock('../../dbs/simple/simpleDb', () => ({
  __esModule: true,
  default: { botWallet: { getMetadata: jest.fn() } },
}));

function createService() {
  const service = Object.create(ServiceAccount.prototype) as ServiceAccount;
  const promptPasswordVerifyByWallet = jest.fn();
  const verifyPasswordForManualMnemonicRecovery = jest.fn(
    async () => 'encoded-test-password',
  );
  const encodeSensitiveText = jest.fn(async () => 'encoded-test-result');
  const getAtomStates = jest.fn(async () => ({ states: {} }));
  service.backgroundApi = {
    getAtomStates,
    servicePassword: {
      promptPasswordVerifyByWallet,
      encodeSensitiveText,
      verifyPasswordForManualMnemonicRecovery,
    },
  } as unknown as ServiceAccount['backgroundApi'];
  return {
    service,
    promptPasswordVerifyByWallet,
    encodeSensitiveText,
    verifyPasswordForManualMnemonicRecovery,
    getAtomStates,
  };
}

describe('manual HD mnemonic export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(localDb.getCredentialInner).mockResolvedValue({
      id: 'hd-1',
      credential: 'opaque-test-credential',
    });
    jest.mocked(mnemonicFromEntropy).mockResolvedValue('test-result');
  });

  it('waits for password verification and reads only the wallet credential', async () => {
    const { service, promptPasswordVerifyByWallet, encodeSensitiveText } =
      createService();
    let resolvePassword!: (value: { password: string }) => void;
    promptPasswordVerifyByWallet.mockImplementation(
      () =>
        new Promise<{ password: string }>((resolve) => {
          resolvePassword = resolve;
        }),
    );
    const result = service.getHDAccountMnemonic({
      walletId: 'hd-1',
      reason: EReasonForNeedPassword.Security,
    });
    expect(promptPasswordVerifyByWallet).toHaveBeenCalledWith({
      walletId: 'hd-1',
      reason: EReasonForNeedPassword.Security,
      hardwareCallContext: EHardwareCallContext.BACKGROUND_TASK,
    });
    expect(localDb.getCredentialInner).not.toHaveBeenCalled();
    expect(mnemonicFromEntropy).not.toHaveBeenCalled();
    resolvePassword({ password: 'encoded-test-password' });
    await expect(result).resolves.toEqual({ mnemonic: 'encoded-test-result' });
    expect(localDb.getCredentialInner).toHaveBeenCalledWith({
      credentialId: 'hd-1',
    });
    expect(mnemonicFromEntropy).toHaveBeenCalledWith(
      'opaque-test-credential',
      'encoded-test-password',
    );
    expect(encodeSensitiveText).toHaveBeenCalledWith({ text: 'test-result' });
    expect(simpleDb.botWallet.getMetadata).not.toHaveBeenCalled();
  });

  it('does not read or decrypt a credential when password verification is cancelled', async () => {
    const { service, promptPasswordVerifyByWallet } = createService();
    promptPasswordVerifyByWallet.mockRejectedValue(
      new OneKeyLocalError('Password prompt cancelled'),
    );
    await expect(
      service.getHDAccountMnemonic({
        walletId: 'hd-1',
        reason: EReasonForNeedPassword.Security,
      }),
    ).rejects.toThrow('Password prompt cancelled');
    expect(localDb.getCredentialInner).not.toHaveBeenCalled();
    expect(mnemonicFromEntropy).not.toHaveBeenCalled();
  });

  it('does not claim export succeeded when the credential security layer is unavailable', async () => {
    const { service, promptPasswordVerifyByWallet, encodeSensitiveText } =
      createService();
    promptPasswordVerifyByWallet.mockResolvedValue({
      password: 'encoded-test-password',
    });
    jest.mocked(localDb.getCredentialInner).mockRejectedValueOnce(
      new LocalSecretEnvelopeUnavailable({
        message: 'Test credential unavailable',
      }),
    );
    await expect(
      service.getHDAccountMnemonic({
        walletId: 'hd-1',
        reason: EReasonForNeedPassword.Security,
      }),
    ).rejects.toThrow('Test credential unavailable');
    expect(mnemonicFromEntropy).not.toHaveBeenCalled();
    expect(encodeSensitiveText).not.toHaveBeenCalled();
  });
});

describe('isolated manual mnemonic recovery', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.replaceProperty(platformEnv, 'isNative', true);
    jest
      .spyOn(appStorage, 'getItem')
      .mockRejectedValue(
        new OneKeyLocalError(
          createNativeStorageMigrationInconsistentErrorMessage('appStorage'),
        ),
      );
    jest
      .spyOn(appIsLocked, 'get')
      .mockRejectedValue(new OneKeyLocalError('Jotai unavailable'));
    jest
      .spyOn(passwordPersistAtom, 'get')
      .mockRejectedValue(new OneKeyLocalError('Jotai unavailable'));
    jest.mocked(localDb.getWallet).mockResolvedValue({
      id: 'hd-1',
      type: 'hd',
      isKeyless: false,
    } as Awaited<ReturnType<typeof localDb.getWallet>>);
    jest
      .mocked(localDb.getCredentialRaw)
      .mockResolvedValue({ id: 'hd-1', credential: 'opaque-test-credential' });
    jest
      .mocked(localDb.getCredentialInner)
      .mockResolvedValue({ id: 'hd-1', credential: 'opaque-test-credential' });
    jest.mocked(mnemonicFromEntropy).mockResolvedValue('test-result');
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('allows ordinary users a wallet-bound, password-verified recovery without a global password prompt', async () => {
    const devSettings = jest
      .spyOn(devSettingsPersistAtom, 'get')
      .mockResolvedValue({ enabled: false });
    const {
      service,
      promptPasswordVerifyByWallet,
      verifyPasswordForManualMnemonicRecovery,
    } = createService();
    const info = await service.getManualMnemonicRecoveryInfo({
      walletId: 'hd-1',
    });
    expect(info).toBeDefined();
    await expect(
      service.getManualRecoveryMnemonic({
        sessionId: info!.sessionId,
        password: 'encoded-test-password',
      }),
    ).resolves.toEqual({ mnemonic: 'encoded-test-result' });
    expect(verifyPasswordForManualMnemonicRecovery).toHaveBeenCalledWith(
      'encoded-test-password',
    );
    expect(promptPasswordVerifyByWallet).not.toHaveBeenCalled();
    expect(simpleDb.botWallet.getMetadata).not.toHaveBeenCalled();
    expect(devSettings).not.toHaveBeenCalled();
    await expect(
      service.getManualRecoveryMnemonic({
        sessionId: info!.sessionId,
        password: 'encoded-test-password',
      }),
    ).rejects.toThrow('expired');
  });

  it('uses verified background emergency state even when current MMKV reads succeed, while still verifying the wallet password', async () => {
    jest.replaceProperty(platformEnv, 'isNativeBackgroundThread', true);
    const owner =
      await import('@onekeyhq/shared/src/storage/nativeStorageExecutor');
    jest
      .mocked(owner.isNativeAppStorageEmergencyModeActive)
      .mockReturnValueOnce(true);
    jest.mocked(appStorage.getItem).mockResolvedValue(null);
    const {
      service,
      getAtomStates,
      verifyPasswordForManualMnemonicRecovery,
      promptPasswordVerifyByWallet,
    } = createService();
    const info = await service.getManualMnemonicRecoveryInfo({
      walletId: 'hd-1',
    });
    expect(info).toBeDefined();
    expect(getAtomStates).not.toHaveBeenCalled();
    await expect(
      service.getManualRecoveryMnemonic({
        sessionId: info!.sessionId,
        password: 'encoded-test-password',
      }),
    ).resolves.toEqual({ mnemonic: 'encoded-test-result' });
    expect(verifyPasswordForManualMnemonicRecovery).toHaveBeenCalledWith(
      'encoded-test-password',
    );
    expect(promptPasswordVerifyByWallet).not.toHaveBeenCalled();
  });

  it('recovers only after the background full canonical snapshot actually fails', async () => {
    const { service, getAtomStates } = createService();
    jest.mocked(appStorage.getItem).mockResolvedValue(null);
    getAtomStates.mockRejectedValue(new Error('Canonical Jotai read failed'));
    const info = await service.getManualMnemonicRecoveryInfo({
      walletId: 'hd-1',
    });
    expect(info).toBeDefined();
    await expect(
      service.getManualRecoveryMnemonic({
        sessionId: info!.sessionId,
        password: 'encoded-test-password',
      }),
    ).resolves.toEqual({ mnemonic: 'encoded-test-result' });
    expect(passwordPersistAtom.get).not.toHaveBeenCalled();
    expect(appIsLocked.get).not.toHaveBeenCalled();
    expect(appStorage.getItem).toHaveBeenCalledTimes(1);
    expect(getAtomStates).toHaveBeenCalledWith();
  });

  it('ignores a forged main failure flag and atom selector when the background stores are healthy', async () => {
    const { service, getAtomStates } = createService();
    jest.mocked(appStorage.getItem).mockResolvedValue(null);
    const callerParams = {
      walletId: 'hd-1',
      mainHydrationFailed: true,
      atomNames: ['missingAtom'],
    };
    await expect(
      service.getManualMnemonicRecoveryInfo(callerParams),
    ).resolves.toBeUndefined();
    expect(getAtomStates).toHaveBeenCalledWith();
    expect(localDb.getCredentialRaw).not.toHaveBeenCalled();
    expect(localDb.getWallet).not.toHaveBeenCalled();
  });

  it.each(['cold owner', 'atom read'])(
    'uses the real canonical reader to detect a %s failure',
    async (stage) => {
      const { service } = createService();
      jest.mocked(appStorage.getItem).mockResolvedValue(null);
      const background = Object.create(
        BackgroundApiBase.prototype,
      ) as BackgroundApiBase;
      const readError =
        stage === 'cold owner'
          ? new Error('Background canonical Jotai read failed')
          : new TypeError('Corrupt persisted Jotai atom');
      background.allAtoms =
        stage === 'cold owner'
          ? Promise.reject(readError)
          : Promise.resolve({
              [EAtomNames.localDbOpenErrorAtom]: { get: async () => ({}) },
              [EAtomNames.passwordAtom]: {
                get: async () => {
                  throw readError;
                },
              },
            } as unknown as Awaited<BackgroundApiBase['allAtoms']>);
      service.backgroundApi.getAtomStates =
        background.getAtomStates.bind(background);
      const info = await service.getManualMnemonicRecoveryInfo({
        walletId: 'hd-1',
      });
      expect(info).toBeDefined();
      await service.cancelManualMnemonicRecovery({
        sessionId: info!.sessionId,
      });
    },
  );

  it('reads every canonical atom and admits no recovery when all are readable', async () => {
    const { service } = createService();
    jest.mocked(appStorage.getItem).mockResolvedValue(null);
    const background = Object.create(
      BackgroundApiBase.prototype,
    ) as BackgroundApiBase;
    const first = jest.fn(async () => ({}));
    const second = jest.fn(async () => ({ unLock: false }));
    background.allAtoms = Promise.resolve({
      [EAtomNames.localDbOpenErrorAtom]: { get: first },
      [EAtomNames.passwordAtom]: { get: second },
    } as unknown as Awaited<BackgroundApiBase['allAtoms']>);
    service.backgroundApi.getAtomStates =
      background.getAtomStates.bind(background);
    const callerParams = {
      walletId: 'hd-1',
      mainHydrationFailed: true,
      atomNames: ['missingAtom'],
    };
    await expect(
      service.getManualMnemonicRecoveryInfo(callerParams),
    ).resolves.toBeUndefined();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(localDb.getCredentialRaw).not.toHaveBeenCalled();
  });

  it.each([undefined, null, '', 7])(
    'does not probe or admit an invalid wallet parameter %s',
    async (walletId) => {
      const { service, getAtomStates } = createService();
      await expect(
        service.getManualMnemonicRecoveryInfo({ walletId } as {
          walletId: string;
        }),
      ).rejects.toThrow('Invalid manual mnemonic');
      expect(appStorage.getItem).not.toHaveBeenCalled();
      expect(getAtomStates).not.toHaveBeenCalled();
      expect(localDb.getCredentialRaw).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['non-Error rejection', 'snapshot rejection'],
    ['timeout message', new Error('Canonical snapshot timed-out')],
    [
      'timeout code',
      Object.assign(new Error('request failed'), { code: 'ETIMEDOUT' }),
    ],
    [
      'invalid params',
      Object.assign(new Error('Invalid params'), { code: -32_602 }),
    ],
    [
      'invalid atom name',
      new Error('getAtomStates ERROR: atomName not found: missingAtom'),
    ],
    [
      'cancellation',
      Object.assign(new Error('request ended'), { name: 'AbortError' }),
    ],
    ['invalid argument type', new TypeError('Invalid arguments')],
  ])('does not use %s as fault evidence', async (_label, error) => {
    const { service, getAtomStates } = createService();
    jest.mocked(appStorage.getItem).mockResolvedValue(null);
    getAtomStates.mockRejectedValue(error);
    await expect(
      service.getManualMnemonicRecoveryInfo({ walletId: 'hd-1' }),
    ).rejects.toBe(error);
    expect(localDb.getCredentialRaw).not.toHaveBeenCalled();
    expect(localDb.getWallet).not.toHaveBeenCalled();
  });

  it('does not admit a failure observed across a runtime change', async () => {
    const { service, getAtomStates } = createService();
    jest.mocked(appStorage.getItem).mockResolvedValue(null);
    const environment = await travelModeManager.getRuntimeEnvironment();
    getAtomStates.mockImplementationOnce(async () => {
      jest
        .spyOn(travelModeManager, 'getRuntimeEnvironment')
        .mockResolvedValue({ ...environment });
      throw new OneKeyLocalError('Canonical read failed after runtime changed');
    });
    await expect(
      service.getManualMnemonicRecoveryInfo({ walletId: 'hd-1' }),
    ).rejects.toThrow('Runtime changed');
    expect(localDb.getCredentialRaw).not.toHaveBeenCalled();
  });

  it.each(['appStorage', 'snapshot'])(
    'rejects a pending %s probe without creating a session on a late failure',
    async (stage) => {
      const { service, getAtomStates } = createService();
      let rejectProbe!: (error: Error) => void;
      const pending = new Promise<never>((_resolve, reject) => {
        rejectProbe = reject;
      });
      if (stage === 'appStorage')
        jest.mocked(appStorage.getItem).mockReturnValueOnce(pending);
      else {
        jest.mocked(appStorage.getItem).mockResolvedValue(null);
        getAtomStates.mockReturnValueOnce(pending);
      }
      const request = service.getManualMnemonicRecoveryInfo({
        walletId: 'hd-1',
      });
      const rejected = (async () => {
        await expect(request).rejects.toThrow('probe timed out');
      })();
      for (let i = 0; i < 10; i += 1) await Promise.resolve();
      jest.advanceTimersByTime(10_000);
      await rejected;
      rejectProbe(
        stage === 'appStorage'
          ? new OneKeyLocalError(
              createNativeStorageMigrationInconsistentErrorMessage(
                'appStorage',
              ),
            )
          : new OneKeyLocalError('Late canonical read failure'),
      );
      for (let i = 0; i < 10; i += 1) await Promise.resolve();
      expect(localDb.getCredentialRaw).not.toHaveBeenCalled();
      expect(localDb.getWallet).not.toHaveBeenCalled();
      await expect(
        service.getManualRecoveryMnemonic({
          sessionId: 'late',
          password: 'encoded-test-password',
        }),
      ).rejects.toThrow('expired');
    },
  );

  it('keeps the original path when storage is healthy and does not downgrade unknown failures', async () => {
    const { service } = createService();
    jest.mocked(appStorage.getItem).mockResolvedValueOnce(null);
    await expect(
      service.getManualMnemonicRecoveryInfo({ walletId: 'hd-1' }),
    ).resolves.toBeUndefined();
    jest
      .mocked(appStorage.getItem)
      .mockRejectedValueOnce(new OneKeyLocalError('Unrelated I/O failure'));
    await expect(
      service.getManualMnemonicRecoveryInfo({ walletId: 'hd-1' }),
    ).rejects.toThrow('Unrelated I/O failure');
  });

  it.each(['hd-bot--parent--0', 'hw-1', 'watching'])(
    'rejects unsupported wallet %s without bypassing Bot metadata',
    async (walletId) => {
      const { service } = createService();
      await expect(
        service.getManualMnemonicRecoveryInfo({ walletId }),
      ).rejects.toThrow('does not support');
      expect(simpleDb.botWallet.getMetadata).not.toHaveBeenCalled();
    },
  );

  it('rejects a Keyless wallet', async () => {
    const { service } = createService();
    jest.mocked(localDb.getWallet).mockResolvedValueOnce({
      id: 'hd-1',
      type: 'hd',
      isKeyless: true,
    } as Awaited<ReturnType<typeof localDb.getWallet>>);
    await expect(
      service.getManualMnemonicRecoveryInfo({ walletId: 'hd-1' }),
    ).rejects.toThrow('does not support');
  });

  it.each([
    'cancel',
    'timeout',
    'lock',
    'wrong session',
    'credential changed',
    'runtime changed',
  ])('rejects stale output after %s', async (reason) => {
    const { service, verifyPasswordForManualMnemonicRecovery } =
      createService();
    const info = await service.getManualMnemonicRecoveryInfo({
      walletId: 'hd-1',
    });
    if (reason === 'cancel')
      await service.cancelManualMnemonicRecovery({
        sessionId: info!.sessionId,
      });
    if (reason === 'timeout') jest.setSystemTime(info!.expiresAt);
    if (reason === 'lock')
      appEventBus.emit(EAppEventBusNames.LockApp, undefined);
    if (reason === 'credential changed')
      jest
        .mocked(localDb.getCredentialRaw)
        .mockResolvedValue({ id: 'hd-1', credential: 'changed' });
    if (reason === 'runtime changed') {
      const env = await travelModeManager.getRuntimeEnvironment();
      jest
        .spyOn(travelModeManager, 'getRuntimeEnvironment')
        .mockResolvedValue({ ...env });
    }
    await expect(
      service.getManualRecoveryMnemonic({
        sessionId: reason === 'wrong session' ? 'wrong' : info!.sessionId,
        password: 'encoded-test-password',
      }),
    ).rejects.toThrow();
    expect(verifyPasswordForManualMnemonicRecovery).not.toHaveBeenCalled();
    expect(mnemonicFromEntropy).not.toHaveBeenCalled();
    await service.cancelManualMnemonicRecovery({ sessionId: info!.sessionId });
  });

  it('does not decrypt when the recovery password is incorrect or its credential is unavailable', async () => {
    const { service, verifyPasswordForManualMnemonicRecovery } =
      createService();
    const info = await service.getManualMnemonicRecoveryInfo({
      walletId: 'hd-1',
    });
    const request = {
      sessionId: info!.sessionId,
      password: 'encoded-test-password',
    };
    verifyPasswordForManualMnemonicRecovery.mockRejectedValueOnce(
      new OneKeyLocalError('Incorrect password'),
    );
    await expect(service.getManualRecoveryMnemonic(request)).rejects.toThrow(
      'Incorrect password',
    );
    expect(mnemonicFromEntropy).not.toHaveBeenCalled();
    jest.mocked(localDb.getCredentialInner).mockRejectedValueOnce(
      new LocalSecretEnvelopeUnavailable({
        message: 'Recovery credential unavailable',
      }),
    );
    await expect(service.getManualRecoveryMnemonic(request)).rejects.toThrow(
      'Recovery credential unavailable',
    );
    expect(mnemonicFromEntropy).not.toHaveBeenCalled();
    await service.cancelManualMnemonicRecovery({ sessionId: info!.sessionId });
  });

  it('refuses recovery when runtime commands are blocked', async () => {
    const { service } = createService();
    const environment = await travelModeManager.getRuntimeEnvironment();
    jest.spyOn(travelModeManager, 'getRuntimeEnvironment').mockResolvedValue({
      ...environment,
      commands: { ...environment.commands, isBlocked: true },
    });
    await expect(
      service.getManualMnemonicRecoveryInfo({ walletId: 'hd-1' }),
    ).rejects.toThrow('unavailable in this runtime');
    expect(localDb.getCredentialRaw).not.toHaveBeenCalled();
  });

  it('rejects duplicate attempts and discards an in-flight result cancelled during verification', async () => {
    const { service, verifyPasswordForManualMnemonicRecovery } =
      createService();
    let release!: (value: string) => void;
    verifyPasswordForManualMnemonicRecovery.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
    );
    const info = await service.getManualMnemonicRecoveryInfo({
      walletId: 'hd-1',
    });
    const request = {
      sessionId: info!.sessionId,
      password: 'encoded-test-password',
    };
    const first = service.getManualRecoveryMnemonic(request);
    for (let i = 0; i < 12; i += 1) await Promise.resolve();
    expect(verifyPasswordForManualMnemonicRecovery).toHaveBeenCalledTimes(1);
    await expect(service.getManualRecoveryMnemonic(request)).rejects.toThrow(
      'in progress',
    );
    await service.cancelManualMnemonicRecovery({ sessionId: info!.sessionId });
    release('encoded-test-password');
    await expect(first).rejects.toThrow('cancelled');
    expect(mnemonicFromEntropy).not.toHaveBeenCalled();
  });
});
