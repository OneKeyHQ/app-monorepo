import { EDeviceType } from '@onekeyfe/hd-shared';
import { UI_REQUEST, UI_RESPONSE } from '@onekeyfe/hwk-adapter-core/ui-events';

import localDb from '@onekeyhq/kit-bg/src/dbs/local/localDb';
import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { thirdPartyBleBindingAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IThirdPartyBleBindingState } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { registerBleBindingUi } from './registerBleBindingUi';

import type { IHardwareWallet } from './types';

jest.mock('@onekeyhq/kit-bg/src/dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    getDevice: jest.fn(),
    updateDeviceConnectId: jest.fn(),
    updateDeviceBleConnectIdAndCleanStaleAliases: jest.fn(),
  },
}));

const drain = () => new Promise<void>((resolve) => setImmediate(resolve));

describe.each([EHardwareVendor.ledger, EHardwareVendor.trezor])(
  '%s BLE binding lifecycle',
  (vendor) => {
    const db = jest.mocked(localDb);
    beforeEach(() => {
      jest.clearAllMocks();
      let state: IThirdPartyBleBindingState | undefined;
      jest
        .spyOn(thirdPartyBleBindingAtom, 'get')
        .mockImplementation(async () => state);
      jest
        .spyOn(thirdPartyBleBindingAtom, 'set')
        .mockImplementation(async (update) => {
          state = typeof update === 'function' ? update(state) : update;
        });
      db.getDevice.mockResolvedValue({
        id: 'db',
        name: 'Test device',
        uuid: 'test-uuid',
        deviceType: EDeviceType.Unknown,
        features: '{}',
        settingsRaw: '{}',
        createdAt: 1,
        updatedAt: 1,
        vendor,
        deviceId: 'verified',
        connectId: 'old',
        settings: { chainFingerprints: { evm: 'verified' } },
      } satisfies IDBDevice);
      db.updateDeviceConnectId.mockResolvedValue(undefined);
      db.updateDeviceBleConnectIdAndCleanStaleAliases.mockResolvedValue({
        cleanedRecordIds: [],
      });
    });
    afterEach(() => {
      jest.restoreAllMocks();
    });

    function setup() {
      const listeners = new Map<
        string,
        (event: { payload: unknown }) => void
      >();
      const hw = {
        on: jest.fn(
          (type: string, listener: (event: { payload: unknown }) => void) =>
            listeners.set(type, listener),
        ),
        cancel: jest.fn(),
        uiResponse: jest.fn(),
      };
      const cancel = registerBleBindingUi({
        hw: hw as unknown as IHardwareWallet,
        vendor,
      });
      const emit = (type: string, payload: unknown) =>
        listeners.get(type)?.({ payload });
      const select = (id: string) =>
        emit(UI_REQUEST.REQUEST_SELECT_DEVICE, {
          requestId: id,
          bindingSessionId: id,
          scanning: true,
          devices: [],
          context: { kind: 'bind-connection' },
        });
      const status = (id: string, value: string) =>
        emit(UI_REQUEST.DEVICE_BINDING_STATUS, {
          selectionRequestId: id,
          status: value,
        });
      const save = (id: string, identity = 'verified') =>
        emit(UI_REQUEST.REQUEST_SAVE_DEVICE_BINDING, {
          requestId: `save-${id}`,
          selectionRequestId: id,
          identity:
            vendor === EHardwareVendor.ledger
              ? {
                  vendor,
                  type: 'chainFingerprint',
                  chain: 'evm',
                  value: identity,
                }
              : { vendor, type: 'deviceId', value: identity },
          connection: { transport: 'ble', connectId: 'new' },
          extra: { dbDeviceId: 'db' },
        });
      return { hw, cancel, select, status, save };
    }

    it('does not let an old dialog cancel its successor', async () => {
      const { select, cancel, hw } = setup();
      select('A');
      await drain();
      select('B');
      cancel('A');
      await drain();
      expect(hw.cancel).not.toHaveBeenCalled();
      expect((await thirdPartyBleBindingAtom.get())?.bindingSessionId).toBe(
        'B',
      );
      cancel('B');
      expect(hw.cancel).toHaveBeenCalledTimes(1);
    });

    it('clears a completed dialog without cancelling another hardware operation', async () => {
      const { select, status, cancel, hw } = setup();
      select('A');
      status('A', 'saved');
      status('A', 'failed');
      await drain();
      cancel('A');
      await drain();
      expect(hw.cancel).not.toHaveBeenCalled();
      expect(await thirdPartyBleBindingAtom.get()).toBeUndefined();
    });

    it.each([false, true])(
      'closes a USB-fallback binding without cancelling the continuing USB operation (UI visible=%s)',
      async (uiVisible) => {
        const { select, status, cancel, hw } = setup();
        select('usb-fallback');
        if (uiVisible) {
          await drain();
          expect((await thirdPartyBleBindingAtom.get())?.status).toBe(
            'scanning',
          );
        }
        status('usb-fallback', 'cancelled');
        await drain();
        expect((await thirdPartyBleBindingAtom.get())?.status).toBe(
          uiVisible ? 'cancelled' : undefined,
        );
        cancel('usb-fallback');
        await drain();
        expect(hw.cancel).not.toHaveBeenCalled();
        expect(db.updateDeviceConnectId.mock.calls).toHaveLength(0);
        expect(
          db.updateDeviceBleConnectIdAndCleanStaleAliases.mock.calls,
        ).toHaveLength(0);
        expect(await thirdPartyBleBindingAtom.get()).toBeUndefined();
      },
    );

    it('keeps a transaction guard live until the pending write finishes', async () => {
      const { select, status, save, cancel, hw } = setup();
      let finishWrite: (() => void) | undefined;
      const pendingWrite = new Promise<void>((resolve) => {
        finishWrite = resolve;
      });
      if (vendor === EHardwareVendor.ledger) {
        db.updateDeviceConnectId.mockImplementationOnce(
          async ({ assertBindingActive }) => {
            await pendingWrite;
            assertBindingActive?.();
          },
        );
      } else {
        db.updateDeviceBleConnectIdAndCleanStaleAliases.mockImplementationOnce(
          async ({ assertBindingActive }) => {
            await pendingWrite;
            assertBindingActive?.();
            return { cleanedRecordIds: [] };
          },
        );
      }
      select('A');
      status('A', 'verifying');
      save('A');
      await drain();
      cancel('A');
      finishWrite?.();
      await drain();
      expect(hw.uiResponse).toHaveBeenCalledWith({
        type: UI_RESPONSE.RECEIVE_SAVE_DEVICE_BINDING,
        payload: { requestId: 'save-A', saved: false },
      });
    });

    it('acknowledges a committed binding even when the dialog closes before acknowledgement', async () => {
      const { select, status, save, cancel, hw } = setup();
      if (vendor === EHardwareVendor.ledger) {
        db.updateDeviceConnectId.mockImplementationOnce(async () => {
          cancel('A');
        });
      } else {
        db.updateDeviceBleConnectIdAndCleanStaleAliases.mockImplementationOnce(
          async () => {
            cancel('A');
            return { cleanedRecordIds: [] };
          },
        );
      }
      select('A');
      status('A', 'verifying');
      save('A');
      await drain();
      expect(hw.uiResponse).toHaveBeenCalledWith({
        type: UI_RESPONSE.RECEIVE_SAVE_DEVICE_BINDING,
        payload: { requestId: 'save-A', saved: true },
      });
    });

    it.each(['close', 'cancelled', 'failed', 'superseded'])(
      'invalidates a save waiting on DB read (%s)',
      async (reason) => {
        const { select, status, save, cancel, hw } = setup();
        const device = await db.getDevice('db');
        let resolveRead: ((value: IDBDevice) => void) | undefined;
        db.getDevice.mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveRead = resolve;
            }),
        );
        select('A');
        status('A', 'verifying');
        save('A');
        await drain();
        if (reason === 'close') cancel('A');
        else if (reason === 'superseded') select('B');
        else status('A', reason);
        resolveRead?.(device);
        await drain();
        expect(db.updateDeviceConnectId.mock.calls).toHaveLength(0);
        expect(
          db.updateDeviceBleConnectIdAndCleanStaleAliases.mock.calls,
        ).toHaveLength(0);
        expect(hw.uiResponse).toHaveBeenCalledWith({
          type: UI_RESPONSE.RECEIVE_SAVE_DEVICE_BINDING,
          // We dropped the request; the user did not pick another device.
          payload: { requestId: 'save-A', saved: false, reason: 'skipped' },
        });
      },
    );

    it.each([true, false])(
      'acknowledges only the active matching identity (matches=%s)',
      async (matches) => {
        const { select, status, save, hw } = setup();
        select('A');
        status('A', 'verifying');
        save('A', matches ? 'verified' : 'wrong');
        await drain();
        expect(hw.uiResponse).toHaveBeenCalledWith({
          type: UI_RESPONSE.RECEIVE_SAVE_DEVICE_BINDING,
          payload: matches
            ? { requestId: 'save-A', saved: true }
            : { requestId: 'save-A', saved: false, reason: 'mismatch' },
        });
        const writes =
          vendor === EHardwareVendor.ledger
            ? db.updateDeviceConnectId.mock.calls
            : db.updateDeviceBleConnectIdAndCleanStaleAliases.mock.calls;
        expect(writes).toHaveLength(matches ? 1 : 0);
      },
    );

    it('rejects an obsolete save even before its first DB read', async () => {
      const { select, status, save } = setup();
      select('A');
      status('A', 'verifying');
      select('B');
      save('A');
      await drain();
      expect(db.getDevice.mock.calls).toHaveLength(0);
    });
  },
);
