/* eslint-disable import/first */

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('../vaults/factory', () => ({ vaultFactory: {} }));

import ServiceCustomToken from './ServiceCustomToken';

const rawData = { tokens: {}, hiddenMap: {}, customMap: {} };
const pairs = [
  { accountId: 'account-evm', networkId: 'evm--1' },
  { accountId: 'account-sol', networkId: 'sol--101' },
];

function createService() {
  const customTokens = {
    getRawData: jest.fn().mockResolvedValue(rawData),
    getCustomTokens: jest.fn(async ({ accountId }: { accountId: string }) => [
      { address: `custom-${accountId}`, accountId },
    ]),
    getHiddenTokens: jest.fn(async ({ accountId }: { accountId: string }) => [
      { address: `hidden-${accountId}`, accountId },
    ]),
  };
  const service = new ServiceCustomToken({
    backgroundApi: { simpleDb: { customTokens } },
  } as unknown as ConstructorParameters<typeof ServiceCustomToken>[0]);
  return { customTokens, service };
}

describe('ServiceCustomToken batch getters', () => {
  it('reads the stored tokens once and answers every pair in order', async () => {
    const { customTokens, service } = createService();

    await expect(service.getCustomTokensBatch({ pairs })).resolves.toEqual([
      { address: 'custom-account-evm', accountId: 'account-evm' },
      { address: 'custom-account-sol', accountId: 'account-sol' },
    ]);
    await expect(service.getHiddenTokensBatch({ pairs })).resolves.toEqual([
      { address: 'hidden-account-evm', accountId: 'account-evm' },
      { address: 'hidden-account-sol', accountId: 'account-sol' },
    ]);

    // Once per batch, shared by every pair instead of re-read per pair.
    expect(customTokens.getRawData).toHaveBeenCalledTimes(2);
    expect(customTokens.getCustomTokens).toHaveBeenCalledTimes(2);
    expect(customTokens.getCustomTokens).toHaveBeenCalledWith({
      ...pairs[0],
      customTokensRawData: rawData,
    });
    expect(customTokens.getHiddenTokens).toHaveBeenCalledWith({
      ...pairs[1],
      customTokensRawData: rawData,
    });
  });
});
