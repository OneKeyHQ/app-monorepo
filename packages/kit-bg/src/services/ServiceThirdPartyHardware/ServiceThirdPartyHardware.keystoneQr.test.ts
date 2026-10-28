/* eslint-disable @typescript-eslint/unbound-method -- Jest assertions inspect mocked service methods. */
import ServiceThirdPartyHardware from '.';

import { UI_RESPONSE } from '@onekeyfe/hwk-adapter-core/ui-events';

import {
  OneKeyErrorAirGapInvalidQrCode,
  OneKeyErrorScanQrCodeCancel,
  SecureQRCodeDialogCancel,
} from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import {
  EThirdPartyHardwareUiAction,
  thirdPartyHardwareUiStateAtom,
} from '../../states/jotai/atoms';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IThirdPartyHardwareUiState } from '../../states/jotai/atoms';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

type IAnswer = { type: string; cbor: string };

function pendingAnswer() {
  let resolve: (answer: IAnswer) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<IAnswer>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function qrState(id = 'qr-a', scanOnly = false): IThirdPartyHardwareUiState {
  return {
    uiRequestId: id,
    vendor: EHardwareVendor.keystone,
    action: scanOnly
      ? EThirdPartyHardwareUiAction.requestKeystoneQrScan
      : EThirdPartyHardwareUiAction.requestKeystoneQrDisplay,
    payload: scanOnly
      ? undefined
      : { urType: 'eth-sign-request', urData: 'a0' },
  };
}

async function flush() {
  for (let i = 0; i < 12; i += 1) await Promise.resolve();
}

function createService(initial = qrState()) {
  let state: IThirdPartyHardwareUiState | undefined = initial;
  const listeners = new Set<() => void>();
  const pending = new Map<string, ReturnType<typeof pendingAnswer>>();
  const startTwoWayAirGapScan = jest.fn(
    (_ur: IAnswer, options: { owner?: string }) => {
      const answer = pendingAnswer();
      pending.set(options.owner ?? '', answer);
      return answer.promise;
    },
  );
  const scanAirGap = jest.fn(
    async (_options: { owner?: string }): Promise<IAnswer> => ({
      type: 'crypto-multi-accounts',
      cbor: 'a1',
    }),
  );
  const cancelStageAirGapScan = jest.fn(
    async ({ owner }: { owner?: string }) => {
      pending.get(owner ?? '')?.reject(new SecureQRCodeDialogCancel());
    },
  );
  jest
    .spyOn(thirdPartyHardwareUiStateAtom, 'get')
    .mockImplementation(async () => state);
  jest
    .spyOn(thirdPartyHardwareUiStateAtom, 'sub')
    .mockImplementation((listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    });
  const publish = (value: IThirdPartyHardwareUiState | undefined) => {
    state = value;
    listeners.forEach((listener) => listener());
  };
  const service = new ServiceThirdPartyHardware({
    backgroundApi: {
      serviceQrWallet: {
        startTwoWayAirGapScan,
        scanAirGap,
        cancelStageAirGapScan,
      },
    } as unknown as IBackgroundApi,
  });
  const reply = jest
    .spyOn(service, 'thirdPartyHardwareUiResponse')
    .mockResolvedValue(undefined);
  const cancel = jest
    .spyOn(service, 'thirdPartyHardwareCancel')
    .mockResolvedValue(undefined);
  const clear = jest
    .spyOn(service, 'clearThirdPartyHardwareUiStateIfCurrent')
    .mockImplementation(async ({ expectedRequestId }) => {
      if (state?.uiRequestId !== expectedRequestId) return false;
      publish(undefined);
      return true;
    });
  return {
    service,
    pending,
    publish,
    listeners,
    startTwoWayAirGapScan,
    scanAirGap,
    cancelStageAirGapScan,
    reply,
    cancel,
    clear,
    current: () => state,
  };
}

afterEach(() => jest.restoreAllMocks());

it('answers in bg after the initiating UI call returned, with only one exchange for multiple viewports', async () => {
  const f = createService();
  await Promise.all([
    f.service.handleKeystoneQrRequest({ uiRequestId: 'qr-a' }),
    f.service.handleKeystoneQrRequest({ uiRequestId: 'qr-a' }),
  ]);
  await flush();
  expect(f.startTwoWayAirGapScan).toHaveBeenCalledTimes(1);
  expect(f.reply).not.toHaveBeenCalled();
  // No UI promise needs to survive: another viewport's frame resolves the bg exchange.
  f.pending.get('qr-a')?.resolve({ type: 'eth-signature', cbor: 'a1' });
  await flush();
  expect(f.reply).toHaveBeenCalledTimes(1);
  expect(f.reply).toHaveBeenCalledWith({
    vendor: EHardwareVendor.keystone,
    response: {
      type: UI_RESPONSE.RECEIVE_QR_RESPONSE,
      payload: { urType: 'eth-signature', urData: 'a1' },
    },
  });
  expect(f.cancel).not.toHaveBeenCalled();
  expect(f.current()).toBeUndefined();
  expect(f.listeners.size).toBe(0);
});

it.each([SecureQRCodeDialogCancel, OneKeyErrorScanQrCodeCancel])(
  'cancels the Keystone request when the exchange ends with %p',
  async (CancelError) => {
    const f = createService();
    await f.service.handleKeystoneQrRequest({ uiRequestId: 'qr-a' });
    await flush();
    f.pending.get('qr-a')?.reject(new CancelError());
    await flush();
    expect(f.cancel).toHaveBeenCalledWith({ vendor: EHardwareVendor.keystone });
    expect(f.reply).not.toHaveBeenCalled();
    expect(f.current()).toBeUndefined();
    expect(f.listeners.size).toBe(0);
  },
);

it('does not register an early-cancel tag when the request ended before scanning started', async () => {
  const f = createService();
  jest
    .spyOn(thirdPartyHardwareUiStateAtom, 'get')
    .mockResolvedValueOnce(qrState())
    .mockResolvedValueOnce(undefined);
  await f.service.handleKeystoneQrRequest({ uiRequestId: 'qr-a' });
  await flush();
  expect(f.startTwoWayAirGapScan).not.toHaveBeenCalled();
  expect(f.cancelStageAirGapScan).not.toHaveBeenCalled();
  expect(f.reply).not.toHaveBeenCalled();
  expect(f.listeners.size).toBe(0);
});

it('declines a malformed display request without starting a camera', async () => {
  const state = qrState();
  state.payload = undefined;
  const f = createService(state);
  await f.service.handleKeystoneQrRequest({ uiRequestId: 'qr-a' });
  await flush();
  expect(f.cancel).toHaveBeenCalledTimes(1);
  expect(f.startTwoWayAirGapScan).not.toHaveBeenCalled();
  expect(f.scanAirGap).not.toHaveBeenCalled();
});

it('ends the camera in bg when the SDK times out, without relying on any UI cleanup', async () => {
  const f = createService();
  await f.service.handleKeystoneQrRequest({ uiRequestId: 'qr-a' });
  await flush();
  f.publish(undefined);
  await flush();
  expect(f.cancelStageAirGapScan).toHaveBeenCalledWith({ owner: 'qr-a' });
  expect(f.reply).not.toHaveBeenCalled();
  expect(f.cancel).not.toHaveBeenCalled();
  expect(f.listeners.size).toBe(0);
});

it('leaves a newer request alone while cancelling and retiring the previous request', async () => {
  const f = createService();
  await f.service.handleKeystoneQrRequest({ uiRequestId: 'qr-a' });
  await flush();
  f.publish(qrState('qr-b'));
  await f.service.handleKeystoneQrRequest({ uiRequestId: 'qr-b' });
  await flush();
  expect(f.cancelStageAirGapScan).toHaveBeenCalledWith({ owner: 'qr-a' });
  expect(f.cancelStageAirGapScan).not.toHaveBeenCalledWith({ owner: 'qr-b' });
  expect(f.current()?.uiRequestId).toBe('qr-b');
  expect(f.cancel).not.toHaveBeenCalled();
  f.pending.get('qr-b')?.resolve({ type: 'eth-signature', cbor: 'b0' });
  await flush();
  expect(f.reply).toHaveBeenCalledTimes(1);
  expect(f.reply).toHaveBeenCalledWith(
    expect.objectContaining({
      response: {
        type: UI_RESPONSE.RECEIVE_QR_RESPONSE,
        payload: { urType: 'eth-signature', urData: 'b0' },
      },
    }),
  );
});

it('does not launch a stale request from a delayed UI atom copy', async () => {
  const f = createService(qrState('qr-b'));
  await f.service.handleKeystoneQrRequest({ uiRequestId: 'qr-a' });
  await flush();
  expect(f.startTwoWayAirGapScan).not.toHaveBeenCalled();
  expect(f.listeners.size).toBe(0);
});

it('handles camera-only requests and answers their SDK wait in bg', async () => {
  const f = createService(qrState('qr-a', true));
  await f.service.handleKeystoneQrRequest({ uiRequestId: 'qr-a' });
  await flush();
  expect(f.scanAirGap).toHaveBeenCalledWith({ owner: 'qr-a' });
  expect(f.startTwoWayAirGapScan).not.toHaveBeenCalled();
  expect(f.reply).toHaveBeenCalledWith(
    expect.objectContaining({
      response: {
        type: UI_RESPONSE.RECEIVE_QR_RESPONSE,
        payload: { urType: 'crypto-multi-accounts', urData: 'a1' },
      },
    }),
  );
});

it('preserves the account-export note and flag when responding from bg', async () => {
  const state = qrState();
  state.payload = {
    urType: 'qr-hardware-call',
    urData: 'a0',
    allowAccountExport: true,
  };
  const f = createService(state);
  await f.service.handleKeystoneQrRequest({ uiRequestId: 'qr-a' });
  await flush();
  expect(f.startTwoWayAirGapScan).toHaveBeenCalledWith(expect.anything(), {
    owner: 'qr-a',
    notice: { key: ETranslations.keystone_account_export__desc },
  });
  f.pending.get('qr-a')?.resolve({ type: 'crypto-multi-accounts', cbor: 'a1' });
  await flush();
  expect(f.reply).toHaveBeenCalledWith(
    expect.objectContaining({
      response: {
        type: UI_RESPONSE.RECEIVE_QR_RESPONSE,
        payload: {
          urType: 'crypto-multi-accounts',
          urData: 'a1',
          accountExport: true,
        },
      },
    }),
  );
});

it.each([false, true])(
  'reports invalid scan data to SDK validation (account export=%s)',
  async (accountExport) => {
    const state = qrState();
    if (state.payload) state.payload.allowAccountExport = accountExport;
    const f = createService(state);
    await f.service.handleKeystoneQrRequest({ uiRequestId: 'qr-a' });
    await flush();
    f.pending.get('qr-a')?.reject(new OneKeyErrorAirGapInvalidQrCode());
    await flush();
    expect(f.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        response: {
          type: UI_RESPONSE.RECEIVE_QR_RESPONSE,
          payload: {
            urType: '',
            urData: '',
            ...(accountExport ? { accountExport: true } : {}),
          },
        },
      }),
    );
    expect(f.cancel).not.toHaveBeenCalled();
  },
);
