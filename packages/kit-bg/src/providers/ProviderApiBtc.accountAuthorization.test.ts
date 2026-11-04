import { randomBytes } from 'crypto';

import { Psbt, payments } from 'bitcoinjs-lib';

import {
  getBitcoinBip32,
  getBtcForkNetwork,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import ProviderApiBtc from './ProviderApiBtc';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  providerApiMethod: () => () => undefined,
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { discovery: { dapp: { dappRequest: jest.fn() } } },
}));
jest.mock('./backgroundProviders', () => ({ providerApiLoaders: {} }));

const approval = new Error('confirmation reached');
const network = getBtcForkNetwork('btc');
const root = getBitcoinBip32().fromSeed(randomBytes(32), network);
const xpub = root.neutered().toBase58();
function derived(path: string) {
  const pubkey = root.derivePath(path).publicKey;
  const payment = payments.p2wpkh({ pubkey, network });
  if (!payment.address || !payment.output)
    throw new OneKeyLocalError('Invalid test payment');
  return {
    address: payment.address,
    publicKey: pubkey.toString('hex'),
    script: payment.output,
  };
}
const a = derived('0/0');
const change = derived('1/0');
const claimed = derived('0/100');
const other = derived('0/200');

function encoded(script = a.script) {
  return new Psbt({ network })
    .addInput({
      hash: '00'.repeat(32),
      index: 0,
      witnessUtxo: { script, value: 10_000n },
    })
    .addOutput({ address: other.address, value: 9000n })
    .toHex();
}
function setup() {
  const account = {
    id: 'qr-test',
    address: a.address,
    pub: a.publicKey,
    xpub,
    path: "m/84'/0'/0'",
    relPath: '0/0',
    addressDetail: { normalizedAddress: a.address },
    addresses: { '0/0': a.address },
    customAddresses: { '1/0': change.address },
    findAddresses: { '0/100': claimed.address },
  };
  const openSignAndSendTransactionModal = jest.fn(
    async (_params: { accountId: string }): Promise<{ psbtHex: string }> => {
      throw approval;
    },
  );
  const dAppGetConnectedAccountsInfo = jest.fn().mockResolvedValue([
    {
      account,
      accountInfo: {
        accountId: account.id,
        networkId: 'btc--0',
        address: a.address,
      },
    },
  ]);
  const provider = new ProviderApiBtc({
    backgroundApi: {
      serviceSetting: {
        getEnableBTCFreshAddress: jest.fn().mockResolvedValue(false),
      },
      serviceNetwork: {
        getNetwork: jest.fn().mockResolvedValue({ code: 'btc' }),
      },
      serviceAccount: { getAccount: jest.fn().mockResolvedValue(account) },
      serviceDApp: {
        dAppGetConnectedAccountsInfo,
        openSignAndSendTransactionModal,
      },
    },
  });
  const request: IJsBridgeMessagePayload = {
    origin: 'https://psbt.example',
    scope: 'btc',
  };
  return {
    provider,
    account,
    request,
    openSignAndSendTransactionModal,
    dAppGetConnectedAccountsInfo,
  };
}

describe('BTC explicit PSBT signing accounts', () => {
  it.each([a, change, claimed])(
    'accepts owned primary, custom and claimed address $address',
    async (input) => {
      const h = setup();
      await expect(
        h.provider.signPsbt(h.request, {
          psbtHex: encoded(input.script),
          options: {
            toSignInputs: [
              { index: 0, address: input.address, publicKey: input.publicKey },
            ],
          },
        }),
      ).rejects.toBe(approval);
    },
  );
  it.each([
    { index: 0, address: other.address },
    { index: 0, publicKey: other.publicKey },
    { index: 0, address: a.address, publicKey: other.publicKey },
    { index: 0, address: claimed.address, publicKey: a.publicKey },
  ])('rejects foreign or contradictory signer metadata %j', async (input) => {
    const h = setup();
    await expect(
      h.provider.signPsbt(h.request, {
        psbtHex: encoded(),
        options: { toSignInputs: [input] },
      }),
    ).rejects.toMatchObject({ code: 4100 });
    expect(h.openSignAndSendTransactionModal).not.toHaveBeenCalled();
  });
  it('preserves script-path requests selecting the connected public key', async () => {
    const h = setup();
    await expect(
      h.provider.signPsbt(h.request, {
        psbtHex: encoded(other.script),
        options: {
          toSignInputs: [
            { index: 0, address: a.address, publicKey: a.publicKey },
          ],
          isBtcWalletProvider: true,
        },
      }),
    ).rejects.toBe(approval);
  });
  it('rejects the entire legacy batch before confirming a valid first PSBT', async () => {
    const h = setup();
    await expect(
      h.provider.signPsbts(h.request, {
        psbtHexs: [encoded(), encoded()],
        options: [
          { toSignInputs: [{ index: 0, address: a.address }] },
          { toSignInputs: [{ index: 0, address: other.address }] },
        ],
      }),
    ).rejects.toMatchObject({ code: 4100 });
    expect(h.openSignAndSendTransactionModal).not.toHaveBeenCalled();
  });
  it('does not resolve another signing account between legacy batch confirmations', async () => {
    const h = setup();
    h.openSignAndSendTransactionModal.mockResolvedValue({ psbtHex: encoded() });
    await expect(
      h.provider.signPsbts(h.request, {
        psbtHexs: [encoded(), encoded()],
        options: {
          autoFinalized: false,
          toSignInputs: [{ index: 0, address: a.address }],
        },
      }),
    ).resolves.toHaveLength(2);
    expect(h.dAppGetConnectedAccountsInfo).toHaveBeenCalledTimes(1);
    expect(
      h.openSignAndSendTransactionModal.mock.calls.map(([p]) => p.accountId),
    ).toEqual(['qr-test', 'qr-test']);
  });
});
