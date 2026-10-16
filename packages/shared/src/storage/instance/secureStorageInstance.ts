import { travelModeManager } from '../../travelMode';

import type { ISecureStorage } from '../secureStorage/types';

let realSecureStorageInstance: ISecureStorage | undefined;

function getRealSecureStorageInstance(): ISecureStorage {
  if (!realSecureStorageInstance) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    realSecureStorageInstance = require('../secureStorage')
      .default as ISecureStorage;
  }
  return realSecureStorageInstance;
}

const travelModeSecureStorage: ISecureStorage = {
  async supportSecureStorageWithBiometrics() {
    return travelModeManager.getRuntimeEnvironmentSync().persistence.run({
      operation: async () =>
        (await getRealSecureStorageInstance().supportSecureStorageWithBiometrics?.()) ??
        false,
      onBlocked: () => false,
    });
  },
  async getSecureItemWithBiometrics(key, options) {
    return travelModeManager.getRuntimeEnvironmentSync().persistence.run({
      operation: async () =>
        (await getRealSecureStorageInstance().getSecureItemWithBiometrics?.(
          key,
          options,
        )) ?? null,
      onBlocked: () => null,
    });
  },
  async getSecureItem(key) {
    return travelModeManager.getRuntimeEnvironmentSync().persistence.run({
      operation: () => getRealSecureStorageInstance().getSecureItem(key),
      onBlocked: () => null,
    });
  },
  async setSecureItem(key, data, options) {
    return travelModeManager.getRuntimeEnvironmentSync().persistence.run({
      operation: () =>
        getRealSecureStorageInstance().setSecureItem(key, data, options),
      onBlocked: () => undefined,
    });
  },
  async removeSecureItem(key, options) {
    return travelModeManager.getRuntimeEnvironmentSync().persistence.run({
      operation: () =>
        getRealSecureStorageInstance().removeSecureItem(key, options),
      onBlocked: () => undefined,
    });
  },
  async supportSecureStorage() {
    return travelModeManager.getRuntimeEnvironmentSync().persistence.run({
      operation: () => getRealSecureStorageInstance().supportSecureStorage(),
      onBlocked: () => false,
    });
  },
  async supportSecureStorageWithoutInteraction() {
    return travelModeManager.getRuntimeEnvironmentSync().persistence.run({
      operation: () =>
        getRealSecureStorageInstance().supportSecureStorageWithoutInteraction(),
      onBlocked: () => false,
    });
  },
  async setSecureItemWithBiometrics(key, data, options) {
    return travelModeManager.getRuntimeEnvironmentSync().persistence.run({
      operation: () =>
        getRealSecureStorageInstance().setSecureItemWithBiometrics(
          key,
          data,
          options,
        ),
      onBlocked: () => undefined,
    });
  },
  async hasSecureItem(key) {
    return travelModeManager.getRuntimeEnvironmentSync().persistence.run({
      operation: async () =>
        (await getRealSecureStorageInstance().hasSecureItem?.(key)) ?? false,
      onBlocked: () => false,
    });
  },
  async getCredentialId() {
    return travelModeManager.getRuntimeEnvironmentSync().persistence.run({
      operation: async () =>
        (await getRealSecureStorageInstance().getCredentialId?.()) ?? null,
      onBlocked: () => null,
    });
  },
  async resetForPasskeyReEnroll() {
    return travelModeManager.getRuntimeEnvironmentSync().persistence.run({
      operation: () =>
        getRealSecureStorageInstance().resetForPasskeyReEnroll?.() ??
        Promise.resolve(),
      onBlocked: () => undefined,
    });
  },
  async snapshotForPasskeyReEnroll() {
    return travelModeManager.getRuntimeEnvironmentSync().persistence.run({
      operation: async () =>
        (await getRealSecureStorageInstance().snapshotForPasskeyReEnroll?.()) ??
        [],
      onBlocked: () => [],
    });
  },
  async restoreForPasskeyReEnroll(snapshot) {
    return travelModeManager.getRuntimeEnvironmentSync().persistence.run({
      operation: () =>
        getRealSecureStorageInstance().restoreForPasskeyReEnroll?.(snapshot) ??
        Promise.resolve(),
      onBlocked: () => undefined,
    });
  },
};

export default travelModeSecureStorage;
