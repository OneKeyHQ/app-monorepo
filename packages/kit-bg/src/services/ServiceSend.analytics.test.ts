import { EDeviceType } from '@onekeyfe/hd-shared';

import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';
import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types/device';

import ServiceSend from './ServiceSend';

import type { IDBDevice, IDBWalletType } from '../dbs/local/types';

jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => (fn: () => unknown) => fn(),
}));
jest.mock('p-retry', () => ({
  __esModule: true,
  default: (fn: () => unknown) => fn(),
}));
jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => () => undefined,
  backgroundMethod: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
    d,
  toastIfError: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) => d,
}));
jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    backgroundApi: unknown;

    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));
jest.mock('../vaults/factory', () => ({
  vaultFactory: { getVault: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    intl: { formatMessage: ({ id }: { id: string }) => id },
    onLocaleChange: () => undefined,
  },
}));
jest.mock('@onekeyhq/shared/src/utils/deviceUtils', () => ({
  __esModule: true,
  default: { getDeviceTypeFromFeatures: jest.fn() },
}));

type ITestDevice = Partial<Omit<IDBDevice, 'featuresInfo'>> & {
  featuresInfo?: Partial<IOneKeyDeviceFeatures>;
};

const features = { major_version: 4, minor_version: 0, patch_version: 0 };
const oneKeyDevice: ITestDevice = {
  vendor: EHardwareVendor.onekey,
  featuresInfo: features,
  deviceType: EDeviceType.Unknown,
  deviceId: 'must-not-be-reported',
  connectId: 'must-not-be-reported',
};

function makeService({
  walletType = 'hw',
  device = oneKeyDevice,
}: {
  walletType?: IDBWalletType;
  device?: ITestDevice | null;
} = {}) {
  const wallet = { type: walletType, associatedDevice: 'signing-device' };
  const getWallet = jest.fn().mockResolvedValue(wallet);
  const getWalletDeviceSafe = jest.fn().mockResolvedValue(device);
  const service = new ServiceSend({
    backgroundApi: { serviceAccount: { getWallet, getWalletDeviceSafe } },
  });
  return { service, wallet, getWallet, getWalletDeviceSafe };
}

const getDeviceType = jest.mocked(deviceUtils.getDeviceTypeFromFeatures);

describe('sendConfirm wallet attribution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getDeviceType.mockResolvedValue(EDeviceType.Pro2);
  });

  it.each([
    EDeviceType.Pro,
    EDeviceType.Pro2,
    EDeviceType.Neo,
    EDeviceType.Classic1s,
    EDeviceType.ClassicPure,
  ])(
    'uses firmware features for %s and returns no device identifiers',
    async (deviceType) => {
      getDeviceType.mockResolvedValue(deviceType);
      const { service, wallet, getWallet, getWalletDeviceSafe } = makeService();

      await expect(
        service.getSendConfirmWalletInfo({ accountId: 'hw-signing--account' }),
      ).resolves.toEqual({ walletType: 'hw', hwDeviceType: deviceType });
      expect(getWallet).toHaveBeenCalledWith({ walletId: 'hw-signing' });
      expect(getWalletDeviceSafe).toHaveBeenCalledWith({
        walletId: 'hw-signing',
        dbWallet: wallet,
      });
      expect(getDeviceType).toHaveBeenCalledWith({ features });
    },
  );

  it.each(['hd', 'imported', 'external'] as const)(
    'does not look up hardware for a %s wallet',
    async (walletType) => {
      const { service, getWalletDeviceSafe } = makeService({ walletType });
      await expect(
        service.getSendConfirmWalletInfo({
          accountId: `${walletType}--account`,
        }),
      ).resolves.toEqual({ walletType, hwDeviceType: undefined });
      expect(getWalletDeviceSafe).not.toHaveBeenCalled();
      expect(getDeviceType).not.toHaveBeenCalled();
    },
  );

  it('resolves the model for a QR wallet from its associated device', async () => {
    const { service } = makeService({ walletType: 'qr' });
    await expect(
      service.getSendConfirmWalletInfo({ accountId: 'qr-signing--account' }),
    ).resolves.toEqual({ walletType: 'qr', hwDeviceType: EDeviceType.Pro2 });
  });

  it.each([EHardwareVendor.ledger, EHardwareVendor.trezor])(
    'does not classify %s features as a OneKey model',
    async (vendor) => {
      const { service } = makeService({ device: { ...oneKeyDevice, vendor } });
      await expect(
        service.getSendConfirmWalletInfo({ accountId: 'hw-signing--account' }),
      ).resolves.toEqual({ walletType: 'hw', hwDeviceType: undefined });
      expect(getDeviceType).not.toHaveBeenCalled();
    },
  );

  it.each([null, { deviceType: EDeviceType.Pro }])(
    'keeps the wallet type when device features are unavailable: %s',
    async (device) => {
      const { service } = makeService({ device });
      await expect(
        service.getSendConfirmWalletInfo({ accountId: 'hw-signing--account' }),
      ).resolves.toEqual({ walletType: 'hw', hwDeviceType: undefined });
      expect(getDeviceType).not.toHaveBeenCalled();
    },
  );

  it('supports legacy OneKey records without a vendor', async () => {
    const { service } = makeService({ device: { featuresInfo: features } });
    await expect(
      service.getSendConfirmWalletInfo({ accountId: 'hw-signing--account' }),
    ).resolves.toEqual({ walletType: 'hw', hwDeviceType: EDeviceType.Pro2 });
  });

  it('preserves the wallet type when model resolution fails', async () => {
    getDeviceType.mockRejectedValueOnce(new Error('SDK unavailable'));
    const { service } = makeService();
    await expect(
      service.getSendConfirmWalletInfo({ accountId: 'hw-signing--account' }),
    ).resolves.toEqual({ walletType: 'hw', hwDeviceType: undefined });
  });

  it('preserves the wallet type when the device lookup fails', async () => {
    const { service, getWalletDeviceSafe } = makeService();
    getWalletDeviceSafe.mockRejectedValueOnce(new Error('Device unavailable'));
    await expect(
      service.getSendConfirmWalletInfo({ accountId: 'hw-signing--account' }),
    ).resolves.toEqual({ walletType: 'hw', hwDeviceType: undefined });
  });

  it('does not reject when the wallet lookup fails', async () => {
    const { service, getWallet } = makeService();
    getWallet.mockRejectedValueOnce(new Error('Wallet unavailable'));
    await expect(
      service.getSendConfirmWalletInfo({ accountId: 'hw-signing--account' }),
    ).resolves.toEqual({ walletType: undefined, hwDeviceType: undefined });
  });
});
