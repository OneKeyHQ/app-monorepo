import {
  HardwareErrorCode,
  failure,
  success,
} from '@onekeyfe/hwk-adapter-core';

import { LEDGER_CONFIG } from '@onekeyhq/shared/src/hardware/config/ledger';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import localDb from '../../dbs/local/localDb';

import {
  callLedgerWithFingerprint,
  verifySeedMatch,
} from './ledgerFingerprintUtils';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    updateDeviceChainFingerprint: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    hardware: {
      sdkLog: {
        log: jest.fn(),
      },
    },
  },
}));

type ILedgerDbDevice = Parameters<typeof callLedgerWithFingerprint>[1];
const ledgerConfig = LEDGER_CONFIG;

function buildDevice(id: string): ILedgerDbDevice {
  return {
    id,
    connectId: '',
    deviceId: '',
    settingsRaw: '{}',
    vendor: EHardwareVendor.ledger,
  };
}

describe('callLedgerWithFingerprint', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([false, true])(
    'defaults to recording only the requested chain (hasOtherFingerprint=%s)',
    async (hasOtherFingerprint) => {
      expect(ledgerConfig.enableCrossChainFingerprintVerification).toBe(false);
      const operationId = 'hwk-ledger-default-bootstrap';
      const connectDevice = jest
        .fn()
        .mockResolvedValue(success({ operationId }));
      const releaseOperation = jest.fn().mockResolvedValue(undefined);
      const getChainFingerprint = jest
        .fn()
        .mockResolvedValue(success('first-btc'));
      const backgroundApi = {
        serviceThirdPartyHardware: {
          getAdapterForVendor: jest.fn().mockResolvedValue({
            connectDevice,
            releaseOperation,
            hw: { getChainFingerprint },
          }),
        },
      };
      const device = {
        ...buildDevice(`default-btc-${hasOtherFingerprint}`),
        settingsRaw: JSON.stringify({
          chainFingerprints: hasOtherFingerprint ? { evm: 'stored-evm' } : {},
        }),
      };
      const fn = jest
        .fn()
        .mockResolvedValue(success({ address: 'synthetic-btc' }));

      const result = await callLedgerWithFingerprint(
        backgroundApi as unknown as IBackgroundApi,
        device,
        'btc',
        fn,
      );

      expect(result.success).toBe(true);
      expect(connectDevice).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('', operationId, expect.any(Object));
      expect(getChainFingerprint).toHaveBeenCalledTimes(2);
      expect(getChainFingerprint).toHaveBeenCalledWith(operationId, '', 'btc');
      expect(getChainFingerprint).toHaveBeenLastCalledWith(
        operationId,
        'first-btc',
        'btc',
      );
      expect(
        jest
          .mocked(localDb)
          .updateDeviceChainFingerprint.mock.invocationCallOrder.at(-1),
      ).toBeLessThan(getChainFingerprint.mock.invocationCallOrder[1]);
      expect(fn.mock.invocationCallOrder[0]).toBeLessThan(
        getChainFingerprint.mock.invocationCallOrder[0],
      );
      expect(
        jest.mocked(localDb).updateDeviceChainFingerprint?.mock.calls,
      ).toContainEqual([
        {
          dbDeviceId: device.id,
          chain: 'btc',
          fingerprint: 'first-btc',
        },
      ]);
      expect(releaseOperation).toHaveBeenCalledWith(operationId);
    },
  );

  it.each([false, true])(
    'still forwards the stored target-chain fingerprint when cross-chain verification is %s',
    async (enabled) => {
      jest.replaceProperty(
        ledgerConfig,
        'enableCrossChainFingerprintVerification',
        enabled,
      );
      const backgroundApi = {
        serviceThirdPartyHardware: { getAdapterForVendor: jest.fn() },
      };
      const failureResult = {
        success: false as const,
        payload: {
          code: HardwareErrorCode.DeviceMismatch,
          error: 'synthetic mismatch',
        },
      };
      const fn = jest.fn().mockResolvedValue(failureResult);
      const device = {
        ...buildDevice(`stored-btc-${enabled}`),
        settingsRaw: JSON.stringify({
          chainFingerprints: { btc: 'stored-btc' },
        }),
      };
      const result = await callLedgerWithFingerprint(
        backgroundApi as unknown as IBackgroundApi,
        device,
        'btc',
        fn,
        { operationId: 'hwk-ledger-stored' },
      );
      expect(result).toBe(failureResult);
      expect(fn).toHaveBeenCalledWith(
        'stored-btc',
        'hwk-ledger-stored',
        expect.any(Object),
      );
      expect(
        backgroundApi.serviceThirdPartyHardware.getAdapterForVendor,
      ).not.toHaveBeenCalled();
    },
  );

  it('still fails when first target-chain fingerprint generation fails with the flag off', async () => {
    const getChainFingerprint = jest.fn().mockResolvedValue(success(''));
    const backgroundApi = {
      serviceThirdPartyHardware: {
        getAdapterForVendor: jest
          .fn()
          .mockResolvedValue({ hw: { getChainFingerprint } }),
      },
    };
    const fn = jest
      .fn()
      .mockResolvedValue(success({ address: 'synthetic-btc' }));
    const result = await callLedgerWithFingerprint(
      backgroundApi as unknown as IBackgroundApi,
      buildDevice('default-btc-generation-failure'),
      'btc',
      fn,
      { operationId: 'hwk-ledger-generation-failure' },
    );
    expect(fn).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.payload.code).toBe(HardwareErrorCode.DeviceMismatch);
  });

  it.each([
    { mismatch: false, bleConnectId: undefined },
    { mismatch: true, bleConnectId: undefined },
    { mismatch: false, bleConnectId: 'stored-ble-target' },
    { mismatch: true, bleConnectId: 'stored-ble-target' },
  ])(
    'pins cross-chain bootstrap and releases it (mismatch=$mismatch, BLE=$bleConnectId)',
    async ({ mismatch, bleConnectId }) => {
      jest.replaceProperty(
        ledgerConfig,
        'enableCrossChainFingerprintVerification',
        true,
      );
      const operationId = 'hwk-ledger-usb-bootstrap';
      const connectDevice = jest
        .fn()
        .mockResolvedValue({ success: true, payload: { operationId } });
      const releaseOperation = jest.fn().mockResolvedValue(undefined);
      const evmFingerprint = mismatch ? 'wrong-fingerprint' : 'stored-evm';
      const getChainFingerprint = jest.fn(
        (_target: string, _deviceId: string, chain: string) =>
          Promise.resolve(
            success(chain === 'evm' ? evmFingerprint : 'new-sol'),
          ),
      );
      const backgroundApi = {
        serviceThirdPartyHardware: {
          getAdapterForVendor: jest.fn().mockResolvedValue({
            connectDevice,
            releaseOperation,
            hw: { getChainFingerprint },
          }),
        },
      };
      const fn = jest
        .fn()
        .mockResolvedValue(success({ address: 'synthetic-sol-address' }));
      const device = {
        ...buildDevice(
          `cross-chain-${String(mismatch)}-${bleConnectId ?? 'usb'}`,
        ),
        bleConnectId,
        settingsRaw: JSON.stringify({
          chainFingerprints: { evm: 'stored-evm' },
        }),
      };
      const result = await callLedgerWithFingerprint(
        backgroundApi as unknown as IBackgroundApi,
        device,
        'sol',
        fn,
        { allowFingerprintBootstrap: false },
      );
      expect(result.success).toBe(!mismatch);
      expect(connectDevice).toHaveBeenCalledWith(
        '',
        expect.objectContaining({
          knownConnections: bleConnectId
            ? [{ transport: 'ble', connectId: bleConnectId }]
            : [],
          extra: { dbDeviceId: device.id },
        }),
      );
      expect(releaseOperation).toHaveBeenCalledWith(operationId);
      expect(getChainFingerprint).toHaveBeenNthCalledWith(
        1,
        operationId,
        'stored-evm',
        'evm',
      );
      if (mismatch) expect(fn).not.toHaveBeenCalled();
      else {
        expect(fn).toHaveBeenCalledWith('', operationId, expect.any(Object));
        expect(getChainFingerprint).toHaveBeenNthCalledWith(
          2,
          operationId,
          '',
          'sol',
        );
      }
    },
  );

  it('fails before a signing call when the wallet has no trusted fingerprint', async () => {
    jest.replaceProperty(
      ledgerConfig,
      'enableCrossChainFingerprintVerification',
      true,
    );
    const fn = jest.fn();
    const backgroundApi = {
      serviceThirdPartyHardware: {
        getAdapterForVendor: jest.fn(),
      },
    };

    const result = await callLedgerWithFingerprint(
      backgroundApi as unknown as IBackgroundApi,
      buildDevice('ledger-sign-without-fingerprint'),
      'evm',
      fn,
      {
        operationId: 'hwk-ledger-sign',
      },
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.payload.code).toBe(HardwareErrorCode.DeviceMismatch);
    }
    expect(fn).not.toHaveBeenCalled();
    expect(
      backgroundApi.serviceThirdPartyHardware.getAdapterForVendor,
    ).not.toHaveBeenCalled();
  });

  it('keeps bootstrap success when the binding confirmation cannot complete', async () => {
    // The user already approved this on the device and the anchor is persisted
    // before the confirmation runs. A confirmation round trip that fails to
    // complete says nothing about which device answered, so discarding the
    // result here would throw away a signature over a bookkeeping call.
    const getChainFingerprint = jest
      .fn()
      .mockResolvedValueOnce(success('new-evm-fingerprint'))
      .mockResolvedValueOnce(
        failure(HardwareErrorCode.DeviceDisconnected, 'Disconnected'),
      );
    const backgroundApi = {
      serviceThirdPartyHardware: {
        getAdapterForVendor: jest
          .fn()
          .mockResolvedValue({ hw: { getChainFingerprint } }),
      },
    };
    const result = await callLedgerWithFingerprint(
      backgroundApi as unknown as IBackgroundApi,
      buildDevice('ledger-confirmation-failure'),
      'evm',
      jest.fn().mockResolvedValue(success({ address: 'synthetic-address' })),
      {
        operationId: 'hwk-ledger-confirmation-failure',
        allowFingerprintBootstrap: true,
      },
    );
    expect(result).toMatchObject({
      success: true,
      payload: { address: 'synthetic-address' },
    });
    expect(getChainFingerprint).toHaveBeenLastCalledWith(
      'hwk-ledger-confirmation-failure',
      'new-evm-fingerprint',
      'evm',
    );
  });

  it('rejects bootstrap success when the binding confirmation names another device', async () => {
    const getChainFingerprint = jest
      .fn()
      .mockResolvedValueOnce(success('new-evm-fingerprint'))
      .mockResolvedValueOnce(
        failure(HardwareErrorCode.DeviceMismatch, 'Different device'),
      );
    const backgroundApi = {
      serviceThirdPartyHardware: {
        getAdapterForVendor: jest
          .fn()
          .mockResolvedValue({ hw: { getChainFingerprint } }),
      },
    };
    const result = await callLedgerWithFingerprint(
      backgroundApi as unknown as IBackgroundApi,
      buildDevice('ledger-confirmation-mismatch'),
      'evm',
      jest.fn().mockResolvedValue(success({ address: 'synthetic-address' })),
      {
        operationId: 'hwk-ledger-confirmation-mismatch',
        allowFingerprintBootstrap: true,
      },
    );
    expect(result).toMatchObject({
      success: false,
      payload: { code: HardwareErrorCode.DeviceMismatch },
    });
  });

  it('drops the anchor a confirmation mismatch invalidated and re-bootstraps next call', async () => {
    const getChainFingerprint = jest
      .fn()
      .mockResolvedValueOnce(success('wrong-evm'))
      .mockResolvedValueOnce(
        failure(HardwareErrorCode.DeviceMismatch, 'Different device'),
      )
      .mockResolvedValueOnce(success('right-evm'))
      .mockResolvedValueOnce(success('right-evm'));
    const backgroundApi = {
      serviceThirdPartyHardware: {
        getAdapterForVendor: jest
          .fn()
          .mockResolvedValue({ hw: { getChainFingerprint } }),
      },
    };
    const device = buildDevice('ledger-mismatch-rollback');
    const callOptions = {
      operationId: 'hwk-ledger-mismatch-rollback',
      allowFingerprintBootstrap: true,
    };
    const fn = jest.fn().mockResolvedValue(success({ address: 'addr' }));

    const first = await callLedgerWithFingerprint(
      backgroundApi as unknown as IBackgroundApi,
      device,
      'evm',
      fn,
      callOptions,
    );

    expect(first).toMatchObject({
      success: false,
      payload: { code: HardwareErrorCode.DeviceMismatch },
    });
    // The rejected anchor is cleared in DB, not left as the expected value.
    expect(
      jest.mocked(localDb).updateDeviceChainFingerprint?.mock.calls,
    ).toContainEqual([
      { dbDeviceId: device.id, chain: 'evm', fingerprint: '' },
    ]);

    fn.mockClear();
    const second = await callLedgerWithFingerprint(
      backgroundApi as unknown as IBackgroundApi,
      device,
      'evm',
      fn,
      callOptions,
    );

    // Empty deviceId proves the memory cache no longer serves 'wrong-evm'.
    expect(fn).toHaveBeenCalledWith(
      '',
      callOptions.operationId,
      expect.any(Object),
    );
    expect(second.success).toBe(true);
  });

  it('preserves an SDK fingerprint mismatch during cross-chain verification', async () => {
    const getChainFingerprint = jest
      .fn()
      .mockResolvedValue(
        failure(HardwareErrorCode.DeviceMismatch, 'Wrong wallet'),
      );
    const backgroundApi = {
      serviceThirdPartyHardware: {
        getAdapterForVendor: jest
          .fn()
          .mockResolvedValue({ hw: { getChainFingerprint } }),
      },
    };
    expect(
      await verifySeedMatch(
        backgroundApi as unknown as IBackgroundApi,
        {
          ...buildDevice('ledger-cross-chain-mismatch'),
          settingsRaw: JSON.stringify({
            chainFingerprints: { evm: 'expected' },
          }),
        },
        'hwk-ledger-cross-chain-mismatch',
      ),
    ).toBe('mismatch');
    expect(getChainFingerprint).toHaveBeenCalledTimes(1);
  });

  it('uses the same interaction for address bootstrap and fingerprint generation', async () => {
    const getChainFingerprint = jest.fn().mockResolvedValue(success('fp-evm'));
    const backgroundApi = {
      serviceThirdPartyHardware: {
        getAdapterForVendor: jest.fn().mockResolvedValue({
          hw: { getChainFingerprint },
        }),
      },
    };
    const fn = jest.fn().mockResolvedValue(success({ address: '0x1234' }));
    const device = buildDevice('ledger-address-bootstrap');

    const result = await callLedgerWithFingerprint(
      backgroundApi as unknown as IBackgroundApi,
      device,
      'evm',
      fn,
      {
        operationId: 'hwk-ledger-address',
        allowFingerprintBootstrap: true,
      },
    );

    expect(result.success).toBe(true);
    expect(fn).toHaveBeenCalledWith('', 'hwk-ledger-address', {
      knownConnections: [],
      extra: { dbDeviceId: device.id },
    });
    expect(getChainFingerprint).toHaveBeenCalledWith(
      'hwk-ledger-address',
      '',
      'evm',
    );
    expect(
      jest.mocked(localDb).updateDeviceChainFingerprint?.mock.calls,
    ).toContainEqual([
      {
        dbDeviceId: device.id,
        chain: 'evm',
        fingerprint: 'fp-evm',
      },
    ]);
  });

  it('bootstraps a missing chain only after another stored chain verifies the seed', async () => {
    jest.replaceProperty(
      ledgerConfig,
      'enableCrossChainFingerprintVerification',
      true,
    );
    const getChainFingerprint = jest.fn(
      (_connectId: string, _deviceId: string, chain: string) =>
        Promise.resolve(success(chain === 'evm' ? 'fp-evm' : 'fp-sol')),
    );
    const backgroundApi = {
      serviceThirdPartyHardware: {
        getAdapterForVendor: jest.fn().mockResolvedValue({
          hw: { getChainFingerprint },
        }),
      },
    };
    const fn = jest.fn().mockResolvedValue(success({ address: 'sol-address' }));
    const device = {
      ...buildDevice('ledger-cross-chain-bootstrap'),
      settingsRaw: JSON.stringify({
        chainFingerprints: { evm: 'fp-evm' },
      }),
    };

    const result = await callLedgerWithFingerprint(
      backgroundApi as unknown as IBackgroundApi,
      device,
      'sol',
      fn,
      { operationId: 'hwk-ledger-cross-chain' },
    );

    expect(result.success).toBe(true);
    expect(getChainFingerprint).toHaveBeenNthCalledWith(
      1,
      'hwk-ledger-cross-chain',
      'fp-evm',
      'evm',
    );
    expect(fn).toHaveBeenCalledWith('', 'hwk-ledger-cross-chain', {
      knownConnections: [],
      extra: { dbDeviceId: device.id },
    });
    expect(getChainFingerprint).toHaveBeenNthCalledWith(
      2,
      'hwk-ledger-cross-chain',
      '',
      'sol',
    );
  });
});
