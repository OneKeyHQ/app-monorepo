/* eslint-disable import/first */

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('../../connectors/externalWalletFactory', () => ({
  __esModule: true,
  default: {},
}));

import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import ServiceDappSide from './ServiceDappSide';

import type { IDBExternalAccount } from '../../dbs/local/types';

const firstAddress = '0x1111111111111111111111111111111111111111';
const secondAddress = '0x2222222222222222222222222222222222222222';
const thirdAddress = '0x3333333333333333333333333333333333333333';

function buildExternalAccount(): IDBExternalAccount {
  return {
    address: '',
    addresses: {},
    coinType: '',
    connectedAddresses: {
      [IMPL_EVM]: `${firstAddress},${secondAddress}`,
      [PERPS_NETWORK_ID]: firstAddress,
      'evm--1': thirdAddress,
    },
    connectionInfoRaw: undefined,
    id: 'external--test-account',
    impl: IMPL_EVM,
    name: 'External Account',
    path: '',
    pub: '',
    selectedAddress: {},
    type: 'variant',
  } as IDBExternalAccount;
}

describe('ServiceDappSide.disconnectExternalWallet', () => {
  const originalIsWebDappMode = platformEnv.isWebDappMode;

  afterEach(() => {
    platformEnv.isWebDappMode = originalIsWebDappMode;
    jest.clearAllMocks();
  });

  it('awaits Agent credential cleanup for every connected EVM address in Web DApp mode', async () => {
    platformEnv.isWebDappMode = true;
    const removeHyperLiquidAgentCredentialsByUserAddresses = jest
      .fn()
      .mockResolvedValue(2);
    const account = buildExternalAccount();
    const service = new ServiceDappSide({
      backgroundApi: {
        serviceAccount: {
          getDBAccount: jest.fn().mockResolvedValue(account),
          removeHyperLiquidAgentCredentialsByUserAddresses,
        },
      },
    });

    await service.disconnectExternalWallet({
      account: undefined,
      accountId: account.id,
    });

    expect(
      removeHyperLiquidAgentCredentialsByUserAddresses,
    ).toHaveBeenCalledWith({
      userAddresses: [firstAddress, secondAddress, thirdAddress],
    });
  });

  it('leaves Agent credential cleanup unchanged in Web Wallet mode', async () => {
    platformEnv.isWebDappMode = false;
    const removeHyperLiquidAgentCredentialsByUserAddresses = jest.fn();
    const service = new ServiceDappSide({
      backgroundApi: {
        serviceAccount: {
          getDBAccount: jest.fn(),
          removeHyperLiquidAgentCredentialsByUserAddresses,
        },
      },
    });

    await service.disconnectExternalWallet({
      account: buildExternalAccount(),
    });

    expect(
      removeHyperLiquidAgentCredentialsByUserAddresses,
    ).not.toHaveBeenCalled();
  });
});
