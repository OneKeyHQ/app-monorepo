import { createHash } from 'crypto';

import { bech32 } from 'bech32';
import { Wallet, utils } from 'ethers';

import ProviderApiCosmos from './ProviderApiCosmos';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  providerApiMethod: () => () => undefined,
  permissionRequired: () => () => undefined,
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { discovery: { dapp: { dappRequest: jest.fn() } } },
}));

const wallet = Wallet.createRandom();
const publicKey = Buffer.from(
  utils.arrayify(utils.computePublicKey(wallet.publicKey, true)),
);
const digest = createHash('ripemd160')
  .update(createHash('sha256').update(publicKey).digest())
  .digest();
const signer = bech32.encode('cosmos', bech32.toWords(digest));
const data = 'OneKey ADR-36 verification regression';
// Canonical ADR-36 bytes, independently constructed in the required sorted-key order.
const signBytes = Buffer.from(
  `{"account_number":"0","chain_id":"","fee":{"amount":[],"gas":"0"},"memo":"","msgs":[{"type":"sign/MsgSignData","value":{"data":"${Buffer.from(data).toString('base64')}","signer":"${signer}"}}],"sequence":"0"}`,
);
const signed = wallet
  ._signingKey()
  .signDigest(createHash('sha256').update(signBytes).digest());
const signature = {
  signature: Buffer.from(
    utils.arrayify(utils.hexConcat([signed.r, signed.s])),
  ).toString('base64'),
  pub_key: {
    type: 'tendermint/PubKeySecp256k1',
    value: publicKey.toString('base64'),
  },
};
const request: IJsBridgeMessagePayload = {
  origin: 'https://verify.example',
  scope: 'cosmos',
};
function setup() {
  const openSignMessageModal = jest.fn();
  const getCachedPassword = jest.fn();
  const provider = new ProviderApiCosmos({
    backgroundApi: {
      serviceDApp: {
        dAppGetConnectedAccountsInfo: jest.fn().mockResolvedValue([
          {
            account: {
              id: 'account-a',
              address: signer,
              pub: publicKey.toString('hex'),
              addressDetail: { normalizedAddress: signer },
            },
            accountInfo: {
              networkId: 'cosmos--cosmoshub-4',
              accountId: 'account-a',
            },
          },
        ]),
        openSignMessageModal,
      },
      servicePassword: { getCachedPassword },
    },
  });
  return { provider, openSignMessageModal, getCachedPassword };
}

describe('Cosmos verifyArbitrary verifies without signing', () => {
  it('verifies an independently signed ADR-36 signature without a confirmation or password', async () => {
    const h = setup();
    await expect(
      h.provider.verifyArbitrary(request, {
        chainId: 'cosmoshub-4',
        signer,
        data,
        signature,
      }),
    ).resolves.toBe(true);
    expect(h.openSignMessageModal).not.toHaveBeenCalled();
    expect(h.getCachedPassword).not.toHaveBeenCalled();
  });
  it.each([
    { data: `${data} changed`, signature },
    {
      data,
      signature: {
        ...signature,
        signature: Buffer.alloc(64).toString('base64'),
      },
    },
    { data, signature: { ...signature, signature: 'malformed' } },
    {
      data,
      signature: {
        ...signature,
        pub_key: { ...signature.pub_key, type: 'unsupported' },
      },
    },
    {
      data,
      signature: {
        ...signature,
        pub_key: {
          ...signature.pub_key,
          value: Buffer.alloc(33).toString('base64'),
        },
      },
    },
    {
      data,
      signature: {
        ...signature,
        pub_key: {
          ...signature.pub_key,
          value: publicKey.subarray(1).toString('base64'),
        },
      },
    },
  ])(
    'returns false for altered data or signature metadata %#',
    async (params) => {
      const h = setup();
      await expect(
        h.provider.verifyArbitrary(request, {
          chainId: 'cosmoshub-4',
          signer,
          ...params,
        }),
      ).resolves.toBe(false);
      expect(h.openSignMessageModal).not.toHaveBeenCalled();
      expect(h.getCachedPassword).not.toHaveBeenCalled();
    },
  );
  it('rejects another requested account before accessing credentials', async () => {
    const h = setup();
    await expect(
      h.provider.verifyArbitrary(request, {
        chainId: 'cosmoshub-4',
        signer: bech32.encode('cosmos', bech32.toWords(Buffer.alloc(20))),
        data,
        signature,
      }),
    ).rejects.toMatchObject({ code: 4100 });
    expect(h.openSignMessageModal).not.toHaveBeenCalled();
    expect(h.getCachedPassword).not.toHaveBeenCalled();
  });
});
