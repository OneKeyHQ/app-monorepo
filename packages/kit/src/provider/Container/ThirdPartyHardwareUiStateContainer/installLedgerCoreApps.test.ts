import { HardwareErrorCode } from '@onekeyfe/hwk-adapter-core';

import {
  THIRD_PARTY_HW_APP_ALREADY_INSTALLED_CODE,
  THIRD_PARTY_HW_FIRMWARE_METADATA_ERROR_CODE,
  THIRD_PARTY_HW_NETWORK_ERROR_CODE,
  THIRD_PARTY_HW_SECURE_CHANNEL_ERROR_CODE,
} from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';

import { installLedgerCoreApps } from './installLedgerCoreApps';

import type { IInstallLedgerCoreAppsParams } from './installLedgerCoreApps';

type IInstallAppFn = IInstallLedgerCoreAppsParams['installApp'];
type IListInstalledAppNamesFn =
  IInstallLedgerCoreAppsParams['listInstalledAppNames'];
type IRecoverSessionFn = IInstallLedgerCoreAppsParams['recoverSession'];

const secureChannelFailure = {
  success: false,
  payload: {
    code: HardwareErrorCode.UnknownError,
    error: 'SecureChannelError',
    _tag: 'SecureChannelError',
  },
};

// The SDK build that mints 10312 codes it directly; older builds only tag it.
const metadataFailure = {
  success: false,
  payload: {
    code: THIRD_PARTY_HW_FIRMWARE_METADATA_ERROR_CODE,
    error: 'GetApplicationsMetadataTaskError',
    _tag: 'GetApplicationsMetadataTaskError',
  },
};

const legacyMetadataFailure = {
  success: false,
  payload: {
    code: HardwareErrorCode.UnknownError,
    error: 'InvalidGetFirmwareMetadataResponseError',
    _tag: 'InvalidGetFirmwareMetadataResponseError',
  },
};

const codedSecureChannelFailure = {
  success: false,
  payload: {
    code: THIRD_PARTY_HW_SECURE_CHANNEL_ERROR_CODE,
    error: 'Ledger secure channel closed',
  },
};

const appAlreadyInstalledFailure = {
  success: false,
  payload: {
    code: THIRD_PARTY_HW_APP_ALREADY_INSTALLED_CODE,
    error: 'AppAlreadyInstalledDAError',
  },
};

function makeDeps(impls?: {
  installApp?: IInstallAppFn;
  listInstalledAppNames?: IListInstalledAppNamesFn;
  recoverSession?: IRecoverSessionFn;
}) {
  const installApp = jest.fn<
    ReturnType<IInstallAppFn>,
    Parameters<IInstallAppFn>
  >(impls?.installApp ?? (async () => ({ success: true })));
  const listInstalledAppNames = jest.fn<
    ReturnType<IListInstalledAppNamesFn>,
    Parameters<IListInstalledAppNamesFn>
  >(
    impls?.listInstalledAppNames ??
      (async () => ({ success: true, payload: [] })),
  );
  const recoverSession = jest.fn<
    ReturnType<IRecoverSessionFn>,
    Parameters<IRecoverSessionFn>
  >(impls?.recoverSession ?? (async () => ({ ok: false })));
  return { installApp, listInstalledAppNames, recoverSession };
}

describe('installLedgerCoreApps', () => {
  it('treats a failed install as done when the probe finds the app on the device', async () => {
    const deps = makeDeps({
      installApp: async () => secureChannelFailure,
      listInstalledAppNames: async () => ({
        success: true,
        payload: ['Bitcoin'],
      }),
    });

    await expect(
      installLedgerCoreApps({
        apps: ['Bitcoin'],
        connectId: 'ledger',
        ...deps,
      }),
    ).resolves.toBeUndefined();

    expect(deps.installApp).toHaveBeenCalledTimes(1);
    expect(deps.recoverSession).not.toHaveBeenCalled();
  });

  it('rebuilds the session once on a secure channel failure and retries the app', async () => {
    const deps = makeDeps({
      recoverSession: async () => ({
        ok: true,
        connectId: 'ledger-new',
        installedApps: [],
      }),
    });
    deps.installApp
      .mockResolvedValueOnce(secureChannelFailure)
      .mockResolvedValueOnce({ success: true });

    await expect(
      installLedgerCoreApps({
        apps: ['Bitcoin'],
        connectId: 'ledger',
        ...deps,
      }),
    ).resolves.toBeUndefined();

    expect(deps.recoverSession).toHaveBeenCalledWith({ connectId: 'ledger' });
    expect(deps.installApp).toHaveBeenCalledTimes(2);
    // The retry follows the locator the rebuilt session reported.
    expect(deps.installApp).toHaveBeenLastCalledWith({
      connectId: 'ledger-new',
      appName: 'Bitcoin',
    });
  });

  it('skips the retry when the rebuilt session already reports the app installed', async () => {
    const deps = makeDeps({
      installApp: async () => secureChannelFailure,
      recoverSession: async () => ({
        ok: true,
        connectId: 'ledger-new',
        installedApps: ['Bitcoin'],
      }),
    });

    await expect(
      installLedgerCoreApps({
        apps: ['Bitcoin'],
        connectId: 'ledger',
        ...deps,
      }),
    ).resolves.toBeUndefined();

    expect(deps.installApp).toHaveBeenCalledTimes(1);
  });

  it('spends the one automatic retry across the whole call, not per app', async () => {
    const deps = makeDeps({
      recoverSession: async () => ({
        ok: true,
        connectId: 'ledger',
        installedApps: [],
      }),
    });
    deps.installApp
      .mockResolvedValueOnce(secureChannelFailure)
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce(secureChannelFailure);

    await expect(
      installLedgerCoreApps({
        apps: ['Bitcoin', 'Ethereum'],
        connectId: 'ledger',
        ...deps,
      }),
    ).rejects.toMatchObject({ code: THIRD_PARTY_HW_SECURE_CHANNEL_ERROR_CODE });

    expect(deps.recoverSession).toHaveBeenCalledTimes(1);
    expect(deps.installApp).toHaveBeenCalledTimes(3);
  });

  it('surfaces a metadata failure as a network error without any auto retry', async () => {
    const deps = makeDeps({ installApp: async () => metadataFailure });

    await expect(
      installLedgerCoreApps({
        apps: ['Bitcoin'],
        connectId: 'ledger',
        ...deps,
      }),
    ).rejects.toMatchObject({ code: THIRD_PARTY_HW_NETWORK_ERROR_CODE });

    expect(deps.recoverSession).not.toHaveBeenCalled();
    expect(deps.installApp).toHaveBeenCalledTimes(1);
  });

  it('throws the original failure when the session rebuild itself fails', async () => {
    const deps = makeDeps({
      installApp: async () => secureChannelFailure,
      recoverSession: async () => ({ ok: false }),
    });

    await expect(
      installLedgerCoreApps({
        apps: ['Bitcoin'],
        connectId: 'ledger',
        ...deps,
      }),
    ).rejects.toMatchObject({ code: THIRD_PARTY_HW_SECURE_CHANNEL_ERROR_CODE });

    expect(deps.recoverSession).toHaveBeenCalledTimes(1);
  });

  it('never auto-recovers a user cancel', async () => {
    const deps = makeDeps({
      installApp: async () => ({
        success: false,
        payload: {
          code: HardwareErrorCode.UserRejected,
          error: 'Rejected on device',
        },
      }),
    });

    await expect(
      installLedgerCoreApps({
        apps: ['Bitcoin'],
        connectId: 'ledger',
        ...deps,
      }),
    ).rejects.toMatchObject({ code: HardwareErrorCode.UserRejected });

    expect(deps.recoverSession).not.toHaveBeenCalled();
  });

  it('rebuilds the session on the SDK secure channel code, without the DMK tag', async () => {
    const deps = makeDeps({
      recoverSession: async () => ({
        ok: true,
        connectId: 'ledger-new',
        installedApps: [],
      }),
    });
    deps.installApp
      .mockResolvedValueOnce(codedSecureChannelFailure)
      .mockResolvedValueOnce({ success: true });

    await expect(
      installLedgerCoreApps({
        apps: ['Bitcoin'],
        connectId: 'ledger',
        ...deps,
      }),
    ).resolves.toBeUndefined();

    expect(deps.recoverSession).toHaveBeenCalledTimes(1);
    expect(deps.installApp).toHaveBeenCalledTimes(2);
  });

  it('counts an already-installed app as done and moves to the next one', async () => {
    const deps = makeDeps();
    deps.installApp
      .mockResolvedValueOnce(appAlreadyInstalledFailure)
      .mockResolvedValueOnce({ success: true });

    await expect(
      installLedgerCoreApps({
        apps: ['Bitcoin', 'Ethereum'],
        connectId: 'ledger',
        ...deps,
      }),
    ).resolves.toBeUndefined();

    // The device already answered, so neither the probe nor a rebuild runs.
    expect(deps.listInstalledAppNames).not.toHaveBeenCalled();
    expect(deps.recoverSession).not.toHaveBeenCalled();
    expect(deps.installApp).toHaveBeenCalledTimes(2);
  });

  it('accepts an already-installed answer on the post-recovery retry too', async () => {
    const deps = makeDeps({
      recoverSession: async () => ({
        ok: true,
        connectId: 'ledger-new',
        installedApps: [],
      }),
    });
    deps.installApp
      .mockResolvedValueOnce(codedSecureChannelFailure)
      .mockResolvedValueOnce(appAlreadyInstalledFailure);

    await expect(
      installLedgerCoreApps({
        apps: ['Bitcoin'],
        connectId: 'ledger',
        ...deps,
      }),
    ).resolves.toBeUndefined();
  });

  it('surfaces a legacy tag-only metadata failure as a network error as well', async () => {
    const deps = makeDeps({ installApp: async () => legacyMetadataFailure });

    await expect(
      installLedgerCoreApps({
        apps: ['Bitcoin'],
        connectId: 'ledger',
        ...deps,
      }),
    ).rejects.toMatchObject({ code: THIRD_PARTY_HW_NETWORK_ERROR_CODE });

    expect(deps.recoverSession).not.toHaveBeenCalled();
  });

  it('reports queue progress before each app and installs them in order', async () => {
    const onAppStart = jest.fn();
    const deps = makeDeps();

    await installLedgerCoreApps({
      apps: ['Bitcoin', 'Ethereum'],
      connectId: 'ledger',
      onAppStart,
      ...deps,
    });

    expect(onAppStart.mock.calls).toEqual([[0], [1]]);
    expect(deps.installApp.mock.calls.map(([params]) => params)).toEqual([
      { connectId: 'ledger', appName: 'Bitcoin' },
      { connectId: 'ledger', appName: 'Ethereum' },
    ]);
  });
});
