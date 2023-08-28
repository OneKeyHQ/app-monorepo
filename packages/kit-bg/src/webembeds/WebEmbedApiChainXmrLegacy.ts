import { Helper } from '@onekeyhq/engine/src/vaults/impl/xmr/sdk/helper';
import { getMoneroCoreInstance } from '@onekeyhq/engine/src/vaults/impl/xmr/sdk/moneroCore/instance';
import { getMoneroUtilInstance } from '@onekeyhq/engine/src/vaults/impl/xmr/sdk/moneroUtil/instance';
import type { IMoneroApiWebembed } from '@onekeyhq/engine/src/vaults/impl/xmr/sdk/types';
import { IMoneroApi } from '@onekeyhq/engine/src/vaults/impl/xmr/sdk/types';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

const getMoneroApi = memoizee(
  async () => {
    const moneroCoreInstance = await getMoneroCoreInstance();
    const moneroUtilInstance = await getMoneroUtilInstance();

    const helper = new Helper(moneroUtilInstance, moneroCoreInstance);

    return helper;
  },
  {
    promise: true,
  },
);

class WebEmbedApiChainXmrLegacy implements IMoneroApiWebembed {
  async getKeyPairFromRawPrivatekey({
    rawPrivateKey,
    index,
    isPrivateSpendKey,
  }: {
    rawPrivateKey: string;
    index?: number;
    isPrivateSpendKey?: boolean;
  }) {
    const moneroApi = await getMoneroApi();
    return moneroApi.getKeyPairFromRawPrivatekey({
      rawPrivateKey,
      isPrivateSpendKey,
      index,
    });
  }

  async generateKeyImage({
    txPublicKey,
    privateViewKey,
    privateSpendKey,
    publicSpendKey,
    outputIndex,
    address,
  }: {
    txPublicKey: string;
    privateViewKey: string;
    privateSpendKey: string;
    publicSpendKey: string;
    outputIndex: string;
    address: string;
  }) {
    const moneroApi = await getMoneroApi();
    return moneroApi.generateKeyImage({
      txPublicKey,
      privateViewKey,
      privateSpendKey,
      publicSpendKey,
      outputIndex,
      address,
    });
  }

  async seedAndkeysFromMnemonic({
    mnemonic,
    netType,
  }: {
    mnemonic: string;
    netType: string;
  }) {
    const moneroApi = await getMoneroApi();
    return moneroApi.seedAndkeysFromMnemonic({
      mnemonic,
      netType,
    });
  }

  async decodeAddress({
    address,
    netType,
  }: {
    address: string;
    netType: string;
  }) {
    const moneroApi = await getMoneroApi();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return moneroApi.decodeAddress({
      address,
      netType,
    });
  }

  async estimatedTxFee({
    priority,
    feePerByte,
  }: {
    priority: string;
    feePerByte: string;
  }) {
    const moneroApi = await getMoneroApi();
    return moneroApi.estimatedTxFee({
      priority,
      feePerByte,
    });
  }

  async sendFunds(args: any, scanUrl: string) {
    const moneroApi = await getMoneroApi();
    return moneroApi.sendFunds(args, scanUrl);
  }
}

export default WebEmbedApiChainXmrLegacy;
