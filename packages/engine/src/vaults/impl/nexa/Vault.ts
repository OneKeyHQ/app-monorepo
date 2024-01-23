import BigNumber from 'bignumber.js';
import memoizee from 'memoizee';

import { decrypt } from '@onekeyhq/engine/src/secret/encryptors/aes256';
import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { InvalidAddress, OneKeyInternalError } from '../../../errors';
import {
  type Account,
  AccountType,
  type DBAccount,
} from '../../../types/account';
import {
  type IClientEndpointStatus,
  type IDecodedTx,
  IDecodedTxActionType,
  IDecodedTxDirection,
  IDecodedTxStatus,
  type IEncodedTx,
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
  buildDecodeTxFromTx,
  estimateFee,
  estimateSize,
  getNexaNetworkInfo,
  publickeyToAddress,
  verifyNexaAddress,
  verifyNexaAddressPrefix,
} from './utils';

import type { BaseClient } from '../../../client/BaseClient';
import type { DBUTXOAccount } from '../../../types/account';
import type {
  PartialTokenInfo,
  TransactionStatus,
} from '../../../types/provider';
import type { Token } from '../../../types/token';
import type { KeyringSoftwareBase } from '../../keyring/KeyringSoftwareBase';
import type { IDecodedTxLegacy, IHistoryTx, ISignedTxPro } from '../../types';
import type { EVMDecodedItem } from '../evm/decoder/types';
import type { IEncodedTxNexa, INexaTransaction } from './types';

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

  override getFetchBalanceAddress(dbAccount: DBAccount): Promise<string> {
    return this.getDisplayAddress(dbAccount.address);
  }

  override async getOutputAccount(): Promise<Account> {
    const dbAccount = await this.getDbAccount({ noCache: true });
    const displayAddress =
      dbAccount.type === AccountType.SIMPLE
        ? dbAccount.address
        : await this.getDisplayAddress(dbAccount.address);
    return {
      id: dbAccount.id,
      name: dbAccount.name,
      type: dbAccount.type,
      path: dbAccount.path,
      coinType: dbAccount.coinType,
      tokens: [],
      address: displayAddress,
      displayAddress,
      template: dbAccount.template,
      pubKey: dbAccount.address,
    };
  }

  override async getAccountAddress(): Promise<string> {
    return (await this.getOutputAccount()).address;
  }

  override async getDisplayAddress(address: string): Promise<string> {
    if (verifyNexaAddressPrefix(address)) {
      return address;
    }
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
    if (this.settings.watchingAccountEnabled) {
      if (input.startsWith('nexa')) {
        return Promise.resolve(verifyNexaAddress(input).isValid);
      }
      return verifyNexaAddress(await this.getDisplayAddress(input)).isValid;
    }
    return Promise.resolve(false);
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
  }): Promise<IEncodedTxNexa> {
    const { btcFee } = params.feeInfoValue;
    if (btcFee) {
      params.encodedTx.gas = btcFee.toString();
    }
    return Promise.resolve(params.encodedTx);
  }

  override async decodeTx(
    encodedTx: IEncodedTxNexa,
    payload?: any,
  ): Promise<IDecodedTx> {
    const displayAddress = await this.getAccountAddress();
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

  override getNextNonce(): Promise<number> {
    return Promise.resolve(0);
  }

  override decodedTxToLegacy(): Promise<EVMDecodedItem> {
    return Promise.resolve({} as IDecodedTxLegacy);
  }

  override async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<IEncodedTxNexa> {
    const client = await this.getSDKClient();
    const fromNexaAddress = transferInfo.from;
    const utxos = (await client.getNexaUTXOs(fromNexaAddress)).filter(
      (value) => !value.has_token,
    );

    const network = await this.getNetwork();
    return {
      inputs: utxos.map((utxo) => ({
        txId: utxo.outpoint_hash,
        outputIndex: utxo.tx_pos,
        satoshis: new BigNumber(utxo.value).toFixed(),
        address: fromNexaAddress,
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
      transferInfo: {
        from: fromNexaAddress,
        to: transferInfo.to,
        amount: transferInfo.amount,
      },
    };
  }

  override buildEncodedTxFromApprove(): Promise<IEncodedTx> {
    throw new Error('Method not implemented.');
  }

  override updateEncodedTxTokenApprove(): Promise<IEncodedTx> {
    throw new Error('Method not implemented.');
  }

  override updateEncodedTx(encodedTx: IEncodedTxNexa): Promise<IEncodedTxNexa> {
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
    signOnly?: boolean,
    specifiedFeeRate?: string,
  ): Promise<IFeeInfo> {
    const network = await this.getNetwork();
    const client = await this.getSDKClient();
    const estimateSizedSize = estimateSize(encodedTx);
    const remoteEstimateFee = await client.estimateFee(estimateSizedSize);
    const localEstimateFee = estimateFee(encodedTx);
    const feeInfo = specifiedFeeRate
      ? estimateFee(encodedTx, Number(specifiedFeeRate))
      : Math.max(remoteEstimateFee, localEstimateFee);
    return {
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      feeSymbol: network.feeSymbol,
      feeDecimals: network.feeDecimals,
      prices: [new BigNumber(1).shiftedBy(-network.decimals).toFixed()],
      feeList: [feeInfo],
      defaultPresetIndex: '1',
      isBtcForkChain: true,
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

  override fetchTokenInfos(): Promise<(PartialTokenInfo | undefined)[]> {
    throw new Error('Method not implemented.');
  }

  override async broadcastTransaction(
    signedTx: ISignedTxPro,
  ): Promise<ISignedTxPro> {
    const client = await this.getSDKClient();
    await client.broadcastTransaction(signedTx.rawTx);
    return signedTx;
  }

  async buildDecodeTx(txHash: string): Promise<IDecodedTx | false> {
    const client = await this.getSDKClient();
    let tx: INexaTransaction;
    try {
      tx = await client.getTransaction(txHash);
    } catch (error) {
      // The result from Nexa Transaction API may be incomplete JSON, resulting in parsing failure.
      debugLogger.common.error(`Failed to fetch Nexa transaction. `, txHash);
      return false;
    }
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    const displayAddress = await this.getDisplayAddress(dbAccount.address);
    const { decimals } = await this.engine.getNetwork(this.networkId);
    const chainId = await this.getNetworkChainId();
    const network = getNexaNetworkInfo(chainId);
    const token: Token = await this.engine.getNativeTokenInfo(this.networkId);
    return buildDecodeTxFromTx({
      tx,
      dbAccountAddress: displayAddress,
      decimals,
      addressPrefix: network.prefix,
      token,
      networkId: this.networkId,
      accountId: this.accountId,
    });
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

    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    const client = await this.getSDKClient();
    const displayAddress = await this.getDisplayAddress(dbAccount.address);
    const onChainHistories = await client.getHistoryByAddress(displayAddress);
    return (
      await Promise.all(
        onChainHistories.map(async (history) => {
          const historyTxToMerge = localHistories.find(
            (item) => item.decodedTx.txid === history.tx_hash,
          );
          if (historyTxToMerge) {
            if (!historyTxToMerge.decodedTx.isFinal) {
              const decodedTx = await this.buildDecodeTx(history.tx_hash);
              if (decodedTx) {
                decodedTx.createdAt =
                  historyTxToMerge?.decodedTx.createdAt ?? decodedTx.createdAt;
                return this.buildHistoryTx({
                  decodedTx,
                  historyTxToMerge,
                });
              }
            }
            return historyTxToMerge;
          }
          const decodedTx = await this.buildDecodeTx(history.tx_hash);
          if (decodedTx) {
            return this.buildHistoryTx({
              decodedTx,
            });
          }
          return false;
        }),
      )
    ).filter(Boolean);
  }
}
