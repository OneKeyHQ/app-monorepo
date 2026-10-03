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

// `connectId` is really the caller's operation handle; the SDK resolves it.
const OPERATION_ID = 'hw-operation-1';

const secureChannelFailure = {
  success: false,
  payload: {
    code: HardwareErrorCode.UnknownError,
    error: 'SecureChannelError',
    _tag: 'SecureChannelError',
  },
};

const codedSecureChannelFailure = {
  success: false,
  payload: {
    code: THIRD_PARTY_HW_SECURE_CHANNEL_ERROR_CODE,
    error: 'Ledger secure channel closed',
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
  return { installApp, listInstalledAppNames };
}

function run(
  deps: ReturnType<typeof makeDeps>,
  params?: Partial<IInstallLedgerCoreAppsParams>,
) {
  return installLedgerCoreApps({
    apps: ['Bitcoin'],
    connectId: OPERATION_ID,
    ...deps,
    ...params,
  });
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

    await expect(run(deps)).resolves.toBeUndefined();

    expect(deps.installApp).toHaveBeenCalledTimes(1);
  });

  it('retries once on the same operation after a secure channel failure', async () => {
    const deps = makeDeps();
    deps.installApp
      .mockResolvedValueOnce(codedSecureChannelFailure)
      .mockResolvedValueOnce({ success: true });

    await expect(run(deps)).resolves.toBeUndefined();

    expect(deps.installApp).toHaveBeenCalledTimes(2);
    // The operation handle the caller still owns must not be swapped out.
    expect(deps.installApp.mock.calls.map(([params]) => params)).toEqual([
      { connectId: OPERATION_ID, appName: 'Bitcoin' },
      { connectId: OPERATION_ID, appName: 'Bitcoin' },
    ]);
  });

  it('also retries when only the legacy DMK tag identifies the secure channel', async () => {
    const deps = makeDeps();
    deps.installApp
      .mockResolvedValueOnce(secureChannelFailure)
      .mockResolvedValueOnce({ success: true });

    await expect(run(deps)).resolves.toBeUndefined();

    expect(deps.installApp).toHaveBeenCalledTimes(2);
  });

  it('gives up after a second secure channel failure on the retry', async () => {
    const deps = makeDeps({
      installApp: async () => codedSecureChannelFailure,
    });

    await expect(run(deps)).rejects.toMatchObject({
      code: THIRD_PARTY_HW_SECURE_CHANNEL_ERROR_CODE,
    });

    expect(deps.installApp).toHaveBeenCalledTimes(2);
  });

  it('spends the one automatic retry across the whole call, not per app', async () => {
    const deps = makeDeps();
    deps.installApp
      .mockResolvedValueOnce(codedSecureChannelFailure)
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce(codedSecureChannelFailure);

    await expect(
      run(deps, { apps: ['Bitcoin', 'Ethereum'] }),
    ).rejects.toMatchObject({
      code: THIRD_PARTY_HW_SECURE_CHANNEL_ERROR_CODE,
    });

    expect(deps.installApp).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['the coded form', metadataFailure],
    ['the legacy tag-only form', legacyMetadataFailure],
  ])(
    'surfaces a metadata failure as a network error without retrying (%s)',
    async (_label, failure) => {
      const deps = makeDeps({ installApp: async () => failure });

      await expect(run(deps)).rejects.toMatchObject({
        code: THIRD_PARTY_HW_NETWORK_ERROR_CODE,
      });

      // Still probed: the install may have landed before the catalog fetch failed.
      expect(deps.listInstalledAppNames).toHaveBeenCalledTimes(1);
      expect(deps.installApp).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ['user reject', HardwareErrorCode.UserRejected],
    ['user abort', HardwareErrorCode.UserAborted],
    ['device disconnect', HardwareErrorCode.DeviceDisconnected],
    ['timeout', HardwareErrorCode.OperationTimeout],
  ])(
    'throws a %s failure without probing or retrying',
    async (_label, code) => {
      const deps = makeDeps({
        installApp: async () => ({
          success: false,
          payload: { code, error: 'terminal' },
        }),
      });

      await expect(run(deps)).rejects.toMatchObject({ code });

      expect(deps.listInstalledAppNames).not.toHaveBeenCalled();
      expect(deps.installApp).toHaveBeenCalledTimes(1);
    },
  );

  it('counts an already-installed app as done and moves to the next one', async () => {
    const deps = makeDeps();
    deps.installApp
      .mockResolvedValueOnce(appAlreadyInstalledFailure)
      .mockResolvedValueOnce({ success: true });

    await expect(
      run(deps, { apps: ['Bitcoin', 'Ethereum'] }),
    ).resolves.toBeUndefined();

    // The device already answered, so the probe never runs.
    expect(deps.listInstalledAppNames).not.toHaveBeenCalled();
    expect(deps.installApp).toHaveBeenCalledTimes(2);
  });

  it('probes after a failed retry too, and takes a landed app as success', async () => {
    const deps = makeDeps();
    deps.installApp
      .mockResolvedValueOnce(codedSecureChannelFailure)
      // The retry wrote the app, then failed fetching the catalog.
      .mockResolvedValueOnce(metadataFailure);
    deps.listInstalledAppNames
      .mockResolvedValueOnce({ success: true, payload: [] })
      .mockResolvedValueOnce({ success: true, payload: ['Bitcoin'] });

    await expect(run(deps)).resolves.toBeUndefined();

    expect(deps.installApp).toHaveBeenCalledTimes(2);
    // Once before the retry, once after it.
    expect(deps.listInstalledAppNames).toHaveBeenCalledTimes(2);
  });

  it('skips the post-retry probe when the retry ended in a terminal answer', async () => {
    const deps = makeDeps();
    deps.installApp
      .mockResolvedValueOnce(codedSecureChannelFailure)
      .mockResolvedValueOnce({
        success: false,
        payload: {
          code: HardwareErrorCode.UserRejected,
          error: 'Rejected on device',
        },
      });

    await expect(run(deps)).rejects.toMatchObject({
      code: HardwareErrorCode.UserRejected,
    });

    expect(deps.listInstalledAppNames).toHaveBeenCalledTimes(1);
  });

  it('accepts an already-installed answer on the retry too', async () => {
    const deps = makeDeps();
    deps.installApp
      .mockResolvedValueOnce(codedSecureChannelFailure)
      .mockResolvedValueOnce(appAlreadyInstalledFailure);

    await expect(run(deps)).resolves.toBeUndefined();
  });

  it('reports queue progress before each app and installs them in order', async () => {
    const onAppStart = jest.fn();
    const deps = makeDeps();

    await run(deps, { apps: ['Bitcoin', 'Ethereum'], onAppStart });

    expect(onAppStart.mock.calls).toEqual([[0], [1]]);
    expect(deps.installApp.mock.calls.map(([params]) => params)).toEqual([
      { connectId: OPERATION_ID, appName: 'Bitcoin' },
      { connectId: OPERATION_ID, appName: 'Ethereum' },
    ]);
  });
});
