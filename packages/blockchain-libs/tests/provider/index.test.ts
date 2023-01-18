import { createDelayPromise } from '@onekeyhq/shared/src/utils/promiseUtils';

import { ProviderController } from '../../src/provider';

const Provider = jest.fn();
const Geth = jest.fn();
const Parity = jest.fn();

let controller: ProviderController;
let chainSelector: any;

beforeEach(() => {
  chainSelector = jest.fn();
  controller = new ProviderController(chainSelector);

  controller.requireChainImpl = jest.fn().mockReturnValue({
    Provider,
    Geth,
    Parity,
  });
});

test('getClient', async () => {
  const chain = {
    impl: 'eth',
    clients: [
      { name: 'Geth', args: ['a1', 'a2'] },
      { name: 'Geth', args: ['b1'] },
      { name: 'Parity', args: ['c1'] },
    ],
  };
  chainSelector.mockReturnValueOnce(chain);

  const geth1 = {
    name: 'geth1',
    getInfo: jest
      .fn()
      .mockReturnValueOnce(createDelayPromise(50, { isReady: false })),
    setChainInfo: jest.fn(),
  };
  const geth2 = {
    name: 'geth2',
    getInfo: jest
      .fn()
      .mockReturnValueOnce(createDelayPromise(100, { isReady: true })),
    setChainInfo: jest.fn(),
  };
  const parity1 = {
    name: 'parity1',
    getInfo: jest
      .fn()
      .mockReturnValueOnce(createDelayPromise(80, { isReady: true })),
    setChainInfo: jest.fn(),
  };

  Geth.mockReturnValueOnce(geth1).mockReturnValueOnce(geth2);
  Parity.mockReturnValueOnce(parity1);

  await expect(controller.getClient('eth')).resolves.toBe(parity1);

  expect(geth1.setChainInfo).toHaveBeenCalledWith(chain);
  expect(geth2.setChainInfo).toHaveBeenCalledWith(chain);
  expect(parity1.setChainInfo).toHaveBeenCalledWith(chain);
  expect(geth1.getInfo).toHaveBeenCalledTimes(1);
  expect(geth2.getInfo).toHaveBeenCalledTimes(1);
  expect(parity1.getInfo).toHaveBeenCalledTimes(1);
});

test('getClient but no available client', async () => {
  chainSelector.mockReturnValueOnce({
    impl: 'eth',
    clients: [
      { name: 'Geth', args: ['a1', 'a2'] },
      { name: 'Geth', args: ['b1'] },
      { name: 'Parity', args: ['c1'] },
    ],
  });

  const geth1 = {
    name: 'geth1',
    getInfo: jest
      .fn()
      .mockReturnValueOnce(createDelayPromise(50, { isReady: false })),
    setChainInfo: jest.fn(),
  };
  const geth2 = {
    name: 'geth2',
    getInfo: jest
      .fn()
      .mockReturnValueOnce(createDelayPromise(100, { isReady: false })),
    setChainInfo: jest.fn(),
  };
  const parity1 = {
    name: 'parity1',
    getInfo: jest.fn().mockRejectedValueOnce(new Error('Illegal network')),
    setChainInfo: jest.fn(),
  };

  Geth.mockReturnValueOnce(geth1).mockReturnValueOnce(geth2);
  Parity.mockReturnValueOnce(parity1);

  await expect(controller.getClient('eth')).rejects.toThrow(
    'No available client',
  );
});

test('getProvider', async () => {
  const chain = {
    impl: 'eth',
  };
  chainSelector.mockReturnValueOnce(chain);

  const provider = { name: 'provider1' };
  Provider.mockReturnValueOnce(provider);

  await expect(controller.getProvider('eth')).resolves.toBe(provider);
  expect(Provider).toHaveBeenCalledWith(chain, expect.anything());
});
