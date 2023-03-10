import { mnemonicFromEntropy } from '@onekeyfe/blockchain-libs/dist/secret';
import BigNumber from 'bignumber.js';
import { mnemonicToSeedSync } from 'bip39';
import memoizee from 'memoizee';

import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import { JsonRPCRequest } from '@onekeyhq/shared/src/request/JsonRPCRequest';

import { InvalidAddress, OneKeyInternalError } from '../../../errors';
import { isAccountCompatibleWithNetwork } from '../../../managers/account';
import { slicePathTemplate } from '../../../managers/derivation';
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
import { getDecodedTxStatus, getRawPrivateKeyFromSeed } from './utils';

import type { ExportedSeedCredential } from '../../../dbs/base';
import type {
  Account,
  DBAccount,
  DBVariantAccount,
} from '../../../types/account';
import type { IDecodedTx, IHistoryTx, ITransferInfo } from '../../types';
import type { IEncodedTxXmr, IOnChainHistoryTx } from './types';

export default class Vault extends VaultBase {
  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  rawPrivateKey = '';

  settings = settings;

  private getMoneroKeys = memoizee(
    async (password: string, index?: number) => {
      const moneroApi = await getMoneroApi();
      const dbAccount = (await this.getDbAccount({
        noCache: true,
      })) as DBVariantAccount;
      const { pathPrefix } = slicePathTemplate(dbAccount.template as string);
      let rawPrivateKey: string | Buffer;
      rawPrivateKey = this.rawPrivateKey;

      if (!rawPrivateKey) {
        const { entropy } = (await this.engine.dbApi.getCredential(
          this.walletId,
          password,
        )) as ExportedSeedCredential;

        const mnemonic = mnemonicFromEntropy(entropy, password);
        const seed = mnemonicToSeedSync(mnemonic);
        const resp = getRawPrivateKeyFromSeed(seed, pathPrefix);

        if (!resp) {
          throw new OneKeyInternalError('Unable to get raw private key.');
        }
        rawPrivateKey = resp;
        this.rawPrivateKey = resp.toString('hex');
      } else {
        rawPrivateKey = Buffer.from(rawPrivateKey, 'hex');
      }

      return moneroApi.getKeyPairFromRawPrivatekey({
        rawPrivateKey,
        index:
          index === undefined ? Number(dbAccount.path.split('/').pop()) : index,
      });
    },
    {
      max: 1,
      primitive: true,
      maxAge: getTimeDurationMs({ minute: 3 }),
      promise: true,
    },
  );

  private async getClient(password: string): Promise<ClientXmr> {
    // const rpcUrl = await this.getRpcUrl();
    const rpcUrl = 'https://node.onekey.so/xmr';
    const walletUrl = 'https://node.onekey.so/mymonero';
    const { publicSpendKey, publicViewKey, privateSpendKey, privateViewKey } =
      await this.getMoneroKeys(password);
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

  override async getExportedCredential(password: string): Promise<string> {
    const dbAccount = await this.getDbAccount();
    if (dbAccount.id.startsWith('hd-') || dbAccount.id.startsWith('imported')) {
      const moneroApi = await getMoneroApi();
      const { privateSpendKey } = await this.getMoneroKeys(password);

      return moneroApi.privateSpendKeyToWords(privateSpendKey);
    }
    throw new OneKeyInternalError(
      'Only credential of HD or imported accounts can be exported',
    );
  }

  override async validateAddress(address: string): Promise<string> {
    const moneroApi = await getMoneroApi();
    const network = await this.getNetwork();

    let isValid = false;

    try {
      const result = await moneroApi.decodeAddress(
        address,
        network.isTestnet ? 'TESTNET' : 'MAINNET',
      );

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (result.err_msg) {
        isValid = false;
      } else {
        isValid = true;
      }
    } catch {
      isValid = false;
    }
    const normalizedAddress = isValid ? address.toLowerCase() : undefined;

    if (!isValid || typeof normalizedAddress === 'undefined') {
      throw new InvalidAddress();
    }
    return Promise.resolve(normalizedAddress);
  }

  override async fetchOnChainHistory(options: {
    tokenIdOnNetwork?: string;
    localHistory: IHistoryTx[];
    password: string;
  }): Promise<IHistoryTx[]> {
    const { localHistory, password } = options;
    const client = await this.getClient(password);
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
    password: string,
  ): Promise<(BigNumber | undefined)[]> {
    const client = await this.getClient(password);
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
