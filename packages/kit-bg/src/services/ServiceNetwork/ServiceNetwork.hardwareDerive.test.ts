import { EDeviceType } from '@onekeyfe/hd-shared';

import { KeyringHardware } from '../../vaults/impls/starknet/KeyringHardware';
import settings from '../../vaults/impls/starknet/settings';

import ServiceNetwork from './ServiceNetwork';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: unknown, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () => (_target: unknown, _key: unknown, descriptor: PropertyDescriptor) =>
      descriptor,
}));
jest.mock('../ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {},
}));

describe('Starknet hardware network settings', () => {
  it('enables Pro 2 hardware accounts', () => {
    expect(settings.hardwareAccountEnabled).toBe(true);
    expect(settings.supportedDeviceTypes).toEqual([EDeviceType.Pro2]);
    expect(KeyringHardware).toBeDefined();
  });

  it('offers the supported Starknet account types', async () => {
    const service = Object.create(ServiceNetwork.prototype) as ServiceNetwork;
    jest.spyOn(service, 'getVaultSettings').mockResolvedValue(settings);
    const items = await service.getDeriveInfoItemsOfNetwork({
      networkId: 'starknet--mainnet',
    });
    expect(items.map((item) => item.value)).toEqual([
      'default',
      'starknetOpenZeppelin',
    ]);
    jest.restoreAllMocks();
  });

  it('distinguishes allowed wallet contracts that share a derivation path', async () => {
    const service = Object.create(ServiceNetwork.prototype) as ServiceNetwork;
    jest.spyOn(service, 'getVaultSettings').mockResolvedValue(settings);
    const items = await service.getDeriveInfoItemsOfNetwork({
      networkId: 'starknet--mainnet',
      enabledItems: [settings.accountDeriveInfo.starknetOpenZeppelin],
    });
    expect(items.map((item) => item.value)).toEqual(['starknetOpenZeppelin']);
    jest.restoreAllMocks();
  });
});
