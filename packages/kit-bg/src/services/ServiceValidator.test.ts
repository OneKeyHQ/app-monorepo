import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IAddressValidation } from '@onekeyhq/shared/types/address';

import ServiceValidator from './ServiceValidator';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => () => undefined,
  backgroundMethod:
    () => (_target: unknown, _key: unknown, descriptor: PropertyDescriptor) =>
      descriptor,
}));
jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class {},
}));
jest.mock('../vaults/factory', () => ({ vaultFactory: {} }));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    addressInput: { validation: { failWithUnknownError: jest.fn() } },
  },
}));
// Stands in for settings.localWallet: Zcash is the privacy chain here.
jest.mock('../vaults/localWallet/isLocalWalletNetwork', () => ({
  isLocalWalletNetwork: async ({ networkId }: { networkId: string }) =>
    networkId === 'zec--0',
  mayBeLocalWalletAddress: async ({ address }: { address: string }) =>
    address !== 'not-an-address-shape',
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup() {
  const local = deferred<IAddressValidation>();
  const server = deferred<{ data: { data: { isValid: boolean } } }>();
  const context = {
    localValidateAddress: jest.fn(() => local.promise),
    serverValidateAddress: jest.fn(() => server.promise),
    backgroundApi: {
      serviceNetwork: { isCustomNetwork: jest.fn(async () => false) },
    },
  };
  const run = (networkId = 'zec--0') =>
    ServiceValidator.prototype.validateAddress.call(
      context as unknown as ServiceValidator,
      { networkId, address: 'recipient' },
    );
  const resolveLocal = (isValid: boolean) =>
    local.resolve({
      isValid,
      normalizedAddress: isValid ? 'recipient' : '',
      displayAddress: isValid ? 'recipient' : '',
    });
  return { local, server, context, run, resolveLocal };
}

describe('address validation authority', () => {
  it('lets the local SDK decide a privacy chain recipient without the server', async () => {
    const { run, context, resolveLocal } = setup();
    const result = run();
    resolveLocal(true);
    await expect(result).resolves.toBe('valid');
    expect(context.serverValidateAddress).not.toHaveBeenCalled();
  });

  it('does not let server acceptance override an unsupported local recipient', async () => {
    const { run, resolveLocal, server } = setup();
    const result = run();
    resolveLocal(false);
    server.resolve({ data: { data: { isValid: true } } });
    await expect(result).resolves.toBe('invalid');
  });

  it('cannot approve a Zcash recipient when the local SDK fails', async () => {
    const { run, local, server } = setup();
    const result = run();
    local.reject(new Error('keys runtime unavailable'));
    server.resolve({ data: { data: { isValid: true } } });
    await expect(result).resolves.toBe('unknown');
  });

  it('falls back to local validation for other chains when the server is unavailable', async () => {
    const { run, resolveLocal, server } = setup();
    const result = run('evm--1');
    server.reject(new Error('offline'));
    resolveLocal(true);
    await expect(result).resolves.toBe('valid');
  });

  it('retains server rejection for other chains', async () => {
    const { run, resolveLocal, server } = setup();
    const result = run('evm--1');
    resolveLocal(true);
    server.resolve({ data: { data: { isValid: false } } });
    await expect(result).resolves.toBe('invalid');
  });
});

describe('batch address validation', () => {
  it('uses local Zcash support when the batch server is unavailable', async () => {
    const context = {
      serverBatchValidateAddress: jest.fn(async () => {
        throw new OneKeyLocalError('offline');
      }),
      localValidateAddress: jest.fn(async () => ({ isValid: true })),
    };
    await expect(
      ServiceValidator.prototype.validateAddressBatch.call(
        context as unknown as ServiceValidator,
        { networkIdList: ['zec--0'], accountAddress: 'recipient' },
      ),
    ).resolves.toEqual({ isValid: true, networkIds: ['zec--0'] });
  });

  it('does not trust server Zcash acceptance when the local SDK fails', async () => {
    const context = {
      serverBatchValidateAddress: jest.fn(async () => ({
        isValid: true,
        networkIds: ['zec--0'],
      })),
      localValidateAddress: jest.fn(async () => {
        throw new OneKeyLocalError('keys runtime unavailable');
      }),
    };
    await expect(
      ServiceValidator.prototype.validateAddressBatch.call(
        context as unknown as ServiceValidator,
        { networkIdList: ['zec--0'], accountAddress: 'recipient' },
      ),
    ).resolves.toEqual({ isValid: false, networkIds: [] });
  });

  it.each([true, false])(
    'uses the local Zcash verdict %s when discovering networks',
    async (isValid) => {
      const local = deferred<IAddressValidation>();
      const context = {
        serverBatchValidateAddress: jest.fn(async () => ({
          isValid: true,
          networkIds: ['evm--1', 'zec--0'],
        })),
        localValidateAddress: jest.fn(() => local.promise),
      };
      const pending = ServiceValidator.prototype.validateAddressBatch.call(
        context as unknown as ServiceValidator,
        { networkIdList: ['evm--1', 'zec--0'], accountAddress: 'recipient' },
      );
      expect(context.serverBatchValidateAddress).toHaveBeenCalledTimes(1);
      // Local validation starts once settings say which networks are local.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(context.localValidateAddress).toHaveBeenCalledTimes(1);
      local.resolve({ isValid, normalizedAddress: '', displayAddress: '' });
      await expect(pending).resolves.toEqual({
        isValid: true,
        networkIds: isValid ? ['evm--1', 'zec--0'] : ['evm--1'],
      });
    },
  );

  it('skips the local validator for input that cannot be the chain address', async () => {
    const context = {
      serverBatchValidateAddress: jest.fn(async () => ({
        isValid: true,
        networkIds: ['evm--1'],
      })),
      localValidateAddress: jest.fn(async () => ({ isValid: true })),
    };
    await expect(
      ServiceValidator.prototype.validateAddressBatch.call(
        context as unknown as ServiceValidator,
        {
          networkIdList: ['evm--1', 'zec--0'],
          accountAddress: 'not-an-address-shape',
        },
      ),
    ).resolves.toEqual({ isValid: true, networkIds: ['evm--1'] });
    expect(context.localValidateAddress).not.toHaveBeenCalled();
  });

  it('discovers a supported Zcash address despite server rejection', async () => {
    const context = {
      serverBatchValidateAddress: jest.fn(async () => ({
        isValid: false,
        networkIds: [],
      })),
      localValidateAddress: jest.fn(async () => ({ isValid: true })),
    };
    await expect(
      ServiceValidator.prototype.validateAddressBatch.call(
        context as unknown as ServiceValidator,
        { networkIdList: ['zec--0'], accountAddress: 'recipient' },
      ),
    ).resolves.toEqual({ isValid: true, networkIds: ['zec--0'] });
  });
});
