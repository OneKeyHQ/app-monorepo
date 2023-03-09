import axios from 'axios';
import BigNumber from 'bignumber.js';
import memoizee from 'memoizee';

import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import { JsonRPCRequest } from '@onekeyhq/shared/src/request/JsonRPCRequest';

import { OneKeyInternalError } from '../../../errors';
import { isAccountCompatibleWithNetwork } from '../../../managers/account';
import {
  IDecodedTxActionType,
  IDecodedTxDirection,
  IDecodedTxStatus,
} from '../../types';
import { VaultBase } from '../../VaultBase';

import { ClientXmr } from './ClientXmr';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import { getMoneroApi } from './sdk';
import { MoneroNetTypeEnum } from './sdk/moneroUtil/moneroUtilTypes';
import settings from './settings';
import { getDecodedTxStatus } from './utils';

import type {
  Account,
  DBAccount,
  DBVariantAccount,
} from '../../../types/account';
import type { IDecodedTx, IHistoryTx } from '../../types';
import type { IOnChainHistoryTx } from './types';

export default class Vault extends VaultBase {
  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  settings = settings;

  private getMoneroKeys = memoizee(
    async (index?: number) => {
      const moneroApi = await getMoneroApi();
      const dbAccount = (await this.getDbAccount({
        noCache: true,
      })) as DBVariantAccount;
      const rawPrivateKey = Buffer.from(dbAccount.raw ?? '', 'hex');
      if (!rawPrivateKey) {
        throw new OneKeyInternalError('Unable to get raw private key.');
      }

      return moneroApi.getKeyPairFromRawPrivatekey({
        rawPrivateKey,
        index:
          index === undefined ? Number(dbAccount.path.split('/').pop()) : index,
      });
    },
    {
      max: 5,
      primitive: true,
      maxAge: getTimeDurationMs({ minute: 3 }),
      promise: true,
    },
  );

  private async getClient(): Promise<ClientXmr> {
    // const rpcUrl = await this.getRpcUrl();
    const rpcUrl = 'https://node.onekey.so/xmr';
    const walletUrl = 'https://node.onekey.so/mymonero';
    const { publicSpendKey, publicViewKey, privateSpendKey, privateViewKey } =
      await this.getMoneroKeys();
    const { address } = await this.getOutputAccount();
    return this.createXmrClient(
      rpcUrl,
      walletUrl,
      address,
      Buffer.from(publicSpendKey || '').toString('hex'),
      Buffer.from(publicViewKey || '').toString('hex'),
      Buffer.from(privateSpendKey).toString('hex'),
      Buffer.from(privateViewKey).toString('hex'),
    );
  }

  private createXmrClient = memoizee(
    (
      rpcUrl: string,
      walletUrl: string,
      address: string,
      publicSpendKey: string,
      publicViewKey: string,
      privateSpendKey: string,
      privateViewKey: string,
    ) =>
      new ClientXmr({
        rpcUrl,
        walletUrl,
        address,
        publicSpendKey,
        publicViewKey,
        privateSpendKey,
        privateViewKey,
      }),
    {
      max: 1,
      primitive: true,
      maxAge: getTimeDurationMs({ minute: 3 }),
    },
  );

  override async getExportedCredential(): Promise<string> {
    const dbAccount = await this.getDbAccount();
    if (dbAccount.id.startsWith('hd-') || dbAccount.id.startsWith('imported')) {
      const moneroApi = await getMoneroApi();
      const { privateSpendKey } = await this.getMoneroKeys();

      return moneroApi.privateSpendKeyToWords(privateSpendKey);
    }
    throw new OneKeyInternalError(
      'Only credential of HD or imported accounts can be exported',
    );
  }

  override async fetchOnChainHistory(options: {
    tokenIdOnNetwork?: string;
    localHistory: IHistoryTx[];
  }): Promise<IHistoryTx[]> {
    const client = await this.getClient();
    const { localHistory } = options;
    const network = await this.getNetwork();

    const address = await this.getAccountAddress();
    const token = await this.engine.getNativeTokenInfo(this.networkId);
    let txs: IOnChainHistoryTx[] = [];
    try {
      txs = await client.getHistory(address);
    } catch (e) {
      console.error(e);
    }

    const currentHeight = await client.getCurrentHeight();

    const promises = txs.map(async (tx) => {
      try {
        const historyTxToMerge = localHistory.find(
          (item) => item.decodedTx.txid === tx.hash,
        );
        if (historyTxToMerge && historyTxToMerge.decodedTx.isFinal) {
          return null;
        }

        const amountBN = new BigNumber(tx.amount);

        let from = '';
        let to = '';
        let direction = IDecodedTxDirection.OTHER;
        const isIn = amountBN.isPositive();

        if (isIn) {
          direction = IDecodedTxDirection.IN;
          from = 'unknown';
          to = address;
        } else {
          direction = IDecodedTxDirection.OUT;
          from = address;
          to = 'unknown';
        }

        const decodedTx: IDecodedTx = {
          txid: tx.hash ?? '',
          owner: isIn ? 'unknown' : address,
          signer: isIn ? 'unknown' : address,
          nonce: 0,
          actions: [
            {
              type: IDecodedTxActionType.NATIVE_TRANSFER,
              direction,
              nativeTransfer: {
                tokenInfo: token,
                from,
                to,
                amount: amountBN.shiftedBy(-token.decimals).abs().toFixed(),
                amountValue: amountBN.abs().toFixed(),
                extraInfo: null,
              },
            },
          ],
          status: getDecodedTxStatus(tx, currentHeight),
          totalFeeInNative:
            tx.fee === undefined
              ? undefined
              : new BigNumber(tx.fee).shiftedBy(-network.decimals).toFixed(),
          networkId: this.networkId,
          accountId: this.accountId,
          extraInfo: null,
        };
        decodedTx.updatedAt = new Date(tx.timestamp).getTime();
        decodedTx.createdAt =
          historyTxToMerge?.decodedTx.createdAt ?? decodedTx.updatedAt;
        decodedTx.isFinal = decodedTx.status === IDecodedTxStatus.Confirmed;
        return await this.buildHistoryTx({
          decodedTx,
          historyTxToMerge,
        });
      } catch (e) {
        console.error(e);
        return Promise.resolve(null);
      }
    });

    return (await Promise.all(promises)).filter(Boolean);
  }

  override async getOutputAccount(): Promise<Account> {
    const dbAccount = (await this.getDbAccount({
      noCache: true,
    })) as DBVariantAccount;
    const ret = {
      id: dbAccount.id,
      name: dbAccount.name,
      type: dbAccount.type,
      path: dbAccount.path,
      coinType: dbAccount.coinType,
      tokens: [],
      address: dbAccount.addresses?.[this.networkId] || '',
    };
    if (
      ret.address.length === 0 &&
      isAccountCompatibleWithNetwork(dbAccount.id, this.networkId)
    ) {
      try {
        const address = await this.addressFromBase(dbAccount);

        ret.address = address;

        await this.engine.dbApi.updateAccountAddresses(
          dbAccount.id,
          this.networkId,
          address,
        );
      } catch {
        // pass
      }
    }
    return ret;
  }

  override async getAccountAddress() {
    const { address } = await this.getOutputAccount();
    return address;
  }

  override async addressFromBase(account: DBVariantAccount) {
    const moneroApi = await getMoneroApi();
    const { isTestnet } = await this.getNetwork();
    const [publicSpendKey, publicViewKey] = account.pub.split(',');
    return moneroApi.pubKeysToAddress(
      isTestnet ? MoneroNetTypeEnum.TestNet : MoneroNetTypeEnum.MainNet,
      Number(account.path.split('/').pop()) !== 0,
      Buffer.from(publicSpendKey, 'hex'),
      Buffer.from(publicViewKey, 'hex'),
    );
  }

  override async getBalances(
    requests: Array<{ address: string; tokenAddress?: string }>,
  ): Promise<(BigNumber | undefined)[]> {
    const client = await this.getClient();
    if (requests.length > 1) return [];

    const [request] = requests;

    return client.getBalances([
      {
        address: request.address,
        coin: {},
      },
    ]);
  }

  override async getClientEndpointStatus(
    url: string,
  ): Promise<{ responseTime: number; latestBlock: number }> {
    const rpc = new JsonRPCRequest(`https://node.onekey.so/xmr/json_rpc`);
    const start = performance.now();
    const resp = await rpc.call('get_last_block_header');
    return {
      responseTime: Math.floor(performance.now() - start),
      latestBlock: 1,
    };
  }
}
