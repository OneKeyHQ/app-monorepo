import BigNumber from 'bignumber.js';
import memoizee from 'memoizee';

import { decrypt } from '@onekeyhq/engine/src/secret/encryptors/aes256';
import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';

import { InvalidAddress, OneKeyInternalError } from '../../../errors';
import {
  type IApproveInfo,
  type IClientEndpointStatus,
  type IDecodedTx,
  IDecodedTxActionType,
  IDecodedTxDirection,
  IDecodedTxStatus,
  type IEncodedTx,
  type IEncodedTxUpdateOptions,
  type IFeeInfo,
  type IFeeInfoUnit,
  type ITransferInfo,
  type IUnsignedTxPro,
} from '../../types';
import { VaultBase } from '../../VaultBase';

import {
  KeyringHardware,
  KeyringHd,
  KeyringImported,
  KeyringWatching,
} from './keyring';
import { Nexa } from './sdk';
import settings from './settings';
import {
  decodeScriptBufferToNexaAddress,
  estimateSize,
  getNexaNetworkInfo,
  publickeyToAddress,
  verifyNexaAddress,
} from './utils';

import type { BaseClient } from '../../../client/BaseClient';
import type {
  Account,
  AccountCredentialType,
  DBAccount,
  DBSimpleAccount,
} from '../../../types/account';
import type {
  PartialTokenInfo,
  TransactionStatus,
} from '../../../types/provider';
import type { Token } from '../../../types/token';
import type { KeyringSoftwareBase } from '../../keyring/KeyringSoftwareBase';
import type {
  IDecodedTxAction,
  IDecodedTxLegacy,
  IHistoryTx,
  ISignedTxPro,
} from '../../types';
import type { EVMDecodedItem } from '../evm/decoder/types';
import type { IEncodedTxNexa } from './types';

export default class Vault extends VaultBase {
  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  override settings = settings;

  override createClientFromURL(url: string): BaseClient {
    return new Nexa(url);
  }

  override async getOutputAccount(): Promise<Account> {
    const dbAccount = await this.getDbAccount({ noCache: true });
    return {
      id: dbAccount.id,
      name: dbAccount.name,
      type: dbAccount.type,
      path: dbAccount.path,
      coinType: dbAccount.coinType,
      tokens: [],
      address: dbAccount.address,
      displayAddress: await this.getDisplayAddress(dbAccount.address),
      template: dbAccount.template,
      pubKey: dbAccount.address,
    };
  }

  override async getDisplayAddress(address: string): Promise<string> {
    const chainId = await this.getNetworkChainId();
    return publickeyToAddress(Buffer.from(address, 'hex'), chainId);
  }

  override async addressFromBase(account: DBAccount): Promise<string> {
    const chainId = await this.getNetworkChainId();
    return publickeyToAddress(Buffer.from(account.address, 'hex'), chainId);
  }

  createSDKClient = memoizee(
    async (rpcUrl: string, networkId: string) => {
      const sdkClient = this.createClientFromURL(rpcUrl) as Nexa;
      const chainInfo =
        await this.engine.providerManager.getChainInfoByNetworkId(networkId);
      // TODO move to base, setChainInfo like what ProviderController.getClient() do
      sdkClient.setChainInfo(chainInfo);
      return sdkClient;
    },
    {
      promise: true,
      primitive: true,
      normalizer(
        args: Parameters<(rpcUrl: string, networkId: string) => Promise<Nexa>>,
      ): string {
        return `${args[0]}:${args[1]}`;
      },
      max: 1,
      maxAge: getTimeDurationMs({ seconds: 15 }),
    },
  );

  async getSDKClient(): Promise<Nexa> {
    const { rpcURL } = await this.getNetwork();
    return this.createSDKClient(rpcURL, this.networkId);
  }

  override async getClientEndpointStatus(): Promise<IClientEndpointStatus> {
    const client = await this.getSDKClient();
    const start = performance.now();
    const latestBlock = (await client.getInfo()).bestBlockNumber;
    return { responseTime: Math.floor(performance.now() - start), latestBlock };
  }

  override async validateWatchingCredential(input: string): Promise<boolean> {
    // Generic address test, override if needed.
    return Promise.resolve(
      this.settings.watchingAccountEnabled && verifyNexaAddress(input).isValid,
    );
  }

  override async validateAddress(address: string): Promise<string> {
    const { isValid, normalizedAddress } = verifyNexaAddress(address);
    if (isValid) {
      return Promise.resolve(normalizedAddress || address);
    }
    return Promise.reject(new InvalidAddress());
  }

  override async getBalances(
    requests: Array<{ address: string; tokenAddress?: string }>,
  ): Promise<Array<BigNumber | undefined>> {
    // Abstract requests
    const client = await this.getSDKClient();
    const displayAddresses = await Promise.all(
      requests.map(({ address }) => this.getDisplayAddress(address)),
    );
    return client.getBalances(
      requests.map(({ tokenAddress }, index) => ({
        address: displayAddresses[index],
        coin: { ...(typeof tokenAddress === 'string' ? { tokenAddress } : {}) },
      })),
    );
  }

  override async attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTxNexa;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<IEncodedTx> {
    const { limit, price } = params.feeInfoValue;
    if (limit && price) {
      const network = await this.getNetwork();
      params.encodedTx.gas = new BigNumber(limit)
        .multipliedBy(price)
        .shiftedBy(network.decimals)
        .toFixed();
    }
    return params.encodedTx;
  }

  override async decodeTx(
    encodedTx: IEncodedTxNexa,
    payload?: any,
  ): Promise<IDecodedTx> {
    const address = await this.getAccountAddress();
    const displayAddress = await this.getDisplayAddress(address);
    const amountValue = encodedTx.outputs.reduce(
      (acc, cur) => acc.plus(new BigNumber(cur.satoshis)),
      new BigNumber(0),
    );

    const token: Token = await this.engine.getNativeTokenInfo(this.networkId);
    const action = {
      type: IDecodedTxActionType.TOKEN_TRANSFER,
      direction: IDecodedTxDirection.OUT,
      tokenTransfer: {
        tokenInfo: token,
        from: displayAddress,
        to: encodedTx.outputs[0].address,
        amount: amountValue.shiftedBy(-token.decimals).toFixed(),
        amountValue: amountValue.toString(),
        extraInfo: null,
      },
    };
    const decodedTx: IDecodedTx = {
      txid: '',
      owner: displayAddress,
      signer: displayAddress,
      networkId: this.networkId,
      accountId: this.accountId,
      encodedTx,
      payload,
      extraInfo: null,
      nonce: 0,
      actions: [action],
      status: IDecodedTxStatus.Pending,
    };

    return decodedTx;
  }

  override getNextNonce(
    networkId: string,
    dbAccount: DBAccount,
  ): Promise<number> {
    return Promise.resolve(0);
  }

  override decodedTxToLegacy(decodedTx: IDecodedTx): Promise<EVMDecodedItem> {
    return Promise.resolve({} as IDecodedTxLegacy);
  }

  override async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<IEncodedTxNexa> {
    const client = await this.getSDKClient();
    const utxos = await client.getNexaUTXOs(transferInfo.from);
    const network = await this.getNetwork();
    return {
      inputs: utxos.map((utxo) => ({
        txId: utxo.outpoint_hash,
        outputIndex: utxo.tx_pos,
        satoshis: new BigNumber(utxo.value).toFixed(),
        address: transferInfo.from,
      })),
      outputs: [
        {
          address: transferInfo.to,
          satoshis: new BigNumber(transferInfo.amount)
            .shiftedBy(network.decimals)
            .toFixed(),
          outType: 1,
        },
      ],
      transferInfo,
    };
  }

  override buildEncodedTxFromApprove(
    approveInfo: IApproveInfo,
  ): Promise<IEncodedTx> {
    throw new Error('Method not implemented.');
  }

  override updateEncodedTxTokenApprove(
    encodedTx: IEncodedTx,
    amount: string,
  ): Promise<IEncodedTx> {
    throw new Error('Method not implemented.');
  }

  override updateEncodedTx(
    encodedTx: IEncodedTxNexa,
    payload: any,
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTxNexa> {
    return Promise.resolve(encodedTx);
  }

  override buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTxNexa,
  ): Promise<IUnsignedTxPro> {
    return Promise.resolve({
      inputs: [],
      outputs: [],
      payload: { encodedTx },
      encodedTx,
    });
  }

  override async getTransactionStatuses(
    txids: string[],
  ): Promise<(TransactionStatus | undefined)[]> {
    const client = await this.getSDKClient();
    return client.getTransactionStatuses(txids);
  }

  override async fetchFeeInfo(
    encodedTx: IEncodedTxNexa,
    signOnly?: boolean | undefined,
    specifiedFeeRate?: string | undefined,
    transferCount?: number | undefined,
  ): Promise<IFeeInfo> {
    const network = await this.getNetwork();
    const client = await this.getSDKClient();
    const estimateSizedSize = estimateSize(encodedTx);
    const feeInfo = await client.estimateFee(estimateSizedSize);
    return {
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      feeSymbol: network.feeSymbol,
      feeDecimals: network.feeDecimals,
      limit: new BigNumber(feeInfo.toString()).toFixed(),
      prices: [new BigNumber(1).shiftedBy(-network.decimals).toFixed()],
      defaultPresetIndex: '1',
      tx: null,
    };
  }

  override async getExportedCredential(password: string): Promise<string> {
    const dbAccount = await this.getDbAccount();
    if (dbAccount.id.startsWith('hd-') || dbAccount.id.startsWith('imported')) {
      const keyring = this.keyring as KeyringSoftwareBase;
      const [encryptedPrivateKey] = Object.values(
        await keyring.getPrivateKeys(password),
      );
      return decrypt(password, encryptedPrivateKey).toString('hex');
    }
    throw new OneKeyInternalError(
      'Only credential of HD or imported accounts can be exported',
    );
  }

  override fetchTokenInfos(
    tokenAddresses: string[],
  ): Promise<(PartialTokenInfo | undefined)[]> {
    throw new Error('Method not implemented.');
  }

  override async broadcastTransaction(
    signedTx: ISignedTxPro,
    options?: any,
  ): Promise<ISignedTxPro> {
    const client = await this.getSDKClient();
    await client.broadcastTransaction(signedTx.rawTx);
    return signedTx;
  }

  override async fetchOnChainHistory(options: {
    tokenIdOnNetwork?: string | undefined;
    localHistory?: IHistoryTx[] | undefined;
    password?: string | undefined;
    passwordLoadedCallback?: ((isLoaded: boolean) => void) | undefined;
  }): Promise<IHistoryTx[]> {
    const { tokenIdOnNetwork, localHistory: localHistories = [] } = options;
    if (tokenIdOnNetwork) {
      return Promise.resolve([]);
    }

    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;
    const { decimals } = await this.engine.getNetwork(this.networkId);
    const client = await this.getSDKClient();
    const onChainHistories = await client.getHistoryByAddress(
      dbAccount.address,
    );
    return (
      await Promise.all(
        onChainHistories.map(async (history) => {
          const historyTxToMerge = localHistories.find(
            (item) => item.decodedTx.txid === history.tx_hash,
          );
          if (historyTxToMerge && !historyTxToMerge.decodedTx.isFinal) {
            const tx = await client.getTransaction(history.tx_hash);
            let action: IDecodedTxAction = {
              type: IDecodedTxActionType.UNKNOWN,
            };

            const chainId = await this.getNetworkChainId();
            const network = getNexaNetworkInfo(chainId);
            const from = decodeScriptBufferToNexaAddress(
              Buffer.from(tx.vin[0].scriptSig.hex, 'hex'),
              network.prefix,
            );
            const to = decodeScriptBufferToNexaAddress(
              Buffer.from(tx.vout[0].scriptPubKey.hex, 'hex'),
              network.prefix,
            );

            const tokenAddress = dbAccount.address;
            const amountValue = tx.vout.reduce((acc, cur) => {
              if (
                decodeScriptBufferToNexaAddress(
                  Buffer.from(cur.scriptPubKey.hex, 'hex'),
                  network.prefix,
                ) !== tokenAddress
              ) {
                return acc.plus(new BigNumber(cur.value_satoshi));
              }
              return acc;
            }, new BigNumber(0));
            if (amountValue && tokenAddress) {
              let direction = IDecodedTxDirection.IN;
              if (from === dbAccount.address) {
                direction =
                  to === dbAccount.address
                    ? IDecodedTxDirection.SELF
                    : IDecodedTxDirection.OUT;
              }

              const actionType = IDecodedTxActionType.TOKEN_TRANSFER;
              const token: Token = await this.engine.getNativeTokenInfo(
                this.networkId,
              );
              const actionKey = 'tokenTransfer';

              action = {
                type: actionType,
                direction,
                [actionKey]: {
                  tokenInfo: token,
                  from,
                  to,
                  amount: amountValue.shiftedBy(-token.decimals).toFixed(),
                  amountValue: amountValue.toString(),
                  extraInfo: null,
                },
              };
            }
            const decodedTx: IDecodedTx = {
              txid: history.tx_hash,
              owner: dbAccount.address,
              signer: dbAccount.address,
              nonce: 0,
              actions: [action],
              status: tx.confirmations
                ? IDecodedTxStatus.Confirmed
                : IDecodedTxStatus.Pending,
              networkId: this.networkId,
              accountId: this.accountId,
              encodedTx: {
                from: dbAccount.address,
                to: '',
                value: '',
                data: tx.hex,
              },
              extraInfo: null,
              totalFeeInNative: new BigNumber(tx.fee_satoshi)
                .shiftedBy(-decimals)
                .toFixed(),
            };
            decodedTx.updatedAt = tx.time ? tx.time * 1000 : Date.now();
            decodedTx.createdAt =
              historyTxToMerge?.decodedTx.createdAt ?? decodedTx.updatedAt;
            decodedTx.isFinal = decodedTx.status === IDecodedTxStatus.Confirmed;
            return this.buildHistoryTx({
              decodedTx,
              historyTxToMerge,
            });
          }
        }),
      )
    ).filter(Boolean);
  }
}
