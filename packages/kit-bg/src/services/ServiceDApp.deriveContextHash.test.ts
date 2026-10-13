import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';
import { EDeviceType, HardwareErrorCode } from '@onekeyfe/hd-shared';

import {
  UnknownMethod,
  UserCancel,
} from '@onekeyhq/shared/src/errors/errors/hardwareErrors';
import type { IDeviceSharedCallParams } from '@onekeyhq/shared/types/device';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import ProviderApiBtc from '../providers/ProviderApiBtc';
import { vaultFactory } from '../vaults/factory';
import { KeyringHardwareBtcBase } from '../vaults/impls/btc/KeyringHardwareBtcBase';

import ServiceDApp from './ServiceDApp';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  providerApiMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => {
  const logger: unknown = new Proxy(jest.fn(), {
    apply: () => undefined,
    get: () => logger,
  });
  return { defaultLogger: logger };
});
jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class {
    backgroundApi: unknown;
    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));
jest.mock('../providers/backgroundProviders', () => ({
  providerApiLoaders: {},
}));
jest.mock('../states/jotai/atoms', () => ({
  settingsPersistAtom: { get: jest.fn() },
}));
jest.mock('../vaults/factory', () => ({
  vaultFactory: { getVault: jest.fn() },
}));

const SECRET = 'ab'.repeat(32);
const PARAMS = { appName: 'babylon', context: 'deadbeef' };
const REQUEST: IJsBridgeMessagePayload = {
  origin: 'https://babylon.example',
  scope: IInjectedProviderNames.btc,
  data: { id: 1, method: 'btc_deriveContextHash', params: [PARAMS] },
};

function createHarness({
  walletId = 'hw-test',
  networkId = 'btc--0',
  vendor = EHardwareVendor.onekey,
  relPath = '0/7',
}: {
  walletId?: string;
  networkId?: string;
  vendor?: EHardwareVendor;
  relPath?: string;
} = {}) {
  const accountId = `${walletId}--connected-account`;
  const account = {
    path: networkId === 'btc--0' ? "m/86'/0'/0'" : "m/86'/1'/0'",
    relPath,
    pub: `02${'11'.repeat(32)}`,
  };
  const deviceParams: IDeviceSharedCallParams = {
    dbDevice: {
      id: 'test-device',
      name: 'Test Classic 1s',
      connectId: 'test-connect-id',
      deviceId: 'test-device-id',
      deviceType: EDeviceType.Classic1s,
      uuid: 'test-uuid',
      features: '{}',
      settingsRaw: '{}',
      createdAt: 0,
      updatedAt: 0,
      vendor,
    },
    deviceCommonParams: {
      passphraseState: 'synthetic-test-state',
      useEmptyPassphrase: false,
      usePreInitialize: true,
      connectProtocol: 'V1',
    },
  };
  const btcDeriveContextHash = jest.fn().mockResolvedValue({
    success: true,
    payload: { secret: SECRET },
  });
  const keyring = Object.assign(
    Object.create(KeyringHardwareBtcBase.prototype) as KeyringHardwareBtcBase,
    {
      vault: { getAccount: async () => account },
      getHardwareSDKInstance: jest
        .fn()
        .mockResolvedValue({ btcDeriveContextHash }),
    },
  );
  const softwareDerive = jest.fn().mockResolvedValue(SECRET);
  jest.mocked(vaultFactory.getVault).mockResolvedValue({
    getAccount: async () => account,
    keyring: walletId.startsWith('hd-')
      ? { deriveContextHash: softwareDerive }
      : keyring,
  } as unknown as Awaited<ReturnType<typeof vaultFactory.getVault>>);

  const openModal = jest
    .fn<
      Promise<string>,
      [{ request: IJsBridgeMessagePayload; nonce: string }]
    >()
    .mockResolvedValue('approval-opened');
  const withHardwareProcessing = jest.fn(async (fn: () => Promise<unknown>) =>
    fn(),
  );
  const backgroundApi = {
    serviceSetting: { getEnableBTCFreshAddress: async () => false },
    serviceAccount: { getWalletDevice: async () => deviceParams.dbDevice },
    servicePassword: {
      promptPasswordVerifyByAccount: jest.fn().mockResolvedValue({
        password: walletId.startsWith('hd-') ? 'synthetic-test-password' : '',
        deviceParams: walletId.startsWith('hd-') ? undefined : deviceParams,
      }),
    },
    serviceHardwareUI: { withHardwareProcessing },
    serviceDApp: {
      dAppGetConnectedAccountsInfo: async () => [
        {
          accountInfo: {
            accountId,
            networkId,
            walletId,
            address: 'test-address',
          },
        },
      ],
      stageDeriveContextHashRequest: jest.fn<
        ReturnType<ServiceDApp['stageDeriveContextHashRequest']>,
        Parameters<ServiceDApp['stageDeriveContextHashRequest']>
      >(),
      openDeriveContextHashModal: openModal,
    },
  };
  const service = new ServiceDApp({ backgroundApi });
  backgroundApi.serviceDApp.stageDeriveContextHashRequest.mockImplementation(
    (params) => service.stageDeriveContextHashRequest(params),
  );
  const provider = new ProviderApiBtc({ backgroundApi });
  return {
    account,
    accountId,
    deviceParams,
    service,
    provider,
    openModal,
    withHardwareProcessing,
    btcDeriveContextHash,
    softwareDerive,
    backgroundApi,
  };
}

describe('BTC deriveContextHash hardware integration', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['btc--0', 'bitcoin-mainnet'],
    ['tbtc--0', 'bitcoin-testnet'],
    ['tbtc--1', 'bitcoin-signet'],
  ])(
    'derives for the approved account on %s inside hardware processing',
    async (networkId, network) => {
      const h = createHarness({ networkId });
      await expect(h.provider.deriveContextHash(REQUEST, PARAMS)).resolves.toBe(
        'approval-opened',
      );
      expect(h.btcDeriveContextHash).not.toHaveBeenCalled();
      const { nonce, request } = h.openModal.mock.calls[0][0];
      expect(request.data).toEqual({
        id: 1,
        method: 'btc_deriveContextHash',
        params: '[redacted]',
      });
      await expect(h.service.executeDeriveContextHash({ nonce })).resolves.toBe(
        SECRET,
      );
      expect(h.withHardwareProcessing).toHaveBeenCalledWith(
        expect.any(Function),
        {
          deviceParams: h.deviceParams,
          debugMethodName: 'serviceDApp.executeDeriveContextHash',
        },
      );
      expect(h.btcDeriveContextHash).toHaveBeenCalledWith(
        'test-connect-id',
        'test-device-id',
        {
          ...h.deviceParams.deviceCommonParams,
          path: `${h.account.path}/0/7`,
          ...PARAMS,
          network,
        },
      );
      expect(await h.service.peekDeriveContextHashRequest(nonce)).toBeNull();
    },
  );

  it('keeps the derived secret out of hardware completion logs', async () => {
    const h = createHarness();
    const completionLogResults: unknown[] = [];
    h.withHardwareProcessing.mockImplementation(async (fn) => {
      const result = await fn();
      completionLogResults.push(result);
      return result;
    });
    await h.provider.deriveContextHash(REQUEST, PARAMS);
    const { nonce } = h.openModal.mock.calls[0][0];

    await expect(h.service.executeDeriveContextHash({ nonce })).resolves.toBe(
      SECRET,
    );
    expect(completionLogResults).toEqual([undefined]);
  });

  it.each([EHardwareVendor.ledger, EHardwareVendor.trezor])(
    'rejects %s before approval or device communication',
    async (vendor) => {
      const h = createHarness({ vendor });
      await expect(
        h.provider.deriveContextHash(REQUEST, PARAMS),
      ).rejects.toMatchObject({ code: -32_004 });
      expect(h.openModal).not.toHaveBeenCalled();
      expect(h.btcDeriveContextHash).not.toHaveBeenCalled();
    },
  );

  it.each(['imported', 'watching', 'qr-test'])(
    'rejects %s wallets',
    async (walletId) => {
      const h = createHarness({ walletId });
      await expect(
        h.provider.deriveContextHash(REQUEST, PARAMS),
      ).rejects.toMatchObject({ code: -32_004 });
      expect(h.openModal).not.toHaveBeenCalled();
    },
  );

  it('retains the software HD flow without entering hardware processing', async () => {
    const h = createHarness({ walletId: 'hd-test' });
    await h.provider.deriveContextHash(REQUEST, PARAMS);
    const { nonce } = h.openModal.mock.calls[0][0];
    await expect(h.service.executeDeriveContextHash({ nonce })).resolves.toBe(
      SECRET,
    );
    expect(h.withHardwareProcessing).not.toHaveBeenCalled();
    expect(h.softwareDerive).toHaveBeenCalledWith({
      ...PARAMS,
      password: 'synthetic-test-password',
      deviceParams: undefined,
      canonicalNetworkName: 'bitcoin-mainnet',
      connectedPubkey: h.account.pub,
    });
    expect(h.btcDeriveContextHash).not.toHaveBeenCalled();
  });

  it.each([
    [HardwareErrorCode.ActionCancelled, UserCancel],
    [HardwareErrorCode.DeviceNotSupportMethod, UnknownMethod],
  ])(
    'maps SDK error %s without consuming the pending request',
    async (code, errorClass) => {
      const h = createHarness();
      h.btcDeriveContextHash.mockResolvedValue({
        success: false,
        payload: { code, error: 'test-device-error' },
      });
      await h.provider.deriveContextHash(REQUEST, PARAMS);
      const { nonce } = h.openModal.mock.calls[0][0];
      await expect(
        h.service.executeDeriveContextHash({ nonce }),
      ).rejects.toBeInstanceOf(errorClass);
      expect(
        await h.service.peekDeriveContextHashRequest(nonce),
      ).not.toBeNull();
    },
  );

  it('rejects empty context before staging approval', async () => {
    const h = createHarness();
    await expect(
      h.provider.deriveContextHash(REQUEST, { ...PARAMS, context: '' }),
    ).rejects.toMatchObject({ code: -32_602 });
    expect(h.openModal).not.toHaveBeenCalled();
    expect(
      h.backgroundApi.serviceDApp.stageDeriveContextHashRequest,
    ).not.toHaveBeenCalled();
  });
});
