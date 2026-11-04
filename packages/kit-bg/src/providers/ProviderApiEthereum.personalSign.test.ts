import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

import ProviderApiEthereum from './ProviderApiEthereum';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  providerApiMethod: () => () => undefined,
  permissionRequired: () => () => undefined,
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { discovery: { dapp: { dappRequest: jest.fn() } } },
}));
jest.mock('../states/jotai/atoms', () => ({ perpsActiveAccountAtom: {} }));

const accountAddress = '0x52908400098527886E0F7030069857D2E4169EE7';
const otherAddress = '0x1111111111111111111111111111111111111111';
const message = '0x68656c6c6f';
const request: IJsBridgeMessagePayload = {
  origin: 'https://personal-sign.example',
  scope: 'ethereum',
};

function setup(actualAddress = accountAddress) {
  const openSignMessageModal = jest.fn().mockResolvedValue('signature');
  const provider = new ProviderApiEthereum({
    backgroundApi: {
      serviceDApp: {
        dAppGetConnectedAccountsInfo: jest.fn().mockResolvedValue([
          {
            account: {
              addressDetail: { normalizedAddress: actualAddress },
            },
            accountInfo: {
              accountId: 'hd-personal-sign-test',
              networkId: 'evm--1',
              address: accountAddress,
            },
          },
        ]),
        openSignMessageModal,
      },
    },
  });
  return { provider, openSignMessageModal };
}

describe('personal_sign account authorization', () => {
  it.each([
    accountAddress,
    accountAddress.toLowerCase(),
    accountAddress.slice(2),
  ])(
    'accepts the signing account address regardless of case: %s',
    async (address) => {
      const { provider, openSignMessageModal } = setup();

      await expect(
        provider.personal_sign(request, message, address),
      ).resolves.toBe('signature');
      expect(openSignMessageModal).toHaveBeenCalledWith({
        request,
        accountId: 'hd-personal-sign-test',
        networkId: 'evm--1',
        unsignedMessage: {
          type: EMessageTypesEth.PERSONAL_SIGN,
          message,
          payload: [message, address],
        },
      });
    },
  );

  it('preserves the legacy address-first parameter order', async () => {
    const { provider, openSignMessageModal } = setup();

    await expect(
      provider.personal_sign(request, accountAddress, message),
    ).resolves.toBe('signature');
    expect(openSignMessageModal).toHaveBeenCalledWith(
      expect.objectContaining({
        unsignedMessage: expect.objectContaining({
          payload: [message, accountAddress],
        }),
      }),
    );
  });

  it.each([otherAddress, undefined, null, 123, {}])(
    'rejects an unauthorized address before opening confirmation: %j',
    async (address) => {
      const { provider, openSignMessageModal } = setup();

      await expect(
        provider.personal_sign(request, message, address),
      ).rejects.toMatchObject({ code: 4100 });
      expect(openSignMessageModal).not.toHaveBeenCalled();
    },
  );

  it('rejects a mismatched address in legacy parameter order', async () => {
    const { provider, openSignMessageModal } = setup();

    await expect(
      provider.personal_sign(request, otherAddress, message),
    ).rejects.toMatchObject({ code: 4100 });
    expect(openSignMessageModal).not.toHaveBeenCalled();
  });

  it.each([
    otherAddress,
    otherAddress.slice(2),
    otherAddress.replace('0x', '0X'),
  ])(
    'does not reinterpret an address-shaped message as the signing account: %s',
    async (address) => {
      const { provider, openSignMessageModal } = setup();

      await expect(
        provider.personal_sign(request, accountAddress, address),
      ).rejects.toMatchObject({ code: 4100 });
      expect(openSignMessageModal).not.toHaveBeenCalled();
    },
  );

  it('compares with the resolved signing account instead of a cached address', async () => {
    const { provider, openSignMessageModal } = setup(otherAddress);

    await expect(
      provider.personal_sign(request, message, accountAddress),
    ).rejects.toMatchObject({ code: 4100 });
    expect(openSignMessageModal).not.toHaveBeenCalled();
  });
});
