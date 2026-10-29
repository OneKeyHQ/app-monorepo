// cspell:ignore randMult
/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance');

import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import { EHardwareCallContext } from '@onekeyhq/shared/types/device';

import { getViewingKeyFingerprint } from '../../localWallet/viewingKeyFingerprint';

import { KeyringHardware } from './KeyringHardware';
import Vault from './Vault';

import type { IEncodedTxXmr } from './types';

// A hardware account's send: key images from the device before building, a
// device plan instead of `signableHex`, and broadcast verified against it.

const ACCOUNT_ID = "hw-1--m/44'/128'/0'";
const VIEWING_KEY = 'aa:bb';
const VK_FP = getViewingKeyFingerprint({
  networkId: 'xmr--0',
  viewingKey: VIEWING_KEY,
});
const PRIMARY =
  '468bCTr2Sa9AR2hJ4aBuQu4JkQtLWx6qe6NZWxW7wkcCVG7rLxNagUPdcsB4DJZi3t5TY8grqUfmaW38vHxQimo9SV2g7TZ';
const RECIPIENT =
  '4AdUndXHHZ6cfufTMvppY6JwXNouMBzSkbLYfpAV5Usx3skxNgYeYTRj5UzqtReoS44qo9mtmXCqY45DJ852K5Jv2684Rge';
const LIVE_TIP = 3_767_827;
const PRIVACY_EPOCH = '01'.repeat(8);
const DEVICE_PLAN = '{"version":1,"inputs":"private"}';
const deviceParams = {
  dbDevice: { connectId: 'connect-1', deviceId: 'device-1' },
  deviceCommonParams: {},
};
const transfer = {
  outputId: 11,
  outKey: 'aa'.repeat(32),
  txPubKey: 'bb'.repeat(32),
  additionalTxPubKey: null,
  internalOutputIndex: 0,
  subAddrMajor: 0,
  subAddrMinor: 0,
};

function createHardwareVault({
  outputsWithoutKeyImage = 0,
}: { outputsWithoutKeyImage?: number } = {}) {
  let missing = outputsWithoutKeyImage;
  const runtime = {
    listAccounts: async () =>
      JSON.stringify({ items: [{ accountId: 7, uuid: VK_FP }] }),
    chainTip: async () => JSON.stringify({ height: LIVE_TIP }),
    balance: jest.fn(async () =>
      JSON.stringify({ outputsWithoutKeyImage: missing }),
    ),
    exportKeyImageSyncData: jest.fn(async () =>
      JSON.stringify({ items: missing ? [transfer] : [] }),
    ),
    importDeviceKeyImages: jest.fn(async () => {
      missing = 0;
      return JSON.stringify({ imported: 1, spendsFound: 0 });
    }),
    prepareTransaction: jest.fn(),
    prepareDeviceTransaction: jest.fn(
      async (_accountId: string, recipientsJson: string) =>
        JSON.stringify({
          devicePlan: DEVICE_PLAN,
          feeAtomic: '30000000',
          amountAtomic: (
            JSON.parse(recipientsJson) as { amountAtomic: string }[]
          )[0].amountAtomic,
          changeAtomic: '5000000',
          inputCount: 1,
        }),
    ),
    verifySignedTransaction: jest.fn(async () => 'deadbeef'),
    broadcastTransaction: jest.fn(async () =>
      JSON.stringify({ txid: 'deadbeef', broadcast: 'accepted' }),
    ),
  };
  const keyring = Object.assign(
    Object.create(KeyringHardware.prototype) as KeyringHardware,
    {
      xmrGetKeyImagesFromDevice: jest.fn(async () => [
        { keyImage: 'cc'.repeat(32), signature: 'dd'.repeat(64) },
      ]),
    },
  );
  const getWalletDeviceParams = jest.fn(async () => deviceParams);
  const withHardwareProcessing = jest.fn(async (fn: () => Promise<unknown>) =>
    fn(),
  );
  const recordXmrSent = jest.fn(async () => undefined);
  const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
    accountId: ACCOUNT_ID,
    networkId: 'xmr--0',
    keyring,
    backgroundApi: {
      serviceCustomRpc: {
        ensureLocalWalletRemoteConfigLoaded: async () => undefined,
      },
      serviceAccount: { getWalletDeviceParams },
      serviceHardwareUI: { withHardwareProcessing },
      simpleDb: {
        privacyChainKeys: {
          getKey: async () => ({
            networkId: 'xmr--0',
            vkFp: VK_FP,
            sealed: { format: 'plain', value: VIEWING_KEY },
          }),
        },
        privacyChainState: {
          getXmrAccountState: async () => ({
            intent: 'on',
            epoch: PRIVACY_EPOCH,
            appliedEpoch: PRIVACY_EPOCH,
          }),
        },
        privacyChainXmrSent: { recordXmrSent },
      },
    },
  });

  jest.spyOn(vault, 'getXmrRuntimeApi').mockResolvedValue(runtime as never);
  jest.spyOn(vault, 'getLocalWalletCapability').mockReturnValue({
    syncPolicy: { sendMaxBlocksLeft: 100 },
    getSyncProgress: async () => ({
      isBackfillComplete: true,
      backfillScannedHeight: LIVE_TIP,
      backfillTargetHeight: LIVE_TIP,
      tipScannedHeight: LIVE_TIP,
      chainTip: LIVE_TIP,
      tipLag: 0,
    }),
  } as never);
  jest.spyOn(vault, 'getAccount').mockResolvedValue({
    address: PRIMARY,
  } as never);
  jest.spyOn(vault, 'getNetwork').mockResolvedValue({
    decimals: 12,
    symbol: 'XMR',
    isTestnet: false,
    feeMeta: { decimals: 12, symbol: 'XMR' },
  } as never);
  jest.spyOn(vault, 'validateAddress').mockImplementation(async (address) => ({
    isValid: address.startsWith('4'),
    normalizedAddress: address,
    displayAddress: address,
  }));

  return {
    vault,
    runtime,
    keyring,
    getWalletDeviceParams,
    withHardwareProcessing,
    recordXmrSent,
  };
}

async function build(vault: Vault) {
  const unsignedTx = await vault.buildUnsignedTx({
    transfersInfo: [{ from: PRIMARY, to: RECIPIENT, amount: '0.001' }],
  } as never);
  return unsignedTx.encodedTx as IEncodedTxXmr;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('xmr hardware send: building', () => {
  it('syncs missing key images on the device, then prepares a device plan', async () => {
    const {
      vault,
      runtime,
      keyring,
      getWalletDeviceParams,
      withHardwareProcessing,
    } = createHardwareVault({ outputsWithoutKeyImage: 1 });

    const encodedTx = await build(vault);

    expect(getWalletDeviceParams).toHaveBeenCalledWith({
      walletId: 'hw-1',
      hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
    });
    expect(withHardwareProcessing).toHaveBeenCalledWith(expect.any(Function), {
      deviceParams,
      debugMethodName: 'xmr.syncKeyImagesBeforeSend',
    });
    expect(keyring.xmrGetKeyImagesFromDevice).toHaveBeenCalledWith({
      deviceParams,
      transfers: [transfer],
    });
    expect(
      runtime.importDeviceKeyImages.mock.invocationCallOrder[0],
    ).toBeLessThan(
      runtime.prepareDeviceTransaction.mock.invocationCallOrder[0],
    );
    expect(runtime.prepareTransaction).not.toHaveBeenCalled();
    expect(runtime.prepareDeviceTransaction).toHaveBeenCalledWith(
      '7',
      stringUtils.stableStringify([
        { address: RECIPIENT, amountAtomic: '1000000000' },
      ]),
      false,
      String(LIVE_TIP),
      'normal',
    );
    expect(encodedTx).toMatchObject({
      devicePlanJson: DEVICE_PLAN,
      feeAtomic: '30000000',
      changeAtomic: '5000000',
      inputCount: 1,
    });
    expect(encodedTx).not.toHaveProperty('signableHex');
    expect(encodedTx).not.toHaveProperty('devicePlan');
  });

  it('does not reach for the device when every output has a key image', async () => {
    const { vault, runtime, withHardwareProcessing } = createHardwareVault();

    await expect(build(vault)).resolves.toMatchObject({
      devicePlanJson: DEVICE_PLAN,
    });
    expect(withHardwareProcessing).not.toHaveBeenCalled();
    expect(runtime.prepareDeviceTransaction).toHaveBeenCalledTimes(1);
  });

  it('prepares nothing when the device key image sync fails', async () => {
    const { vault, runtime, withHardwareProcessing } = createHardwareVault({
      outputsWithoutKeyImage: 1,
    });
    withHardwareProcessing.mockRejectedValueOnce(
      new Error('Action cancelled by user'),
    );

    await expect(build(vault)).rejects.toThrow('Action cancelled by user');
    expect(runtime.prepareDeviceTransaction).not.toHaveBeenCalled();
  });
});

describe('xmr hardware send: broadcast', () => {
  const signedEncodedTx: IEncodedTxXmr = {
    privacyEpoch: PRIVACY_EPOCH,
    from: PRIMARY,
    to: RECIPIENT,
    amount: '0.001',
    amountAtomic: '1000000000',
    feeAtomic: '30000000',
    changeAtomic: '5000000',
    inputCount: 1,
    priority: 'normal',
    devicePlanJson: DEVICE_PLAN,
    chainTip: LIVE_TIP,
  };

  it('verifies and broadcasts against the device plan in place of the signable', async () => {
    const { vault, runtime, recordXmrSent } = createHardwareVault();

    await expect(
      vault.broadcastTransaction({
        signedTx: {
          txid: 'deadbeef',
          rawTx: '00ff',
          encodedTx: signedEncodedTx,
        },
      } as never),
    ).resolves.toMatchObject({ txid: 'deadbeef' });

    const reviewJson = stringUtils.stableStringify({
      network: 'mainnet',
      fromAddress: PRIMARY,
      toAddress: RECIPIENT,
      amountAtomic: '1000000000',
      feeAtomic: '30000000',
      changeAtomic: '5000000',
      isMaxSend: false,
    });
    expect(runtime.verifySignedTransaction).toHaveBeenCalledWith(
      DEVICE_PLAN,
      reviewJson,
      '00ff',
    );
    expect(runtime.broadcastTransaction).toHaveBeenCalledWith(
      '7',
      '00ff',
      String(LIVE_TIP),
      '1030000000',
      '5000000',
      DEVICE_PLAN,
      reviewJson,
    );
    // Recorded at signing.
    expect(recordXmrSent).not.toHaveBeenCalled();
  });

  it('records who was paid and the sealed tx keys at signing, never the plan', async () => {
    const { vault, keyring, recordXmrSent } = createHardwareVault();
    const device = {
      salt: '11'.repeat(32),
      randMult: '12'.repeat(32),
      txEncKeys: 'ab'.repeat(76),
      txPrefixHash: '56'.repeat(32),
    };
    jest.spyOn(keyring, 'signTransaction').mockResolvedValue({
      txid: 'deadbeef',
      rawTx: '00ff',
      encodedTx: signedEncodedTx,
      xmrSentTxKeys: { device },
    });

    const signed = await vault.signTransaction({
      unsignedTx: { encodedTx: signedEncodedTx },
    } as never);

    expect(signed).not.toHaveProperty('xmrSentTxKeys');
    expect(recordXmrSent).toHaveBeenCalledWith({
      accountId: ACCOUNT_ID,
      txid: 'deadbeef',
      recipient: RECIPIENT,
      amountAtomic: '1000000000',
      feeAtomic: '30000000',
      txKeys: { device },
    });
  });

  it('does not broadcast when verification against the plan fails', async () => {
    const { vault, runtime } = createHardwareVault();
    runtime.verifySignedTransaction.mockRejectedValueOnce(
      new Error('device output mismatch'),
    );

    await expect(
      vault.broadcastTransaction({
        signedTx: {
          txid: 'deadbeef',
          rawTx: '00ff',
          encodedTx: signedEncodedTx,
        },
      } as never),
    ).rejects.toThrow('device output mismatch');
    expect(runtime.broadcastTransaction).not.toHaveBeenCalled();
  });
});
