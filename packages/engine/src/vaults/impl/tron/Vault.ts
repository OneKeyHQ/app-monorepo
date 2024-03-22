/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { defaultAbiCoder } from '@ethersproject/abi';
import axios from 'axios';
import BigNumber from 'bignumber.js';
import { find, map, reduce, uniq } from 'lodash';
import TronWeb from 'tronweb';

import { decrypt } from '@onekeyhq/engine/src/secret/encryptors/aes256';
import type { FeePricePerUnit } from '@onekeyhq/engine/src/types/provider';
import { TransactionStatus } from '@onekeyhq/engine/src/types/provider';
import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import { toBigIntHex } from '@onekeyhq/shared/src/engine/engineUtils';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import { fromBigIntHex } from '@onekeyhq/shared/src/utils/numberUtils';

import { getTronScanEndpoint } from '../../../endpoint';
import {
  InsufficientBalance,
  InvalidAddress,
  NotImplemented,
  OneKeyInternalError,
} from '../../../errors';
import { batchTransferContractAddress } from '../../../presets/batchTransferContractAddress';
import { extractResponseError } from '../../../proxy';
import {
  BatchTransferMethods,
  BatchTransferSelectors,
} from '../../../types/batchTransfer';
import { IDecodedTxActionType, IDecodedTxStatus } from '../../types';
import { VaultBase } from '../../VaultBase';
import { Erc20MethodSelectors } from '../evm/decoder/abi';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';

import type { DBSimpleAccount } from '../../../types/account';
import type { KeyringSoftwareBase } from '../../keyring/KeyringSoftwareBase';
import type {
  IApproveInfo,
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxLegacy,
  IEncodedTx,
  IEncodedTxUpdateOptions,
  IEncodedTxUpdatePayloadTransfer,
  IFeeInfo,
  IFeeInfoUnit,
  IHistoryTx,
  ISignedTxPro,
  ITransferInfo,
  IUnsignedTxPro,
} from '../../types';
import type {
  IEncodedTxTron,
  IOnChainInternalTxHistory,
  IOnChainTransferHistory,
  IOnChainTxHistory,
  IRPCCallResponse,
  ITRC10Detail,
  ITRC20Detail,
  ITokenDetail,
} from './types';
import type { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';

const FAKE_OWNER_ADDRESS = 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb';
const SIGNATURE_LENGTH = 65;
const TX_RESULT_SIZE = 64;
const TX_SIZE_OVERHEAD = 5; // 1 byte raw_data key, 1 byte signature key, 1 byte signature number, 1 byte signature data length for 65 bytes, 1 byte tx result key. TODO: multisign support.
const INFINITE_AMOUNT_HEX =
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
const MAX_FEE_LIMIT = 15000000000;
const BATCH_TRANSFER_PARAMS_REGEX = /\(([^)]+)\)/;

export default class Vault extends VaultBase {
  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  settings = settings;

  // client: axios
  private getTronWeb = memoizee(
    (rpcURL) => {
      const tronWeb = new TronWeb({ fullHost: rpcURL });
      tronWeb.setAddress(FAKE_OWNER_ADDRESS);
      return tronWeb;
    },
    {
      promise: true,
      max: 3,
      maxAge: getTimeDurationMs({ minute: 3 }),
    },
  );

  private getApiExplorerCache = memoizee(
    // eslint-disable-next-line @typescript-eslint/require-await
    async (baseURL) => axios.create({ baseURL }),
    {
      primitive: true,
      promise: true,
      max: 1,
      maxAge: getTimeDurationMs({ minute: 3 }),
    },
  );

  async getApiExplorer() {
    return this.getApiExplorerCache(getTronScanEndpoint());
  }

  public async getClient() {
    const { rpcURL } = await this.engine.getNetwork(this.networkId);
    return this.getTronWeb(rpcURL);
  }

  getTokenInfo = memoizee(
    async (tokenAddress) => {
      const apiExplorer = await this.getApiExplorer();
      const isTrc10 = new BigNumber(tokenAddress).isInteger();
      const path = isTrc10 ? 'api/token' : 'api/token_trc20';
      const params = isTrc10
        ? { id: tokenAddress }
        : { contract: tokenAddress };

      try {
        const resp = await apiExplorer.get(path, {
          params,
        });

        if (isTrc10) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          const tokenInfo: ITRC10Detail = resp.data.data?.[0];
          const { total } = resp.data;
          // invalidate trc10 tokenid will return total greater than 1
          if (tokenInfo && total === 1) {
            return {
              name: tokenInfo.name,
              symbol: tokenInfo.abbr,
              decimals: tokenInfo.precision,
              logoURI: tokenInfo.imgUrl,
            };
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const tokenInfo: ITRC20Detail = resp.data.trc20_tokens?.[0];
        if (tokenInfo) {
          return {
            name: tokenInfo.name,
            symbol: tokenInfo.symbol,
            decimals: tokenInfo.decimals,
            logoURI: tokenInfo.icon_url,
          };
        }
      } catch {
        // pass
      }
    },
    { promise: true, max: 100, maxAge: getTimeDurationMs({ minute: 3 }) },
  );

  getParameters = memoizee(
    async () => {
      const tronWeb = await this.getClient();
      return Object.fromEntries(
        (await tronWeb.trx.getChainParameters()).map(({ key, value }) => [
          key,
          value,
        ]),
      );
    },
    { promise: true, maxAge: getTimeDurationMs({ minute: 3 }) },
  );

  async getAccountTokens(address: string) {
    try {
      const apiExplorer = await this.getApiExplorer();
      const resp = await apiExplorer.get<{ data: ITokenDetail[] }>(
        'api/account/tokens',
        {
          params: {
            address,
          },
        },
      );

      const tokens = resp?.data?.data || [];
      return tokens;
    } catch {
      // pass
    }
  }

  async getConsumableResource(address: string) {
    const tronWeb = await this.getClient();
    const {
      freeNetUsed = 0,
      freeNetLimit = 0,
      NetUsed: netUsed = 0,
      NetLimit: netLimit = 0,
      EnergyUsed: energyUsed = 0,
      EnergyLimit: energyLimit = 0,
    } = await tronWeb.trx.getAccountResources(address);
    return {
      freeBandwidth: freeNetLimit - freeNetUsed,
      stakedBandwidth: netLimit - netUsed,
      stakedEnergy: energyLimit - energyUsed,
    };
  }

  // Chain only methods

  override async getClientEndpointStatus(
    url: string,
  ): Promise<{ responseTime: number; latestBlock: number }> {
    const tronWeb = this.getTronWeb(url);
    const start = performance.now();
    const {
      result: { number: blockNumber },
    } = await tronWeb.fullNode.request(
      'jsonrpc',
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBlockByNumber',
        params: ['latest', false],
      },
      'post',
    );
    const latestBlock = parseInt(blockNumber);
    return { responseTime: Math.floor(performance.now() - start), latestBlock };
  }

  override async fetchTokenInfos(tokenAddresses: string[]) {
    return Promise.all(
      tokenAddresses.map(async (tokenAddress) => {
        try {
          return await this.getTokenInfo(tokenAddress);
        } catch {
          // pass
        }
      }),
    );
  }

  override async validateAddress(address: string) {
    if (new BigNumber(address).isInteger()) {
      const tokenInfo = await this.getTokenInfo(address);
      if (tokenInfo) {
        return address;
      }
      return Promise.reject(new InvalidAddress());
    }

    if (TronWeb.isAddress(address)) {
      return Promise.resolve(TronWeb.address.fromHex(address));
    }
    return Promise.reject(new InvalidAddress());
  }

  override validateWatchingCredential(input: string) {
    return Promise.resolve(
      this.settings.watchingAccountEnabled && TronWeb.isAddress(input),
    );
  }

  override validateTokenAddress(address: string): Promise<string> {
    return this.validateAddress(address);
  }

  override async checkAccountExistence(address: string): Promise<boolean> {
    const tronWeb = await this.getClient();
    const { address: hexAddress } = await tronWeb.trx.getAccount(address);
    return typeof hexAddress !== 'undefined';
  }

  override async getBalances(
    requests: Array<{ address: string; tokenAddress?: string }>,
  ) {
    const addresses = uniq(map(requests, 'address'));
    const tokens = await Promise.all(
      addresses.map(async (address) => {
        try {
          const accountTokens = await this.getAccountTokens(address);
          if (accountTokens) {
            return {
              address,
              tokens: accountTokens,
            };
          }
          return null;
        } catch {
          return null;
        }
      }),
    );

    return requests.map((request) => {
      const { address, tokenAddress } = request;

      const accountTokens = find(tokens, { address })?.tokens || [];

      const token = find(accountTokens, { tokenId: tokenAddress ?? '_' });

      if (token) {
        return new BigNumber(token.balance ?? 0);
      }

      return new BigNumber(0);
    });
  }

  override async getTransactionStatuses(
    txids: Array<string>,
  ): Promise<Array<TransactionStatus | undefined>> {
    const tronWeb = await this.getClient();
    return Promise.all(
      txids.map((txid) =>
        tronWeb.trx.getConfirmedTransaction(txid).then(
          ({ ret: [{ contractRet = '' }] }) =>
            contractRet === 'SUCCESS'
              ? TransactionStatus.CONFIRM_AND_SUCCESS
              : TransactionStatus.CONFIRM_BUT_FAILED,
          (e) =>
            e === 'Transaction not found'
              ? tronWeb.trx.getTransaction(txid).then(
                  () => TransactionStatus.PENDING,
                  (e2) =>
                    e2 === 'Transaction not found'
                      ? TransactionStatus.NOT_FOUND
                      : undefined,
                )
              : undefined,
        ),
      ),
    );
  }

  // TODO isContractAddress

  // Account related methods

  override attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTx;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<IEncodedTx> {
    return Promise.resolve(params.encodedTx);
  }

  override async decodeTx(
    uncastedEncodedTx: IEncodedTx,
    _payload?: any,
  ): Promise<IDecodedTx> {
    const encodedTx: IEncodedTxTron = uncastedEncodedTx as IEncodedTxTron;
    let action: IDecodedTxAction = { type: IDecodedTxActionType.UNKNOWN };
    if (encodedTx.raw_data.contract[0].type === 'TransferContract') {
      const {
        amount,
        owner_address: fromAddressHex,
        to_address: toAddressHex,
      } = encodedTx.raw_data.contract[0].parameter.value;
      const nativeToken = await this.engine.getNativeTokenInfo(this.networkId);
      action = {
        type: IDecodedTxActionType.NATIVE_TRANSFER,
        nativeTransfer: {
          tokenInfo: nativeToken,
          from: TronWeb.address.fromHex(fromAddressHex),
          to: TronWeb.address.fromHex(toAddressHex),
          amount: new BigNumber(amount)
            .shiftedBy(-nativeToken.decimals)
            .toFixed(),
          amountValue: amount.toString(),
          extraInfo: null,
        },
      };
    } else if (encodedTx.raw_data.contract[0].type === 'TriggerSmartContract') {
      const {
        contract_address: contractAddressHex,
        data,
        owner_address: fromAddressHex,
      } = encodedTx.raw_data.contract[0].parameter.value;
      try {
        const fromAddress = TronWeb.address.fromHex(fromAddressHex);
        const tokenAddress = TronWeb.address.fromHex(contractAddressHex);

        // batch transfer
        if (tokenAddress === batchTransferContractAddress[this.networkId]) {
          const decodeTx = await this.decodeBatchTransferTx(encodedTx);
          if (decodeTx) return decodeTx;
        }

        const [tokenInfo] = await this.fetchTokenInfos([tokenAddress]);
        const token = await this.engine.ensureTokenInDB(
          this.networkId,
          tokenAddress,
        );
        const methodSelector = `0x${data.slice(0, 8)}`;

        if (tokenInfo && token) {
          if (methodSelector === Erc20MethodSelectors.tokenTransfer) {
            const [toAddressHex, decodedAmount] = defaultAbiCoder.decode(
              ['address', 'uint256'],
              `0x${data.slice(8)}`,
            );

            const amountBN = new BigNumber(
              (decodedAmount as { _hex: string })._hex,
            );
            if (typeof token !== 'undefined') {
              action = {
                type: IDecodedTxActionType.TOKEN_TRANSFER,
                tokenTransfer: {
                  tokenInfo: token,
                  from: fromAddress,
                  to: TronWeb.address.fromHex(toAddressHex),
                  amount: amountBN.shiftedBy(-token.decimals).toFixed(),
                  amountValue: amountBN.toFixed(),
                  extraInfo: null,
                },
              };
            }
          } else if (methodSelector === Erc20MethodSelectors.tokenApprove) {
            const [spenderAddressHex, decodedAmount] = defaultAbiCoder.decode(
              ['address', 'uint256'],
              `0x${data.slice(8)}`,
            );
            const amountBN = new BigNumber(decodedAmount._hex);
            action = {
              type: IDecodedTxActionType.TOKEN_APPROVE,
              tokenApprove: {
                tokenInfo: token,
                owner: fromAddress,
                spender: TronWeb.address.fromHex(spenderAddressHex),
                isMax: toBigIntHex(amountBN) === INFINITE_AMOUNT_HEX,
                amount: amountBN.shiftedBy(-token.decimals).toFixed(),
                amountValue: amountBN.toFixed(),
                extraInfo: null,
              },
            };
          }
        }
      } catch (e) {
        // TODO: log error
        // Unable to parse, will be a unknown action
      }
    }

    const owner = await this.getAccountAddress();
    return {
      txid: encodedTx.txID,
      owner,
      signer: owner,
      nonce: 0,
      actions: [action],
      status: IDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,

      extraInfo: null,
      encodedTx,
    };
  }

  async decodeBatchTransferTx(encodedTx: IEncodedTxTron) {
    const owner = await this.getAccountAddress();

    const { data, owner_address: fromAddressHex } = (
      encodedTx.raw_data.contract[0] as ITriggerSmartContractCall
    ).parameter.value;

    const fromAddress = TronWeb.address.fromHex(fromAddressHex);

    const transactionSelector = `0x${data.slice(0, 8)}`;
    const extraActions: IDecodedTxAction[] = [];
    const address = await this.getAccountAddress();
    switch (transactionSelector) {
      case BatchTransferSelectors.disperseEtherSameValue:
      case BatchTransferSelectors.disperseEther: {
        const isTransferSameValue =
          transactionSelector === BatchTransferSelectors.disperseEtherSameValue;
        const nativeToken = await this.engine.getNativeTokenInfo(
          this.networkId,
        );

        let recipients: string[] = [];
        let amounts: { _hex: string }[] = [];

        if (isTransferSameValue) {
          const result = defaultAbiCoder.decode(
            ['address[]', 'uint256'],
            `0x${data.slice(8)}`,
          );
          [recipients] = result;
          amounts = [result[1]];
        } else {
          const result = defaultAbiCoder.decode(
            ['address[]', 'uint256[]'],
            `0x${data.slice(8)}`,
          );
          [recipients, amounts] = result;
        }

        for (let i = 0; i < recipients.length; i += 1) {
          const toAddress = TronWeb.address.fromHex(recipients[i]);
          const amountBN = new BigNumber(
            isTransferSameValue ? amounts[0]._hex : amounts[i]._hex,
          );
          if (fromAddress === owner || toAddress === owner) {
            extraActions.push({
              type: IDecodedTxActionType.NATIVE_TRANSFER,
              direction: await this.buildTxActionDirection({
                from: fromAddress,
                to: recipients[i],
                address,
              }),
              nativeTransfer: {
                tokenInfo: nativeToken,
                from: fromAddress,
                to: toAddress,
                amount: amountBN.shiftedBy(-nativeToken.decimals).toFixed(),
                amountValue: amountBN.toFixed(),
                extraInfo: null,
              },
            });
          }
        }
        break;
      }
      case BatchTransferSelectors.disperseTokenSameValue:
      case BatchTransferSelectors.disperseTokenSimple: {
        const isTransferSameValue =
          transactionSelector === BatchTransferSelectors.disperseTokenSameValue;

        let tokenAddress = '';
        let recipients: string[] = [];
        let amounts: { _hex: string }[] = [];

        if (isTransferSameValue) {
          const result = defaultAbiCoder.decode(
            ['address', 'address[]', 'uint256'],
            `0x${data.slice(8)}`,
          );
          [tokenAddress, recipients] = result;
          amounts = [result[2]];
        } else {
          const result = defaultAbiCoder.decode(
            ['address', 'address[]', 'uint256[]'],
            `0x${data.slice(8)}`,
          );
          [tokenAddress, recipients, amounts] = result;
        }

        const token = await this.engine.ensureTokenInDB(
          this.networkId,
          TronWeb.address.fromHex(tokenAddress),
        );

        if (!token) break;

        for (let i = 0; i < recipients.length; i += 1) {
          const toAddress = TronWeb.address.fromHex(recipients[i]);
          const amountBN = new BigNumber(
            isTransferSameValue ? amounts[0]._hex : amounts[i]._hex,
          );
          extraActions.push({
            type: IDecodedTxActionType.TOKEN_TRANSFER,
            direction: await this.buildTxActionDirection({
              from: fromAddress,
              to: toAddress,
              address,
            }),
            tokenTransfer: {
              tokenInfo: token,
              from: fromAddress,
              to: toAddress,
              amount: amountBN.shiftedBy(-token.decimals).toFixed(),
              amountValue: amountBN.toFixed(),
              extraInfo: null,
            },
          });
        }
        break;
      }

      default:
        return null;
    }

    return {
      txid: encodedTx.txID,
      owner,
      signer: fromAddress || owner,
      nonce: 0,
      actions: [...extraActions],
      status: IDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,

      extraInfo: null,
      encodedTx,
    };
  }

  override decodedTxToLegacy(
    _decodedTx: IDecodedTx,
  ): Promise<IDecodedTxLegacy> {
    return Promise.resolve({} as IDecodedTxLegacy);
  }

  override async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<IEncodedTx> {
    if (!transferInfo.to) {
      throw new Error('Invalid transferInfo.to params');
    }
    const { from, to, amount, token: tokenAddress } = transferInfo;
    const tronWeb = await this.getClient();

    const token = await this.engine.ensureTokenInDB(
      this.networkId,
      tokenAddress || '',
    );
    if (!token) {
      throw new OneKeyInternalError(
        `Token not found: ${tokenAddress || 'TRX'}`,
      );
    }
    if (tokenAddress) {
      if (new BigNumber(tokenAddress).isInteger()) {
        // trc10
        try {
          return await tronWeb.transactionBuilder.sendToken(
            to,
            parseInt(new BigNumber(amount).shiftedBy(token.decimals).toFixed()),
            tokenAddress,
            from,
          );
        } catch (e) {
          if (typeof e === 'string' && e.endsWith('is not sufficient.')) {
            throw new InsufficientBalance();
          } else if (typeof e === 'string') {
            throw new Error(e);
          } else {
            throw e;
          }
        }
      } else {
        const {
          result: { result },
          transaction,
        } = await tronWeb.transactionBuilder.triggerSmartContract(
          tokenAddress,
          'transfer(address,uint256)',
          {},
          [
            { type: 'address', value: to },
            {
              type: 'uint256',
              value: new BigNumber(amount).shiftedBy(token.decimals).toFixed(0),
            },
          ],
          from,
        );
        if (!result) {
          throw new OneKeyInternalError(
            'Unable to build token transfer transaction',
          );
        }
        return transaction;
      }
    }

    // TODO: handle insufficient balance case
    try {
      return await tronWeb.transactionBuilder.sendTrx(
        to,
        parseInt(new BigNumber(amount).shiftedBy(token.decimals).toFixed()),
        from,
      );
    } catch (e) {
      if (typeof e === 'string' && e.endsWith('balance is not sufficient.')) {
        throw new InsufficientBalance();
      } else if (typeof e === 'string') {
        throw new Error(e);
      } else {
        throw e;
      }
    }
  }

  override async buildEncodedTxFromBatchTransfer({
    transferInfos,
  }: {
    transferInfos: ITransferInfo[];
  }): Promise<IEncodedTxTron> {
    const tronWeb = await this.getClient();
    const network = await this.getNetwork();
    const dbAccount = await this.getDbAccount();
    const transferInfo = transferInfos[0];
    const isTransferToken = Boolean(transferInfo.token);

    const contract = batchTransferContractAddress[network.id];

    if (!contract) {
      throw new Error(
        `${network.name} has not deployed a batch transfer contract`,
      );
    }

    let batchMethod: string;
    let paramTypes: string[];
    let ParamValues: any[];
    let totalAmountBN = new BigNumber(0);

    const isTransferSameValue = transferInfos.every((info) =>
      new BigNumber(info.amount).isEqualTo(transferInfo.amount),
    );

    if (isTransferToken) {
      const token = await this.engine.ensureTokenInDB(
        this.networkId,
        transferInfo.token ?? '',
      );
      if (!token) {
        throw new Error(`Token not found: ${transferInfo.token as string}`);
      }

      batchMethod = isTransferSameValue
        ? BatchTransferMethods.disperseTokenSameValue
        : BatchTransferMethods.disperseTokenSimple;

      paramTypes = (
        batchMethod.match(BATCH_TRANSFER_PARAMS_REGEX) as Array<string>
      )[1].split(',');
      ParamValues = [
        token.tokenIdOnNetwork,
        ...reduce(
          transferInfos,
          (result: [string[], number[]], info) => {
            const amountBN = new BigNumber(info.amount);
            result[0].push(info.to);
            result[1].push(amountBN.shiftedBy(token.decimals).toNumber());
            return result;
          },
          [[], []],
        ),
      ];

      if (isTransferSameValue) {
        ParamValues = [ParamValues[0], ParamValues[1], ParamValues[2][0]];
      }
    } else {
      batchMethod = isTransferSameValue
        ? BatchTransferMethods.disperseEtherSameValue
        : BatchTransferMethods.disperseEther;
      paramTypes = (
        batchMethod.match(BATCH_TRANSFER_PARAMS_REGEX) as Array<string>
      )[1].split(',');
      ParamValues = reduce(
        transferInfos,
        (result: [string[], number[]], info) => {
          const amountBN = new BigNumber(info.amount).shiftedBy(
            network.decimals,
          );
          totalAmountBN = totalAmountBN.plus(amountBN);
          result[0].push(info.to);
          result[1].push(amountBN.toNumber());
          return result;
        },
        [[], []],
      );

      if (isTransferSameValue) {
        ParamValues = [ParamValues[0], ParamValues[1][0]];
      }
    }

    const params = paramTypes.map((type, index) => ({
      type,
      value: ParamValues[index],
    }));
    const {
      result: { result },
      transaction,
    } = await tronWeb.transactionBuilder.triggerSmartContract(
      tronWeb.address.toHex(contract),
      batchMethod,
      {
        callValue: isTransferToken ? 0 : totalAmountBN.toNumber(),
        feeLimit: MAX_FEE_LIMIT,
      },
      params,
      tronWeb.address.toHex(dbAccount.address),
    );

    if (!result) {
      throw new OneKeyInternalError(
        'Unable to build batch transfer token transaction',
      );
    }
    return transaction;
  }

  async getBatchTransferBaseEnergy() {
    const network = await this.getNetwork();
    const dbAccount = await this.getDbAccount();

    const contract = batchTransferContractAddress[network.id];
    const tronWeb = await this.getClient();
    const batchMethod = BatchTransferMethods.disperseEther;
    const paramTypes = ['address[]', 'uint256[]'];
    const amount = new BigNumber(1).shiftedBy(network.decimals).toNumber();
    const ParamValues = [[dbAccount.address], [amount]];

    const params = paramTypes.map((type, index) => ({
      type,
      value: ParamValues[index],
    }));

    try {
      const {
        result: { result },
        energy_required: energyRequired,
      } = await tronWeb.transactionBuilder.estimateEnergy(
        tronWeb.address.toHex(contract),
        batchMethod,
        {
          callValue: amount,
        },
        params,
        tronWeb.address.toHex(dbAccount.address),
      );

      if (result) {
        return energyRequired;
      }
    } catch {
      return 0;
    }
    return 0;
  }

  override async checkIsUnlimitedAllowance(params: {
    owner: string;
    spender: string;
    token: string;
  }) {
    const { owner, spender, token } = params;

    try {
      const tronWeb = await this.getClient();
      const tokenContract = await tronWeb.contract().at(token);
      const resp = await tokenContract.allowance(owner, spender).call();
      const allowance =
        (resp as { remaining: { _hex: string } }).remaining ?? resp;

      const allowanceBN = new BigNumber(allowance._hex);

      const totalSupplyResp = await tokenContract.totalSupply().call();
      const totalSupply = totalSupplyResp._hex;

      return {
        isUnlimited: allowanceBN.gt(totalSupply),
        allowance: allowanceBN.toFixed(),
      };
    } catch {
      return {
        isUnlimited: false,
        allowance: '0',
      };
    }
  }

  override async checkIsBatchTransfer(encodedTx: IEncodedTxTron) {
    const tronWeb = await this.getClient();
    if (encodedTx.raw_data.contract[0].type === 'TriggerSmartContract') {
      const { contract_address: contractAddressHex } =
        encodedTx.raw_data.contract[0].parameter.value;
      return (
        tronWeb.address.toHex(batchTransferContractAddress[this.networkId]) ===
        contractAddressHex
      );
    }

    return false;
  }

  async buildEncodedTxFromApprove(
    approveInfo: IApproveInfo,
  ): Promise<IEncodedTx> {
    const tronWeb = await this.getClient();
    const token = await this.engine.ensureTokenInDB(
      this.networkId,
      approveInfo.token,
    );
    if (typeof token === 'undefined') {
      throw new Error(`Token not found: ${approveInfo.token}`);
    }
    const params = [
      { type: 'address', value: approveInfo.spender },
      {
        type: 'uint256',
        value:
          approveInfo.amount === 'Infinite'
            ? INFINITE_AMOUNT_HEX
            : new BigNumber(approveInfo.amount)
                .shiftedBy(token.decimals)
                .toFixed(),
      },
    ];
    const {
      result: { result },
      transaction,
    } = await tronWeb.transactionBuilder.triggerSmartContract(
      approveInfo.token,
      'approve(address,uint256)',
      { call_value: 0 },
      params,
      approveInfo.from,
    );
    if (!result) {
      throw new OneKeyInternalError(
        'Unable to build token approve transaction',
      );
    }
    return transaction;
  }

  override async getTokenAllowance(
    tokenAddress: string,
    spenderAddress: string,
  ): Promise<BigNumber> {
    const [dbAccount, token] = await Promise.all([
      this.getDbAccount(),
      this.engine.ensureTokenInDB(this.networkId, tokenAddress),
    ]);

    if (typeof token === 'undefined') {
      // This will be catched by engine.
      console.error(`Token not found: ${tokenAddress}`);
      throw new Error();
    }

    const abi = [
      {
        'constant': true,
        'inputs': [
          {
            'name': '_owner',
            'type': 'address',
          },
          {
            'name': '_spender',
            'type': 'address',
          },
        ],
        'name': 'allowance',
        'outputs': [
          {
            'name': 'remaining',
            'type': 'uint256',
          },
        ],
        'payable': false,
        'stateMutability': 'view',
        'type': 'function',
      },
    ];

    const tronWeb = (await this.getClient()) as any;
    const contract = await tronWeb.contract(abi, tokenAddress);

    const [remaining] = await contract
      .allowance(dbAccount.address, spenderAddress)
      .call();

    if (!remaining) {
      return new BigNumber(0);
    }

    return new BigNumber(remaining.toHexString()).shiftedBy(-token.decimals);
  }

  override updateEncodedTxTokenApprove(
    _encodedTx: IEncodedTx,
    _amount: string,
  ): Promise<IEncodedTx> {
    // TODO
    throw new NotImplemented();
  }

  override async updateEncodedTx(
    uncastedEncodedTx: IEncodedTx,
    payload: any,
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTx> {
    const encodedTx: IEncodedTxTron = uncastedEncodedTx as IEncodedTxTron;

    // max native token transfer update
    if (
      options.type === 'transfer' &&
      encodedTx.raw_data.contract[0].type === 'TransferContract'
    ) {
      const tronWeb = await this.getClient();
      const { decimals } = await this.engine.getNativeTokenInfo(this.networkId);
      const { owner_address: fromAddressHex, to_address: toAddressHex } =
        encodedTx.raw_data.contract[0].parameter.value;
      const { amount } = payload as IEncodedTxUpdatePayloadTransfer;

      return tronWeb.transactionBuilder.sendTrx(
        TronWeb.address.fromHex(toAddressHex),
        parseInt(new BigNumber(amount).shiftedBy(decimals).toFixed()),
        TronWeb.address.fromHex(fromAddressHex),
      );
    }

    return Promise.resolve(encodedTx);
  }

  override buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTx,
  ): Promise<IUnsignedTxPro> {
    return Promise.resolve({
      inputs: [],
      outputs: [],
      payload: { encodedTx },
      encodedTx,
    });
  }

  override async fetchFeeInfo(
    uncastedEncodedTx: IEncodedTx,
    signOnly: boolean,
    specifiedFeeRate: any,
    transferCount: number,
  ): Promise<IFeeInfo> {
    let baseFee = 0;

    const network = await this.getNetwork();
    const encodedTx: IEncodedTxTron = uncastedEncodedTx as IEncodedTxTron;
    const parameters = await this.getParameters();
    const { freeBandwidth, stakedBandwidth, stakedEnergy } =
      await this.getConsumableResource(await this.getAccountAddress());

    const requiredBandwidth =
      encodedTx.raw_data_hex.length / 2 +
      SIGNATURE_LENGTH +
      TX_RESULT_SIZE +
      TX_SIZE_OVERHEAD;
    baseFee +=
      (requiredBandwidth > freeBandwidth && requiredBandwidth > stakedBandwidth
        ? requiredBandwidth
        : 0) * parameters.getTransactionFee;
    if (encodedTx.raw_data.contract[0].type === 'TransferContract') {
      // Account creation?
      const { to_address: toAddressHex } =
        encodedTx.raw_data.contract[0].parameter.value;
      if (
        !(await this.checkAccountExistence(
          TronWeb.address.fromHex(toAddressHex),
        ))
      ) {
        baseFee = parameters.getCreateNewAccountFeeInSystemContract;
        baseFee +=
          parameters.getCreateAccountFee > stakedBandwidth
            ? parameters.getCreateAccountFee
            : 0;
      }
    } else if (encodedTx.raw_data.contract[0].type === 'TriggerSmartContract') {
      const {
        contract_address: contractAddressHex,
        data,
        call_value: callValue,
        owner_address: fromAddressHex,
      } = encodedTx.raw_data.contract[0].parameter.value;

      let requiredEnergy = 0;

      const tronWeb = await this.getClient();

      const resp: IRPCCallResponse = await tronWeb.fullNode.request(
        'jsonrpc',
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_estimateGas',
          params: [
            {
              from: fromAddressHex,
              to: contractAddressHex,
              gas: '0x01',
              gasPrice: '0x01',
              value: toBigIntHex(new BigNumber(callValue ?? 0)),
              data,
            },
          ],
        },
        'post',
      );

      if (resp.error && resp.error.message) {
        if (
          resp.error.message.startsWith("Not enough energy for 'CALL'") &&
          TronWeb.address.fromHex(contractAddressHex) ===
            batchTransferContractAddress[this.networkId]
        ) {
          requiredEnergy =
            (await this.getBatchTransferBaseEnergy()) * transferCount;
        } else {
          throw new Error(resp.error.message);
        }
      } else {
        requiredEnergy = parseInt(resp.result);
      }

      if (requiredEnergy > stakedEnergy) {
        baseFee += requiredEnergy * parameters.getEnergyFee;
      }
    }

    return {
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      feeSymbol: network.feeSymbol,
      feeDecimals: network.feeDecimals,

      // TODO
      limit: '0',
      prices: ['0'],
      defaultPresetIndex: '0',

      tx: null, // Must be null if network not support feeInTx
      baseFeeValue: new BigNumber(baseFee.toString())
        .shiftedBy(-network.feeDecimals)
        .toFixed(),
    };
  }

  override async broadcastTransaction(
    signedTx: ISignedTxPro,
  ): Promise<ISignedTxPro> {
    debugLogger.engine.info('broadcastTransaction START:', {
      rawTx: signedTx.rawTx,
    });

    const tronWeb = await this.getClient();
    const ret = await tronWeb.trx.sendRawTransaction(
      JSON.parse(signedTx.rawTx),
    );

    if (typeof ret.code !== 'undefined') {
      throw new OneKeyInternalError(
        `${ret.code} ${Buffer.from(ret.message || '', 'hex').toString()}`,
      );
    }

    debugLogger.engine.info('broadcastTransaction END:', {
      txid: signedTx.txid,
      rawTx: signedTx.rawTx,
    });
    return signedTx;
  }

  override async getExportedCredential(password: string): Promise<string> {
    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;
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

  override async fetchOnChainHistory(options: {
    tokenIdOnNetwork?: string;
    localHistory?: IHistoryTx[];
  }): Promise<IHistoryTx[]> {
    const { localHistory = [], tokenIdOnNetwork } = options;

    let transferHistory: IOnChainTransferHistory[] = [];
    let txHistory: IOnChainTxHistory[] = [];
    // txs triggered by contract
    let internalTxHistory: IOnChainInternalTxHistory[] = [];

    const tronWeb = await this.getClient();
    const apiExplorer = await this.getApiExplorer();
    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;
    const nativeToken = await this.engine.getNativeTokenInfo(this.networkId);
    const { decimals } = nativeToken;

    transferHistory = (
      (await tronWeb.fullNode.request(
        `v1/accounts/${
          dbAccount.address
        }/transactions/trc20?only_confirmed=true${
          tokenIdOnNetwork ? `&&contract_address=${tokenIdOnNetwork}` : ''
        }`,
      )) as {
        data: IOnChainTransferHistory[];
      }
    ).data;

    if (!tokenIdOnNetwork) {
      txHistory = (
        (await tronWeb.fullNode.request(
          `v1/accounts/${dbAccount.address}/transactions/?only_confirmed=true`,
        )) as {
          data: IOnChainTxHistory[];
        }
      ).data;
      internalTxHistory = (
        await apiExplorer.get('api/internal-transaction', {
          params: { address: dbAccount.address, start: 0, limit: 20 },
        })
      ).data.data;
    }

    const transferHistoryPromises = transferHistory.map(async (tx) => {
      const historyTxToMerge = localHistory.find(
        (item) => item.decodedTx.txid === tx.transaction_id,
      );
      if (historyTxToMerge && historyTxToMerge.decodedTx.isFinal) {
        return Promise.resolve(null);
      }

      if (tx.from === dbAccount.address) {
        return Promise.resolve(null);
      }

      const token = await this.engine.ensureTokenInDB(
        this.networkId,
        tx.token_info.address,
      );

      if (!token) {
        return Promise.resolve(null);
      }

      const txDetail = await tronWeb.trx.getTransactionInfo(tx.transaction_id);

      const amountBN = new BigNumber(tx.value);

      let action: IDecodedTxAction = {
        type: IDecodedTxActionType.UNKNOWN,
      };

      if (tx.type === 'Transfer') {
        action = {
          type: IDecodedTxActionType.TOKEN_TRANSFER,
          tokenTransfer: {
            tokenInfo: token,
            from: tx.from,
            to: tx.to,
            amount: amountBN.shiftedBy(-token.decimals).toFixed(),
            amountValue: amountBN.toFixed(),
            extraInfo: null,
          },
        };
      }

      try {
        const decodedTx: IDecodedTx = {
          txid: tx.transaction_id,

          owner: tx.from,
          signer: tx.from,
          totalFeeInNative: new BigNumber(txDetail.fee ?? 0)
            .shiftedBy(-decimals)
            .toFixed(),
          actions: [action],
          accountId: this.accountId,
          networkId: this.networkId,
          status: IDecodedTxStatus.Confirmed,
          updatedAt: tx.block_timestamp,
          createdAt:
            historyTxToMerge?.decodedTx.createdAt ?? tx.block_timestamp,
          isFinal: true,
          extraInfo: null,
          nonce: 0,
        };
        return await this.buildHistoryTx({ decodedTx, historyTxToMerge });
      } catch (e) {
        debugLogger.common.error(e);
      }

      return Promise.resolve(null);
    });
    const txHistoryPromises = txHistory.map(async (tx) => {
      const historyTxToMerge = localHistory.find(
        (item) => item.decodedTx.txid === tx.txID,
      );
      if (historyTxToMerge && historyTxToMerge.decodedTx.isFinal) {
        // No need to update.
        return Promise.resolve(null);
      }

      try {
        const {
          block_timestamp: blockTime,
          ret: [{ contractRet, fee }],
        } = tx;
        const decodedTx: IDecodedTx = {
          ...(await this.decodeTx(tx)),
          txid: tx.txID,
          totalFeeInNative: new BigNumber(fee).shiftedBy(-decimals).toFixed(),
          status:
            contractRet === 'SUCCESS'
              ? IDecodedTxStatus.Confirmed
              : IDecodedTxStatus.Failed,
          updatedAt: blockTime,
          createdAt: historyTxToMerge?.decodedTx.createdAt ?? blockTime,
          isFinal: true,
        };
        return await this.buildHistoryTx({ decodedTx, historyTxToMerge });
      } catch (e) {
        debugLogger.common.error(e);
      }

      return Promise.resolve(null);
    });
    const internalTxHistoryPromises = internalTxHistory.map(async (tx) => {
      const historyTxToMerge = localHistory.find(
        (item) => item.decodedTx.txid === tx.hash,
      );
      if (historyTxToMerge && historyTxToMerge.decodedTx.isFinal) {
        // No need to update.
        return Promise.resolve(null);
      }

      try {
        const [txDetail, txInfo] = await Promise.all([
          tronWeb.trx.getTransaction(tx.hash),
          tronWeb.trx.getTransactionInfo(tx.hash),
        ]);

        const {
          ret: [{ contractRet }],
        } = txDetail;
        const decodedTx: IDecodedTx = {
          ...(await this.decodeTx(txDetail)),
          txid: tx.hash,
          totalFeeInNative: new BigNumber(txInfo.fee)
            .shiftedBy(-decimals)
            .toFixed(),
          status:
            contractRet === 'SUCCESS'
              ? IDecodedTxStatus.Confirmed
              : IDecodedTxStatus.Failed,
          updatedAt: tx.timestamp,
          createdAt: historyTxToMerge?.decodedTx.createdAt ?? tx.timestamp,
          isFinal: true,
        };
        return await this.buildHistoryTx({ decodedTx, historyTxToMerge });
      } catch (e) {
        debugLogger.common.error(e);
      }
    });

    const finalTransferHistory = (
      await Promise.all(transferHistoryPromises)
    ).filter(Boolean);
    const finalTxHistory = (await Promise.all(txHistoryPromises)).filter(
      Boolean,
    );
    const finalInterTxHistory = (
      await Promise.all(internalTxHistoryPromises)
    ).filter(Boolean);

    return [...finalTransferHistory, ...finalTxHistory, ...finalInterTxHistory];
  }

  override async proxyJsonRPCCall<T>(request: IJsonRpcRequest): Promise<T> {
    try {
      const tronWeb = await this.getClient();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return await tronWeb.fullNode.request('jsonrpc', request, 'post');
    } catch (e) {
      throw extractResponseError(e);
    }
  }

  override async getFeePricePerUnit(): Promise<FeePricePerUnit> {
    const { result: gasPriceHex } = await this.proxyJsonRPCCall<{
      result: string;
    }>({
      id: 1,
      jsonrpc: '2.0',
      method: 'eth_gasPrice',
      params: [],
    });
    const gasPrice = fromBigIntHex(gasPriceHex);
    const slow =
      gasPrice.isFinite() && gasPrice.gt(1) ? gasPrice : new BigNumber(1);
    const normal = slow.multipliedBy(1.25).integerValue(BigNumber.ROUND_CEIL);
    const fast = normal.multipliedBy(1.2).integerValue(BigNumber.ROUND_CEIL); // 1.25 * 1.2 = 1.5

    return {
      normal: { price: normal },
      others: [{ price: slow }, { price: fast }],
    };
  }
}
