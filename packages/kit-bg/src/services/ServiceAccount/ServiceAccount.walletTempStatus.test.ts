import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import ServiceAccount from './ServiceAccount';

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

const mockEmit = jest.fn();
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { WalletUpdate: 'WalletUpdate' },
  appEventBus: {
    on: jest.fn(),
    off: jest.fn(),
    emit: (...args: unknown[]) => mockEmit(...args),
  },
}));

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: { setWalletTempStatus: jest.fn(async () => undefined) },
}));

function buildService(onWalletTempStatusChanged: jest.Mock) {
  return Object.assign(
    Object.create(ServiceAccount.prototype) as ServiceAccount,
    {
      backgroundApi: { servicePrivacyChain: { onWalletTempStatusChanged } },
    },
  );
}

// The one entry that keeps or un-keeps a temp wallet, so privacy chains learn of it here.
describe('setWalletTempStatus', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([false, true])(
    'tells privacy chains about the wallet (isTemp: %s)',
    async (isTemp) => {
      const notice = jest.fn(async () => undefined);
      await buildService(notice).setWalletTempStatus({
        walletId: 'hd-1',
        isTemp,
      });
      expect(notice).toHaveBeenCalledWith({ walletId: 'hd-1' });
      expect(mockEmit).toHaveBeenCalledWith('WalletUpdate', undefined);
    },
  );

  it('does not fail the change when the notice fails', async () => {
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    const notice = jest.fn(async () => {
      throw new OneKeyLocalError('privacy chain unavailable');
    });
    await expect(
      buildService(notice).setWalletTempStatus({
        walletId: 'hd-1',
        isTemp: false,
      }),
    ).resolves.toBeUndefined();
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(logged).toHaveBeenCalled();
  });
});
