import { ETranslations } from '@onekeyhq/shared/src/locale';

import { setLocalWalletRemoteConfigs } from '../../localWallet/remoteConfig';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { getZcashLifecycleMutex } from './lifecycle';
import Vault from './Vault';
import { zcashCreatePczt } from './vaultSend';

import type { IEncodedTxZcash } from './types';

jest.mock('../../../dbs/local/localDbInstance');
jest.mock('@onekeyhq/core/src/instance/coreChainApi', () => ({
  __esModule: true,
  default: { zec: { hd: {} } },
}));
jest.mock('../btc/KeyringHd', () => ({ KeyringHd: class {} }));

const networkId = 'zec--0';
const vkFp = 'remote-privacy-signing-test';
const disablePrivacy = () =>
  setLocalWalletRemoteConfigs({ [networkId]: { privacyDisabled: true } });
const encodedTx: IEncodedTxZcash = {
  zcashMode: 'privacy',
  zcashSpendSource: 'ironwood',
  inputs: [],
  outputs: [{ address: 'u1-recipient', value: '85000' }],
  inputsForCoinSelect: [],
  outputsForCoinSelect: [],
  fee: '15000',
  txSize: 0,
  zcashTo: 'u1-recipient',
  zcashAmountValue: '85000',
  pcztHex: 'aabb',
};
const params = {
  unsignedTx: { encodedTx, transfersInfo: [] },
  password: 'synthetic-password',
  deviceParams: {
    dbDevice: { connectId: 'synthetic-connect', deviceId: 'synthetic-device' },
    deviceCommonParams: {},
  },
};

afterEach(() => setLocalWalletRemoteConfigs({}));

describe.each(['hd', 'hardware'] as const)(
  'Zcash %s signer server privacy authority',
  (kind) => {
    function fixture() {
      const ensureLoaded = jest.fn(async (): Promise<void> => {});
      const isZcashPrivacyModeEnabled = jest.fn(async () => true);
      const backgroundApi = {
        serviceCustomRpc: { ensureLocalWalletRemoteConfigLoaded: ensureLoaded },
        simpleDb: {
          privacyChainState: {
            getZcashAccountMeta: async () => ({ vkFp, hdIndex: 0 }),
            isZcashPrivacyModeEnabled,
          },
        },
      };
      const prepare = jest.fn(async () => ({ pcztHex: 'aabb' }));
      const combine = jest.fn(async () => ({ pcztHex: 'ccdd' }));
      const prove = jest.fn(async () => ({ pcztHex: 'ccdd' }));
      const redact = jest.fn(async () => ({ pcztHex: 'aabb' }));
      const getUfvk = jest.fn(async () => 'synthetic-ufvk');
      const signSoftware = jest.fn(async () => ({ pcztHex: 'ccdd' }));
      const signDevice = jest.fn(async () => ({
        success: true,
        payload: { pczt: 'ccdd' },
      }));
      const vault = {
        accountId: 'synthetic-account',
        networkId,
        backgroundApi,
        zcashGetAccountUfvk: getUfvk,
        zcashPreparePcztForSigning: prepare,
        zcashCombineSignedPczt: combine,
        zcashProvePczt: prove,
        zcashGetApi: async () => ({
          verifyPcztReview: async () => undefined,
          redactPcztForHardwareSigner: redact,
        }),
      };
      const prototype =
        kind === 'hd' ? KeyringHd.prototype : KeyringHardware.prototype;
      const keyring = Object.assign(
        Object.create(prototype) as Pick<KeyringHd, 'signTransaction'>,
        {
          vault,
          backgroundApi,
          signPcztHex: signSoftware,
          getZcashSdk: async () => ({ zcashSignPczt: signDevice }),
        },
      );
      const sign = () => keyring.signTransaction(params as never);
      const beforeSigner = kind === 'hd' ? prepare : redact;
      return {
        ensureLoaded,
        sign,
        signSoftware,
        signDevice,
        beforeSigner,
        getUfvk,
        isZcashPrivacyModeEnabled,
        combine,
        prove,
      };
    }

    it('rejects an old confirmation until the server removes its restriction', async () => {
      const { sign, signSoftware, signDevice, isZcashPrivacyModeEnabled } =
        fixture();
      disablePrivacy();
      await expect(sign()).rejects.toThrow(ETranslations.global_not_available);
      expect(signSoftware).not.toHaveBeenCalled();
      expect(signDevice).not.toHaveBeenCalled();
      expect(isZcashPrivacyModeEnabled).not.toHaveBeenCalled();

      setLocalWalletRemoteConfigs({});
      await expect(sign()).resolves.toMatchObject({ rawTx: 'ccdd' });
    });

    it('loads a persisted restriction before asking for signatures', async () => {
      const { sign, ensureLoaded, signSoftware, signDevice } = fixture();
      ensureLoaded.mockImplementation(async () => disablePrivacy());
      await expect(sign()).rejects.toThrow(ETranslations.global_not_available);
      expect(signSoftware).not.toHaveBeenCalled();
      expect(signDevice).not.toHaveBeenCalled();
    });

    it('checks again when private preparation finishes before the signer starts', async () => {
      const { sign, beforeSigner, signSoftware, signDevice } = fixture();
      beforeSigner.mockImplementation(async () => {
        disablePrivacy();
        return { pcztHex: 'aabb' };
      });
      await expect(sign()).rejects.toThrow(ETranslations.global_not_available);
      expect(signSoftware).not.toHaveBeenCalled();
      expect(signDevice).not.toHaveBeenCalled();
    });

    it('does not return a signed transaction if the server disables privacy during signing', async () => {
      const { sign, signSoftware, signDevice } = fixture();
      signSoftware.mockImplementation(async () => {
        disablePrivacy();
        return { pcztHex: 'ccdd' };
      });
      signDevice.mockImplementation(async () => {
        disablePrivacy();
        return { success: true, payload: { pczt: 'ccdd' } };
      });
      await expect(sign()).rejects.toThrow(ETranslations.global_not_available);
    });

    it('rejects a queued confirmation before doing private preparation', async () => {
      const { sign, getUfvk, beforeSigner } = fixture();
      const release = await getZcashLifecycleMutex(vkFp).acquire();
      let notifyReady: () => void = () => undefined;
      const ready = new Promise<void>((resolve) => {
        notifyReady = resolve;
      });
      getUfvk.mockImplementation(async () => {
        notifyReady();
        return 'synthetic-ufvk';
      });
      const pending = sign();
      await ready;
      disablePrivacy();
      release();
      await expect(pending).rejects.toThrow(ETranslations.global_not_available);
      expect(beforeSigner).not.toHaveBeenCalled();
    });
  },
);

it.each(['create', 'prove', 'combine'] as const)(
  'blocks the private worker %s entry point while remotely disabled',
  async (operation) => {
    const workerCall = jest.fn();
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      networkId,
      backgroundApi: {
        serviceCustomRpc: {
          ensureLocalWalletRemoteConfigLoaded: async () => undefined,
        },
      },
      zcashGetWalletAccount: async () => ({ ufvk: 'synthetic-ufvk' }),
      zcashGetApi: async () => ({
        createPczt: workerCall,
        provePczt: workerCall,
        combinePczt: workerCall,
      }),
    });
    disablePrivacy();
    const operations = {
      create: () =>
        zcashCreatePczt(vault, {
          accountId: 'synthetic-account',
          toAddress: 'u1-recipient',
          valueZat: '85000',
          spendSource: 'ironwood',
        }),
      prove: () =>
        vault.zcashProvePczt({
          accountId: 'synthetic-account',
          pcztHex: 'aabb',
        }),
      combine: () =>
        vault.zcashCombineSignedPczt({
          accountId: 'synthetic-account',
          originalPcztHex: 'aabb',
          signedPcztHex: 'ccdd',
        }),
    };
    const pending = operations[operation]();
    await expect(pending).rejects.toThrow(ETranslations.global_not_available);
    expect(workerCall).not.toHaveBeenCalled();
  },
);
