/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await, no-param-reassign */

import { defaultAbiCoder } from '@ethersproject/abi';
import ERC1155MetadataArtifact from '@openzeppelin/contracts/build/contracts/ERC1155.json';
import ERC20MetadataArtifact from '@openzeppelin/contracts/build/contracts/ERC20.json';
import ERC721MetadataArtifact from '@openzeppelin/contracts/build/contracts/ERC721.json';
import BigNumber from 'bignumber.js';
import { Contract } from 'ethers';
import {
  difference,
  isNil,
  isString,
  merge,
  omit,
  reduce,
  toLower,
} from 'lodash';

import { Geth } from '@onekeyhq/blockchain-libs/src/provider/chains/eth/geth';
import type { Provider as EthProvider } from '@onekeyhq/blockchain-libs/src/provider/chains/eth/provider';
import { decrypt } from '@onekeyhq/engine/src/secret/encryptors/aes256';
import { TransactionStatus } from '@onekeyhq/engine/src/types/provider';
import type {
  PartialTokenInfo,
  UnsignedTx,
} from '@onekeyhq/engine/src/types/provider';
import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import type {
  BatchSendConfirmPayloadInfo,
  SendConfirmAdvancedSettings,
  SendConfirmPayloadInfo,
} from '@onekeyhq/kit/src/views/Send/types';
import lib0xSequenceMulticall from '@onekeyhq/shared/src/asyncModules/lib0xSequenceMulticall';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import {
  COINTYPE_ETC,
  HISTORY_CONSTS,
  IMPL_EVM,
  UNIQUE_TOKEN_SYMBOLS,
} from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import { toBigIntHex } from '@onekeyhq/shared/src/utils/numberUtils';

import { NotImplemented, OneKeyInternalError } from '../../../errors';
import * as covalentApi from '../../../managers/covalent';
import { getAccountNameInfoByImpl } from '../../../managers/impl';
import {
  buildEncodeDataWithABI,
  createOutputActionFromNFTTransaction,
  getAsset,
  getNFTTransactionHistory,
} from '../../../managers/nft';
import { batchTransferContractAddress } from '../../../presets/batchTransferContractAddress';
import { extractResponseError, fillUnsignedTxObj } from '../../../proxy';
import { BatchTransferSelectors } from '../../../types/batchTransfer';
import { HistoryEntryStatus } from '../../../types/history';
import { ETHMessageTypes } from '../../../types/message';
import { NFTAssetType } from '../../../types/nft';
import { TokenRiskLevel } from '../../../types/token';
import {
  IDecodedTxActionType,
  IDecodedTxStatus,
  IEncodedTxUpdateType,
} from '../../types';
import { convertFeeValueToGwei } from '../../utils/feeInfoUtils';
import { VaultBase } from '../../VaultBase';

import {
  Erc1155MethodSelectors,
  Erc20MethodSelectors,
  Erc721MethodSelectors,
  WrapperTokenMethodSelectors,
} from './decoder/abi';
import {
  EVMDecodedTxType,
  EVMTxDecoder,
  InfiniteAmountHex,
  InfiniteAmountText,
} from './decoder/decoder';
import { getTxCount } from './decoder/util';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import { ethers } from './sdk/ethers';
import settings from './settings';

import type { Account, DBAccount } from '../../../types/account';
import type { ICovalentHistoryListItem } from '../../../types/covalent';
import type {
  HistoryEntry,
  HistoryEntryTransaction,
} from '../../../types/history';
import type {
  AptosMessage,
  BtcMessageTypes,
  CommonMessage,
  ETHMessage,
} from '../../../types/message';
import type {
  AccountNameInfo,
  EIP1559Fee,
  Network,
} from '../../../types/network';
import type {
  Collection,
  NFTAsset,
  NFTAssetMeta,
  NFTListItems,
  NFTTransaction,
} from '../../../types/nft';
import type { KeyringSoftwareBase } from '../../keyring/KeyringSoftwareBase';
import type {
  IApproveInfo,
  IClientEndpointStatus,
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxInteractInfo,
  IDecodedTxLegacy,
  IEncodedTx,
  IEncodedTxUpdateOptions,
  IEncodedTxUpdatePayloadTokenApprove,
  IEncodedTxUpdatePayloadTransfer,
  IFeeInfo,
  IFeeInfoUnit,
  IHistoryTx,
  INFTInfo,
  IRawTx,
  ISetApprovalForAll,
  ISignCredentialOptions,
  ITransferInfo,
  IUnsignedTxPro,
} from '../../types';
import type {
  EVMDecodedItemERC20Approve,
  EVMDecodedItemERC20Transfer,
} from './decoder/decoder';
import type { IRpcTxEvm } from './types';
import type { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';

const OPTIMISM_NETWORKS: string[] = [
  OnekeyNetwork.optimism,
  OnekeyNetwork.toptimism,
];

const ERC721 = ERC721MetadataArtifact.abi;
const ERC1155 = ERC1155MetadataArtifact.abi;
const ERC20 = ERC20MetadataArtifact.abi;

export type IUnsignedMessageEvm = (
  | AptosMessage
  | ETHMessage
  | CommonMessage
) & {
  payload?: any;
};

// TODO move to types.ts
export type IEncodedTxEvm = {
  from: string;
  to: string;
  value: string;
  data?: string;
  customData?: string;
  nonce?: number | string; // rpc use 0x string

  gas?: string; // alias for gasLimit
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
};

export enum IDecodedTxEvmType {
  NativeTransfer = 'NativeTransfer',
  TokenTransfer = 'TokenTransfer',
  TokenApprove = 'TokenApprove',
  Swap = 'Swap',
  NftTransfer = 'NftTransfer',
  Transaction = 'Transaction',
  ContractDeploy = 'ContractDeploy',
}

function decodeUnsignedTxFeeData(unsignedTx: UnsignedTx) {
  return {
    feeLimit: unsignedTx.feeLimit?.toFixed(),
    feePricePerUnit: unsignedTx.feePricePerUnit?.toFixed(),
    maxPriorityFeePerGas:
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      unsignedTx.payload?.maxPriorityFeePerGas?.toFixed(),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
    maxFeePerGas: unsignedTx.payload?.maxFeePerGas?.toFixed(),
  };
}

export default class Vault extends VaultBase {
  _ethersProvider: ethers.providers.JsonRpcProvider | undefined;

  settings = settings;

  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  override async getEthersProvider() {
    const network = await this.getNetwork();
    const rpcUrl = network.rpcURL;
    if (
      !this._ethersProvider ||
      this._ethersProvider?.connection?.url !== rpcUrl
    ) {
      this._ethersProvider = new ethers.providers.JsonRpcProvider(
        network.rpcURL,
      );
    }
    return this._ethersProvider;
  }

  async getJsonRPCClient(): Promise<Geth> {
    // shared/src/request
    // client: cross-fetch
    return (await this.engine.providerManager.getClient(
      this.networkId,
    )) as Geth;
  }

  decodedTxToLegacy(decodedTx: IDecodedTx): Promise<IDecodedTxLegacy> {
    throw new Error('decodedTxToLegacy in EVM not implemented.');
  }

  // TODO rewrite decodeTx EVM
  //    build nativeTransfer action from contractCall with value>0
  override async decodeTx(
    encodedTx: IEncodedTxEvm,
    payload?: any,
  ): Promise<IDecodedTx> {
    const decodedTxLegacy = await this.legacyDecodeTx(encodedTx, payload);
    const decodedTx = await this.decodedTxLegacyToModern({
      decodedTxLegacy,
      encodedTx,
      payload,
    });
    return decodedTx;
  }

  async decodeBatchTransferTx(
    decodedTxLegacy: IDecodedTxLegacy,
    encodedTx: IEncodedTxEvm,
    payload?: BatchSendConfirmPayloadInfo,
  ): Promise<IDecodedTx | null> {
    const decoder = EVMTxDecoder.getDecoder(this.engine);
    const ethersTx = (await this.helper.parseToNativeTx(
      encodedTx,
    )) as ethers.Transaction;
    if (!Number.isFinite(ethersTx.chainId)) {
      ethersTx.chainId = Number(await this.getNetworkChainId());
    }
    const [txDesc] = decoder.parseBatchTransfer(ethersTx);
    if (!txDesc) return null;

    const extraActions: IDecodedTxAction[] = [];
    const network = await this.getNetwork();
    const address = await this.getAccountAddress();
    switch (txDesc.name) {
      case 'disperseEther': {
        const recipients: string[] = txDesc.args[0];
        const values: string[] = txDesc.args[1];
        const nativeToken = await this.engine.getNativeTokenInfo(
          this.networkId,
        );
        for (let i = 0; i < recipients.length; i += 1) {
          extraActions.push({
            type: IDecodedTxActionType.NATIVE_TRANSFER,
            direction: await this.buildTxActionDirection({
              from: encodedTx.from,
              to: recipients[i],
              address,
            }),
            nativeTransfer: await this.buildNativeTransferAction({
              fromAddress: encodedTx.from,
              toAddress: recipients[i],
              amount: new BigNumber(values[i].toString())
                .shiftedBy(-nativeToken.decimals)
                .toFixed(),
              value: values[i].toString(),
            } as IDecodedTxLegacy),
          });
        }
        break;
      }
      case 'disperseToken':
      case 'disperseTokenSimple': {
        const tokenAddress = txDesc.args[0];
        const recipients: string[] = txDesc.args[1];
        const values: string[] = txDesc.args[2];

        const token = await this.engine.ensureTokenInDB(
          this.networkId,
          tokenAddress,
        );

        if (!token) break;

        for (let i = 0; i < recipients.length; i += 1) {
          extraActions.push({
            type: IDecodedTxActionType.TOKEN_TRANSFER,
            direction: await this.buildTxActionDirection({
              from: encodedTx.from,
              to: recipients[i],
              address,
            }),
            tokenTransfer: await this.buildTokenTransferAction({
              info: {
                token,
                from: encodedTx.from,
                recipient: recipients[i],
                amount: new BigNumber(values[i].toString())
                  .shiftedBy(-token.decimals)
                  .toFixed(),
                amountValue: values[i].toString(),
              },
            } as unknown as IDecodedTxLegacy),
          });
        }
        break;
      }
      case 'disperseNFT': {
        const recipient = txDesc.args[0];
        const tokens: string[] = txDesc.args[1];
        const tokenIds: string[] = txDesc.args[2];
        const amounts: string[] = txDesc.args[3];
        for (let i = 0; i < amounts.length; i += 1) {
          const asset =
            payload?.nftInfos?.[i].asset ||
            (await getAsset({
              accountId: this.accountId,
              networkId: this.networkId,
              contractAddress: tokens[i],
              tokenId: new BigNumber(tokenIds[i].toString()).toFixed(),
              local: true,
            }));
          if (asset) {
            extraActions.push({
              type: IDecodedTxActionType.NFT_TRANSFER,
              direction: await this.buildTxActionDirection({
                from: encodedTx.from,
                to: recipient,
                address,
              }),
              nftTransfer: await this.buildNFTTransferAcion({
                asset,
                amount: new BigNumber(amounts[i].toString()).toFixed(),
                from: encodedTx.from,
                to: recipient,
              }),
            });
          }
        }
        break;
      }
      default:
        return null;
    }

    const { gasInfo } = decodedTxLegacy;
    let feeInfo: IFeeInfoUnit;
    const limit = new BigNumber(gasInfo.gasLimit).toFixed();
    if (gasInfo.maxFeePerGas) {
      feeInfo = {
        eip1559: true,
        limit,
        price1559: {
          baseFee: '0',
          maxPriorityFeePerGas: new BigNumber(gasInfo.maxPriorityFeePerGas)
            .shiftedBy(-network.feeDecimals)
            .toFixed(),
          maxPriorityFeePerGasValue: gasInfo.maxPriorityFeePerGas,

          maxFeePerGas: new BigNumber(gasInfo.maxFeePerGas)
            .shiftedBy(-network.feeDecimals)
            .toFixed(),
          maxFeePerGasValue: gasInfo.maxFeePerGas,
          gasPrice: new BigNumber(gasInfo.gasPrice || gasInfo.maxFeePerGas)
            .shiftedBy(-network.feeDecimals)
            .toFixed(),
          gasPriceValue: gasInfo.gasPrice || gasInfo.maxFeePerGas,
        },
      };
    } else {
      feeInfo = {
        limit,
        price: new BigNumber(gasInfo.gasPrice)
          .shiftedBy(-network.feeDecimals)
          .toFixed(),
        priceValue: gasInfo.gasPrice,
      };
    }

    const decodedTx: IDecodedTx = {
      txid: decodedTxLegacy.txHash,
      owner: address,
      signer: encodedTx.from || address,
      nonce: new BigNumber(encodedTx.nonce ?? 0).toNumber(),
      actions: [...extraActions],
      status: IDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      encodedTx,
      feeInfo,
      payload,
      extraInfo: null,
    };
    return decodedTx;
  }

  decodeTxMemoizee = memoizee(
    async (encodedTx: IEncodedTxEvm, payload?: any): Promise<IDecodedTx> =>
      this.decodeTx(encodedTx, payload),
    {
      promise: true,
      primitive: true,
      max: 1,
      maxAge: getTimeDurationMs({ minute: 3 }),
    },
  );

  async legacyDecodeTx(
    encodedTx: IEncodedTx,
    payload?: any,
  ): Promise<IDecodedTxLegacy> {
    const ethersTx = (await this.helper.parseToNativeTx(
      encodedTx,
    )) as ethers.Transaction;

    if (!Number.isFinite(ethersTx.chainId)) {
      ethersTx.chainId = Number(await this.getNetworkChainId());
    }
    return EVMTxDecoder.getDecoder(this.engine).decodeTx({
      vault: this,
      rawTx: ethersTx,
      payload,
    });
  }

  async decodedTxLegacyToModern({
    decodedTxLegacy,
    encodedTx,
    payload,
    interactInfo,
  }: {
    decodedTxLegacy: IDecodedTxLegacy;
    encodedTx: IEncodedTxEvm;
    payload?: SendConfirmPayloadInfo;
    interactInfo?: IDecodedTxInteractInfo;
  }): Promise<IDecodedTx> {
    // batch transfer
    if (
      encodedTx.to &&
      encodedTx.to.toLowerCase() ===
        batchTransferContractAddress[this.networkId]?.toLowerCase()
    ) {
      const decodeTx = await this.decodeBatchTransferTx(
        decodedTxLegacy,
        encodedTx,
        payload,
      );
      if (decodeTx) return decodeTx;
    }

    const address = await this.getAccountAddress();
    const network = await this.getNetwork();
    const nativeToken = await this.engine.getNativeTokenInfo(this.networkId);
    const action: IDecodedTxAction = {
      type: IDecodedTxActionType.UNKNOWN,
      direction: await this.buildTxActionDirection({
        from: decodedTxLegacy.fromAddress,
        to: decodedTxLegacy.toAddress,
        address,
      }),
      unknownAction: {
        extraInfo: {},
      },
    };

    let extraNativeTransferAction: IDecodedTxAction | undefined;
    if (encodedTx.value) {
      const valueBn = new BigNumber(encodedTx.value);
      if (!valueBn.isNaN() && valueBn.gt(0)) {
        extraNativeTransferAction = {
          type: IDecodedTxActionType.NATIVE_TRANSFER,
          nativeTransfer: {
            tokenInfo: nativeToken,
            from: encodedTx.from || decodedTxLegacy.fromAddress,
            to: encodedTx.to,
            amount: valueBn.shiftedBy(-network.decimals).toFixed(),
            amountValue: valueBn.toFixed(),
            extraInfo: null,
          },
        };
      }
    }

    if (decodedTxLegacy.txType === EVMDecodedTxType.NATIVE_TRANSFER) {
      action.type = IDecodedTxActionType.NATIVE_TRANSFER;
      action.nativeTransfer = await this.buildNativeTransferAction(
        decodedTxLegacy,
      );
      extraNativeTransferAction = undefined;
    }
    if (decodedTxLegacy.txType === EVMDecodedTxType.TOKEN_TRANSFER) {
      action.type = IDecodedTxActionType.TOKEN_TRANSFER;
      action.tokenTransfer = await this.buildTokenTransferAction(
        decodedTxLegacy,
      );
    }
    if (decodedTxLegacy.txType === EVMDecodedTxType.TOKEN_APPROVE) {
      const info = decodedTxLegacy.info as EVMDecodedItemERC20Approve;
      action.type = IDecodedTxActionType.TOKEN_APPROVE;
      action.tokenApprove = {
        tokenInfo: info.token,
        owner: encodedTx.from ?? address,
        spender: info.spender,
        amount: info.amount,
        amountValue: info.value,
        isMax: info.isUInt256Max,
        extraInfo: null,
      };
    }
    if (
      decodedTxLegacy.txType === EVMDecodedTxType.ERC721_TRANSFER ||
      decodedTxLegacy.txType === EVMDecodedTxType.ERC1155_TRANSFER
    ) {
      let nftInfo: INFTInfo | null = null;
      if (payload?.nftInfo) {
        nftInfo = payload?.nftInfo;
      } else if (decodedTxLegacy.contractCallInfo) {
        const contractInfo = decodedTxLegacy.contractCallInfo;
        const [from, to, tokenId, amount] = contractInfo.args || [];
        const asset = await getAsset({
          accountId: this.accountId,
          networkId: this.networkId,
          contractAddress: contractInfo.contractAddress,
          tokenId,
          local: true,
        });
        if (asset) {
          nftInfo = {
            from,
            to,
            amount: new BigNumber(amount).toFixed(),
            asset: asset as NFTAsset,
          };
        }
      }

      if (nftInfo) {
        action.type = IDecodedTxActionType.NFT_TRANSFER;
        action.nftTransfer = await this.buildNFTTransferAcion(nftInfo);
      }
    }
    if (payload?.type === 'InternalSwap' && payload?.swapInfo) {
      action.internalSwap = {
        ...payload.swapInfo,
        extraInfo: null,
      };
      action.type = IDecodedTxActionType.INTERNAL_SWAP;
      extraNativeTransferAction = undefined;
    }
    if (payload?.type === 'InternalStake' && payload?.stakeInfo) {
      action.internalStake = {
        ...payload.stakeInfo,
        extraInfo: null,
      };
      action.type = IDecodedTxActionType.INTERNAL_STAKE;
      extraNativeTransferAction = undefined;
    }
    const { gasInfo } = decodedTxLegacy;
    let feeInfo: IFeeInfoUnit;
    const limit = new BigNumber(gasInfo.gasLimit).toFixed();
    if (gasInfo.maxFeePerGas) {
      feeInfo = {
        eip1559: true,
        limit,
        price1559: {
          // TODO add baseFee in encodedTx
          baseFee: '0',

          // TODO fee decimals convert utils
          maxPriorityFeePerGas: new BigNumber(gasInfo.maxPriorityFeePerGas)
            .shiftedBy(-network.feeDecimals)
            .toFixed(),
          maxPriorityFeePerGasValue: gasInfo.maxPriorityFeePerGas,

          maxFeePerGas: new BigNumber(gasInfo.maxFeePerGas)
            .shiftedBy(-network.feeDecimals)
            .toFixed(),
          maxFeePerGasValue: gasInfo.maxFeePerGas,

          gasPrice: new BigNumber(gasInfo.gasPrice || gasInfo.maxFeePerGas)
            .shiftedBy(-network.feeDecimals)
            .toFixed(),
          gasPriceValue: gasInfo.gasPrice || gasInfo.maxFeePerGas,
        },
      };
    } else {
      feeInfo = {
        limit,
        price: new BigNumber(gasInfo.gasPrice)
          .shiftedBy(-network.feeDecimals)
          .toFixed(),
        priceValue: gasInfo.gasPrice,
      };
    }
    const decodedTx: IDecodedTx = {
      txid: decodedTxLegacy.txHash,
      owner: address,
      signer: decodedTxLegacy.fromAddress,
      nonce: decodedTxLegacy.nonce || 0,
      actions: [action, extraNativeTransferAction].filter(Boolean),
      status: IDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      encodedTx,
      payload,
      feeInfo,
      interactInfo,
      // totalFeeInNative, // runtime calculate fee in UI
      extraInfo: {
        // decodedTxLegacy
      },
    };
    return decodedTx;
  }

  async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<IEncodedTxEvm> {
    if (!transferInfo.to) {
      throw new Error('Invalid transferInfo.to params');
    }
    const network = await this.getNetwork();
    const isTransferToken = Boolean(transferInfo.token);
    const isTransferNativeToken = !isTransferToken;
    const { amount, nftTokenId, isNFT, nftType } = transferInfo;

    let amountBN = new BigNumber(amount);
    if (amountBN.isNaN()) {
      amountBN = new BigNumber('0');
    }

    // erc20/erc721/erc1155 token transfer
    if (isTransferToken) {
      if (isNFT && nftType && nftTokenId) {
        const data = buildEncodeDataWithABI({
          type: nftType,
          from: transferInfo.from,
          to: transferInfo.to,
          id: nftTokenId,
          amount: amountBN.toFixed(),
        });
        return {
          from: transferInfo.from,
          to: transferInfo.token ?? '',
          value: '0x0',
          data,
        };
      }
      // erc20
      const token = await this.engine.ensureTokenInDB(
        this.networkId,
        transferInfo.token ?? '',
      );
      if (!token) {
        throw new Error(`Token not found: ${transferInfo.token as string}`);
      }
      const amountHex = toBigIntHex(amountBN.shiftedBy(token.decimals));

      const data = `${Erc20MethodSelectors.tokenTransfer}${defaultAbiCoder
        .encode(['address', 'uint256'], [transferInfo.to, amountHex])
        .slice(2)}`; // method_selector(transfer) + byte32_pad(address) + byte32_pad(value)
      // erc20 token transfer
      return {
        from: transferInfo.from,
        to: transferInfo.token ?? '',
        value: '0x0',
        data,
      };
    }

    // native token transfer
    const amountHex = toBigIntHex(amountBN.shiftedBy(network.decimals));
    return {
      from: transferInfo.from,
      to: transferInfo.to,
      value: amountHex,
      data: '0x',
    };
  }

  override async buildEncodedTxFromBatchTransfer({
    transferInfos,
    prevNonce,
  }: {
    transferInfos: ITransferInfo[];
    prevNonce?: number;
    isDeflationary?: boolean;
  }): Promise<IEncodedTxEvm> {
    const network = await this.getNetwork();
    const dbAccount = await this.getDbAccount();
    const transferInfo = transferInfos[0];
    const isTransferToken = Boolean(transferInfo.token);
    const { nftTokenId, isNFT, nftType } = transferInfo;
    const nextNonce: number =
      prevNonce !== undefined
        ? prevNonce + 1
        : await this.getNextNonce(network.id, dbAccount);

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
    if (isTransferToken) {
      if (isNFT && nftType && nftTokenId) {
        batchMethod = BatchTransferSelectors.disperseNFT;
        paramTypes = ['address', 'address[]', 'uint256[]', 'uint256[]'];
        ParamValues = [
          transferInfo.to,
          ...reduce(
            transferInfos,
            (result: [string[], string[], string[]], info) => {
              result[0].push(info.token || '');
              result[1].push(info.nftTokenId || '');
              result[2].push(
                new BigNumber(
                  info.nftType === 'erc1155' ? info.amount : 0,
                ).toFixed(),
              );
              return result;
            },
            [[], [], []],
          ),
        ];
      } else {
        const token = await this.engine.ensureTokenInDB(
          this.networkId,
          transferInfo.token ?? '',
        );
        if (!token) {
          throw new Error(`Token not found: ${transferInfo.token as string}`);
        }

        batchMethod = BatchTransferSelectors.disperseTokenSimple;
        paramTypes = ['address', 'address[]', 'uint256[]'];
        ParamValues = [
          token.tokenIdOnNetwork,
          ...reduce(
            transferInfos,
            (result: [string[], string[]], info) => {
              const amountBN = new BigNumber(info.amount);
              result[0].push(info.to);
              result[1].push(toBigIntHex(amountBN.shiftedBy(token.decimals)));
              return result;
            },
            [[], []],
          ),
        ];
      }
    } else {
      batchMethod = BatchTransferSelectors.disperseEther;
      paramTypes = ['address[]', 'uint256[]'];
      ParamValues = reduce(
        transferInfos,
        (result: [string[], string[]], info) => {
          const amountBN = new BigNumber(info.amount).shiftedBy(
            network.decimals,
          );
          totalAmountBN = totalAmountBN.plus(amountBN);
          result[0].push(info.to);
          result[1].push(amountBN.toFixed());
          return result;
        },
        [[], []],
      );
    }
    return {
      from: transferInfo.from,
      to: contract,
      data: `${batchMethod}${defaultAbiCoder
        .encode(paramTypes, ParamValues)
        .slice(2)}`,
      value: isTransferToken ? '0x0' : toBigIntHex(totalAmountBN),
      nonce: String(nextNonce),
    };
  }

  buildEncodedTxFromWrapperTokenDeposit({
    amount,
    from,
    contract,
  }: {
    amount: string;
    from: string;
    contract: string;
  }): IEncodedTxEvm {
    const methodID = WrapperTokenMethodSelectors.doposit;
    const amountBN = new BigNumber(amount);
    const amountHex = toBigIntHex(amountBN.shiftedBy(18));
    const data = `${methodID}${defaultAbiCoder
      .encode(['uint256'], [amountHex])
      .slice(2)}`;
    return {
      from,
      to: contract,
      value: amountHex,
      data,
    };
  }

  buildEncodedTxFromWrapperTokenWithdraw({
    amount,
    from,
    contract,
  }: {
    amount: string;
    from: string;
    contract: string;
  }) {
    const methodID = WrapperTokenMethodSelectors.withdraw;
    const amountBN = new BigNumber(amount);
    const amountHex = toBigIntHex(amountBN.shiftedBy(18));
    const data = `${methodID}${defaultAbiCoder
      .encode(['uint256'], [amountHex])
      .slice(2)}`;
    return {
      from,
      to: contract,
      value: '0x0',
      data,
    };
  }

  async buildEncodedTxFromApprove(
    approveInfo: IApproveInfo,
    prevNonce?: number,
  ): Promise<IEncodedTxEvm> {
    const [network, token, spender, dbAccount] = await Promise.all([
      this.getNetwork(),
      this.engine.ensureTokenInDB(this.networkId, approveInfo.token),
      this.validateAddress(approveInfo.spender),
      this.getDbAccount(),
    ]);
    if (typeof token === 'undefined') {
      throw new Error(`Token not found: ${approveInfo.token}`);
    }

    const nextNonce: number =
      prevNonce !== undefined
        ? prevNonce + 1
        : await this.getNextNonce(network.id, dbAccount);

    const amountBN = new BigNumber(approveInfo.amount);
    const amountHex = toBigIntHex(
      amountBN.isNaN()
        ? new BigNumber(2).pow(256).minus(1)
        : amountBN.shiftedBy(token.decimals),
    );
    // keccak256(Buffer.from('approve(address,uint256)') => '0x095ea7b3...'
    const methodID = Erc20MethodSelectors.tokenApprove;
    const data = `${methodID}${defaultAbiCoder
      .encode(['address', 'uint256'], [spender, amountHex])
      .slice(2)}`;
    return {
      from: approveInfo.from,
      to: approveInfo.token,
      value: '0x0',
      data,
      nonce: String(nextNonce),
    };
  }

  override async buildEncodedTxsFromSetApproveForAll(
    approveInfos: ISetApprovalForAll[],
    prevNonce?: number,
  ): Promise<IEncodedTxEvm[]> {
    const network = await this.getNetwork();
    const dbAccount = await this.getDbAccount();
    const nextNonce: number =
      prevNonce !== undefined
        ? prevNonce + 1
        : await this.getNextNonce(network.id, dbAccount);
    const encodedTxs = approveInfos.map((approveInfo, index) => ({
      from: approveInfo.from,
      to: approveInfo.to,
      data: `${
        approveInfo.type === 'erc1155'
          ? Erc1155MethodSelectors.setApprovalForAll
          : Erc721MethodSelectors.setApprovalForAll
      }${defaultAbiCoder
        .encode(
          ['address', 'bool'],
          [approveInfo.spender, approveInfo.approved],
        )
        .slice(2)}`,
      value: '0x0',
      nonce: nextNonce + index,
    }));
    return Promise.resolve(encodedTxs);
  }

  async getReadProvider() {
    const multicall = await lib0xSequenceMulticall.getModule();
    const provider = await this.getEthersProvider();
    if (!provider) {
      return;
    }
    return new multicall.MulticallProvider(provider, { verbose: true });
  }

  override async checkIsUnlimitedAllowance(params: {
    networkId: string;
    owner: string;
    spender: string;
    token: string;
  }) {
    const { owner, spender, token } = params;
    try {
      const readProvider = await this.getReadProvider();
      const contract = new Contract(token, ERC20, readProvider);
      const res: Promise<string>[] = await contract.functions.allowance(
        owner,
        spender,
      );
      const allowance = String(await res[0]);
      const totalSupplyRes: any = await contract.functions.totalSupply();
      // eslint-disable-next-line
      const totalSupply = totalSupplyRes?.[0]?.toString?.();
      return {
        isUnlimited: new BigNumber(allowance).gt(new BigNumber(totalSupply)),
        allowance,
      };
    } catch (e) {
      return {
        isUnlimited: false,
        allowance: 0,
      };
    }
  }

  override async checkIsApprovedForAll(params: {
    owner: string;
    spender: string;
    token: string;
    type?: string;
  }): Promise<boolean> {
    const { owner, spender, token, type } = params;

    try {
      const readProvider = await this.getReadProvider();
      const contract = new Contract(
        token,
        type === 'erc1155' ? ERC1155 : ERC721,
        readProvider,
      );

      const [isApprovedForAll]: boolean[] =
        await contract.functions.isApprovedForAll(owner, spender);
      return isApprovedForAll;
    } catch {
      return false;
    }
  }

  override async checkIsBatchTransfer(encodedTx: IEncodedTxEvm) {
    return Promise.resolve(
      encodedTx.to === batchTransferContractAddress[this.networkId],
    );
  }

  async updateEncodedTx(
    encodedTx: IEncodedTxEvm,
    payload: any,
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTxEvm> {
    if (options.type === IEncodedTxUpdateType.tokenApprove) {
      const p = payload as IEncodedTxUpdatePayloadTokenApprove;
      return this.updateEncodedTxTokenApprove(encodedTx, p.amount);
    }
    if (options.type === IEncodedTxUpdateType.transfer) {
      return this.updateEncodedTxTransfer(encodedTx, payload);
    }

    if (options.type === IEncodedTxUpdateType.advancedSettings) {
      return this.updateEncodedTxAdvancedSettings(encodedTx, payload);
    }

    if (options.type === IEncodedTxUpdateType.customData) {
      return this.updateEncodedTxCustomData(encodedTx, payload);
    }

    return Promise.resolve(encodedTx);
  }

  async updateEncodedTxCustomData(
    encodedTx: IEncodedTxEvm,
    customData: string,
  ) {
    encodedTx.customData = customData;
    return Promise.resolve(encodedTx);
  }

  async updateEncodedTxAdvancedSettings(
    encodedTx: IEncodedTxEvm,
    payload: SendConfirmAdvancedSettings,
  ) {
    if (this.settings.nonceEditable && payload.currentNonce) {
      encodedTx.nonce = payload.currentNonce;
    }
    if (
      this.settings.hexDataEditable &&
      !isNil(payload.currentHexData) &&
      (!encodedTx.data || encodedTx.data === '0x') &&
      encodedTx.data !== payload.currentHexData
    ) {
      encodedTx.data = payload.currentHexData;
    }

    return Promise.resolve(encodedTx);
  }

  async updateEncodedTxTransfer(
    encodedTx: IEncodedTxEvm,
    payload: IEncodedTxUpdatePayloadTransfer,
  ): Promise<IEncodedTxEvm> {
    const decodedTx = await this.legacyDecodeTx(encodedTx);
    const { amount } = payload;
    const amountBN = new BigNumber(amount);
    if (decodedTx.txType === EVMDecodedTxType.NATIVE_TRANSFER) {
      const network = await this.getNetwork();
      encodedTx.value = toBigIntHex(
        amountBN
          .dp(
            BigNumber.min(
              amountBN.decimalPlaces() - 2,
              network.decimals - 2,
            ).toNumber(),
            BigNumber.ROUND_FLOOR,
          )
          .shiftedBy(network.decimals),
      );
    }
    if (decodedTx.txType === EVMDecodedTxType.TOKEN_TRANSFER) {
      const info = decodedTx.info as EVMDecodedItemERC20Transfer;
      const amountHex = toBigIntHex(amountBN.shiftedBy(info.token.decimals));
      const data = `${Erc20MethodSelectors.tokenTransfer}${defaultAbiCoder
        .encode(['address', 'uint256'], [info.recipient, amountHex])
        .slice(2)}`;
      encodedTx.data = data;
    }
    return encodedTx;
  }

  async updateEncodedTxTokenApprove(
    encodedTx: IEncodedTxEvm,
    amount: string,
  ): Promise<IEncodedTxEvm> {
    // keccak256(Buffer.from('approve(address,uint256)') => '0x095ea7b3...'
    const approveMethodID = Erc20MethodSelectors.tokenApprove;

    const decodedTx = await this.legacyDecodeTx(encodedTx);
    if (decodedTx.txType !== EVMDecodedTxType.TOKEN_APPROVE) {
      throw new Error('Not a approve transaction.');
    }

    const { token, spender } = decodedTx.info as EVMDecodedItemERC20Approve;
    let amountHex;
    if (amount === InfiniteAmountText || amount === InfiniteAmountHex) {
      amountHex = InfiniteAmountHex;
    } else {
      const amountBN = new BigNumber(amount);
      if (amountBN.isNaN()) {
        throw new Error(`Invalid amount input: ${amount}`);
      }
      amountHex = toBigIntHex(amountBN.shiftedBy(token.decimals));
    }

    const data = `${approveMethodID}${defaultAbiCoder
      .encode(['address', 'uint256'], [spender, amountHex])
      .slice(2)}`;
    return {
      ...encodedTx,
      data, // Override the data
    };
  }

  async buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTxEvm,
    // TODO feeInfo
  ): Promise<IUnsignedTxPro> {
    const network = await this.getNetwork();
    const dbAccount = await this.getDbAccount();
    const {
      from,
      to,
      value,
      data,
      customData,
      gas,
      gasLimit,
      gasPrice,
      maxFeePerGas,
      maxPriorityFeePerGas,
      nonce,
      ...others
    } = encodedTx;
    debugLogger.sendTx.info(
      'buildUnsignedTxFromEncodedTx >>>> encodedTx',
      encodedTx,
    );
    const gasLimitFinal = gasLimit ?? gas;
    const nonceBN = new BigNumber(nonce ?? 'NaN');
    const nextNonce: number = !nonceBN.isNaN()
      ? nonceBN.toNumber()
      : await this.getNextNonce(network.id, dbAccount);
    // fillUnsignedTx in each impl
    const unsignedTxInfo = fillUnsignedTxObj({
      shiftFeeDecimals: false,
      network,
      dbAccount,
      from,
      to,
      valueOnChain: value,
      extra: {
        data,
        customData,
        feeLimit: !isNil(gasLimitFinal)
          ? new BigNumber(gasLimitFinal)
          : undefined,
        feePricePerUnit: !isNil(gasPrice) ? new BigNumber(gasPrice) : undefined,
        maxFeePerGas,
        maxPriorityFeePerGas,
        nonce: nextNonce,
        ...others,
      },
    });
    debugLogger.sendTx.info(
      'buildUnsignedTxFromEncodedTx >>>> fillUnsignedTx',
      unsignedTxInfo,
      decodeUnsignedTxFeeData(unsignedTxInfo),
    );

    const unsignedTx = await this.engine.providerManager.buildUnsignedTx(
      this.networkId,
      unsignedTxInfo,
    );

    debugLogger.sendTx.info(
      'buildUnsignedTxFromEncodedTx >>>> buildUnsignedTx',
      unsignedTx,
      decodeUnsignedTxFeeData(unsignedTx),
    );

    encodedTx.nonce = nextNonce;

    return { ...unsignedTx, encodedTx };
  }

  _toNormalAmount(value: string, decimals: number) {
    const valueBN = ethers.BigNumber.from(value);
    return ethers.utils.formatUnits(valueBN, decimals);
  }

  async fetchFeeInfo(encodedTx: IEncodedTxEvm): Promise<IFeeInfo> {
    // NOTE: for fetching gas limit, we don't want blockchain-libs to fetch
    // other info such as gas price and nonce. Therefore the hack here to
    // avoid redundant network requests.
    // And extract gas & gasLimit to ensure always getting estimated gasLimit
    // from blockchain.

    const { gas, gasLimit, ...encodedTxWithFakePriceAndNonce } = {
      ...encodedTx,
      nonce: 1,
      gasPrice: '1',
    };

    const network = await this.getNetwork();

    // RPC: eth_gasPrice
    let { prices, networkCongestion, estimatedTransactionCount } =
      await this.engine.getGasInfo(this.networkId);

    // fi blocknative returns 5 gas gears, then take the middle 3 as the default prices
    if (prices.length === 5) {
      prices = prices.slice(1, 4);
    }

    const subNetworkSetting =
      this.settings.subNetworkSettings?.[this.networkId];
    if (subNetworkSetting?.isIntegerGasPrice) {
      prices = prices.map((p) => {
        if (isString(p)) {
          return new BigNumber(p).toFixed(0);
        }
        return p;
      });
    }

    const { actions } = await this.decodeTxMemoizee(encodedTx);

    let unsignedTx: IUnsignedTxPro | undefined;
    if (
      actions.length === 1 &&
      actions?.[0]?.type === IDecodedTxActionType.NATIVE_TRANSFER
    ) {
      // First try using value=0 to calculate native transfer gas limit to
      // avoid maximum transfer failure.
      try {
        // RPC: eth_getCode
        //      client.isContract(toAddress)
        // RPC: eth_estimateGas
        //   with 10s memoizee
        //      at blockchain-libs/dist/provider/chains/eth/geth.js
        unsignedTx = await this.buildUnsignedTxFromEncodedTx({
          ...encodedTxWithFakePriceAndNonce,
          // the estimated limit will be insufficient when value is 0x0 on filecoin evm
          value: this.networkId === OnekeyNetwork.fevm ? '0x1' : '0x0',
        });
      } catch (e) {
        console.error(e);
      }
    }

    if (typeof unsignedTx === 'undefined') {
      try {
        // RPC: eth_estimateGas
        unsignedTx = await this.buildUnsignedTxFromEncodedTx(
          encodedTxWithFakePriceAndNonce,
        );
      } catch (error) {
        debugLogger.common.error(error);
        throw error;
      }
    }

    // For L2 networks with L1 fee.
    let baseFeeValue = '0';
    if (OPTIMISM_NETWORKS.includes(this.networkId)) {
      // Optimism & Optimism Kovan
      // call gasL1Fee(bytes) of GasPriceOracle at 0x420000000000000000000000000000000000000F
      const txData = ethers.utils.serializeTransaction({
        value: encodedTx.value,
        data: encodedTx.data,
        gasLimit: `0x${(unsignedTx?.feeLimit ?? new BigNumber('0')).toString(
          16,
        )}`,
        to: encodedTx.to,
        chainId: 10, // any number other than 0 will lead to fixed length of data
        gasPrice: '0xf4240', // 0.001 Gwei
        nonce: 1,
      });

      // keccak256(Buffer.from('getL1Fee(bytes)')) => '0x49948e0e...'
      const data = `0x49948e0e${defaultAbiCoder
        .encode(['bytes'], [txData])
        .slice(2)}`;
      const client = await this.getJsonRPCClient();

      // RPC: eth_call
      const l1FeeHex = await client.rpc.call('eth_call', [
        { to: '0x420000000000000000000000000000000000000F', data },
        'latest',
      ]);
      // RPC: eth_getBlockByNumber (rpc status check?)
      // RPC: eth_getBalance useManageTokensOfAccount/useReloadAccountBalance
      //          may call multiple times
      baseFeeValue = new BigNumber(l1FeeHex as string)
        .shiftedBy(-network.feeDecimals)
        .toFixed();
    }

    const eip1559 = Boolean(
      prices?.length && prices?.every((price) => typeof price === 'object'),
    );

    // [{baseFee: '928.361757873', maxPriorityFeePerGas: '11.36366', maxFeePerGas: '939.725417873'}]
    // [10]
    const limit = BigNumber.max(
      unsignedTx?.feeLimit ?? '0',
      gas ?? '0',
      gasLimit ?? '0',
    ).toFixed();

    const limitForDisplay = !isNil(unsignedTx?.feeLimitForDisplay)
      ? new BigNumber(unsignedTx?.feeLimitForDisplay).toFixed()
      : undefined;

    return {
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      feeSymbol: network.feeSymbol,
      feeDecimals: network.feeDecimals,

      eip1559,
      limit,
      limitForDisplay,
      prices,
      defaultPresetIndex: '1',

      baseFeeValue,
      extraInfo: {
        networkCongestion,
        estimatedTransactionCount,
      },
    };
  }

  async attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTxEvm;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<IEncodedTxEvm> {
    const network = await this.getNetwork();
    const { encodedTx, feeInfoValue } = params;
    const encodedTxWithFee = { ...encodedTx };
    if (!isNil(feeInfoValue.limit)) {
      encodedTxWithFee.gas = toBigIntHex(new BigNumber(feeInfoValue.limit));
      encodedTxWithFee.gasLimit = toBigIntHex(
        new BigNumber(feeInfoValue.limit),
      );
    }
    // TODO to hex and shift decimals, do not shift decimals in fillUnsignedTxObj
    if (feeInfoValue.eip1559) {
      if (!isNil(feeInfoValue.price1559)) {
        const priceInfo = feeInfoValue.price1559;
        encodedTxWithFee.maxFeePerGas = toBigIntHex(
          new BigNumber(priceInfo?.maxFeePerGas ?? 0).shiftedBy(
            network.feeDecimals,
          ),
        );
        encodedTxWithFee.maxPriorityFeePerGas = toBigIntHex(
          new BigNumber(priceInfo?.maxPriorityFeePerGas ?? 0).shiftedBy(
            network.feeDecimals,
          ),
        );
        delete encodedTxWithFee.gasPrice;
      }
    } else if (!isNil(feeInfoValue.price)) {
      encodedTxWithFee.gasPrice = toBigIntHex(
        new BigNumber(feeInfoValue.price).shiftedBy(network.feeDecimals),
      );
    }

    return Promise.resolve(encodedTxWithFee);
  }

  async mmGetPublicKey(options: ISignCredentialOptions): Promise<string> {
    const dbAccount = await this.getDbAccount();
    if (dbAccount.id.startsWith('hd-') || dbAccount.id.startsWith('imported')) {
      const keyring = this.keyring as KeyringSoftwareBase;
      const { password } = options;
      if (typeof password === 'undefined') {
        throw new OneKeyInternalError('password required');
      }
      const { [dbAccount.address]: signer } = await keyring.getSigners(
        password,
        [dbAccount.address],
      );
      return (this.engineProvider as EthProvider).mmGetPublicKey(signer);
    }
    throw new NotImplemented(
      'Only software keryings support getting encryption key.',
    );
  }

  async mmDecrypt(
    message: string,
    options: ISignCredentialOptions,
  ): Promise<string> {
    const dbAccount = await this.getDbAccount();
    if (dbAccount.id.startsWith('hd-') || dbAccount.id.startsWith('imported')) {
      const keyring = this.keyring as KeyringSoftwareBase;
      const { password } = options;
      if (typeof password === 'undefined') {
        throw new OneKeyInternalError('password required');
      }
      const { [dbAccount.address]: signer } = await keyring.getSigners(
        password,
        [dbAccount.address],
      );
      return (this.engineProvider as EthProvider).mmDecrypt(message, signer);
    }
    throw new NotImplemented('Only software keryings support mm decryption.');
  }

  async personalECRecover(message: string, signature: string): Promise<string> {
    return (this.engineProvider as EthProvider).ecRecover(
      { type: ETHMessageTypes.PERSONAL_SIGN, message },
      signature,
    );
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

    // keccak256(Buffer.from('allowance(address,address)') => '0xdd62ed3e...'
    const allowanceMethodID = '0xdd62ed3e';
    const data = `${allowanceMethodID}${defaultAbiCoder
      .encode(['address', 'address'], [dbAccount.address, spenderAddress])
      .slice(2)}`;
    const client = await this.getJsonRPCClient();
    const rawAllowanceHex = await client.rpc.call('eth_call', [
      { to: token.tokenIdOnNetwork, data },
      'latest',
    ]);
    return new BigNumber(rawAllowanceHex as string).shiftedBy(-token.decimals);
  }

  override async batchTokensAllowance(
    tokenAddress: string,
    spenderAddresses: string[],
  ): Promise<number[]> {
    const calls: { to: string; data: string }[] = [];
    for (let i = 0; i < spenderAddresses.length; i += 1) {
      const spenderAddress = spenderAddresses[i];
      const [dbAccount, token] = await Promise.all([
        this.getDbAccount(),
        this.engine.ensureTokenInDB(this.networkId, tokenAddress),
      ]);

      if (typeof token === 'undefined') {
        // This will be catched by engine.
        console.error(`Token not found: ${tokenAddress}`);
        throw new Error();
      }

      const allowanceMethodID = '0xdd62ed3e';
      const data = `${allowanceMethodID}${defaultAbiCoder
        .encode(['address', 'address'], [dbAccount.address, spenderAddress])
        .slice(2)}`;
      calls.push({ to: token.tokenIdOnNetwork, data });
    }
    const client = await this.getJsonRPCClient();
    const rawAllowanceHexCallResults = await client.batchEthCall(calls);

    return rawAllowanceHexCallResults.map((value) => Number(value));
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
      displayAddress: ethers.utils.getAddress(dbAccount.address),
      template: dbAccount.template,
    };
  }

  override getDisplayAddress(address: string): Promise<string> {
    return Promise.resolve(ethers.utils.getAddress(address));
  }

  async getExportedCredential(password: string): Promise<string> {
    const dbAccount = await this.getDbAccount();
    if (dbAccount.id.startsWith('hd-') || dbAccount.id.startsWith('imported')) {
      const keyring = this.keyring as KeyringSoftwareBase;
      const [encryptedPrivateKey] = Object.values(
        await keyring.getPrivateKeys(password),
      );
      return `0x${decrypt(password, encryptedPrivateKey).toString('hex')}`;
    }
    throw new OneKeyInternalError(
      'Only credential of HD or imported accounts can be exported',
    );
  }

  // Chain only functionalities below.

  async buildNativeTransferAction(decodedTxLegacy: IDecodedTxLegacy) {
    const nativeToken = await this.engine.getNativeTokenInfo(this.networkId);
    return {
      tokenInfo: nativeToken,
      from: decodedTxLegacy.fromAddress,
      to: decodedTxLegacy.toAddress,
      amount: decodedTxLegacy.amount,
      amountValue: decodedTxLegacy.value,
      extraInfo: null,
    };
  }

  async buildTokenTransferAction(decodedTxLegacy: IDecodedTxLegacy) {
    const address = await this.getAccountAddress();
    const info = decodedTxLegacy.info as EVMDecodedItemERC20Transfer;
    return {
      tokenInfo: info.token,
      from: info.from ?? address,
      to: info.recipient,
      amount: info.amount,
      amountValue: info.value,
      extraInfo: null,
    };
  }

  async buildNFTTransferAcion(nftInfo: INFTInfo) {
    return Promise.resolve({
      asset: nftInfo.asset as NFTAsset,
      amount: nftInfo.amount,
      send: nftInfo.from,
      receive: nftInfo.to,
      extraInfo: null,
    });
  }

  override async proxyJsonRPCCall<T>(request: IJsonRpcRequest): Promise<T> {
    const client = await this.getJsonRPCClient();
    try {
      return await client.rpc.call(
        request.method,
        request.params as Record<string, any> | Array<any>,
      );
    } catch (e) {
      throw extractResponseError(e);
    }
  }

  override createClientFromURL(url: string): Geth {
    return new Geth(url);
  }

  fetchTokenInfos(
    tokenAddresses: string[],
  ): Promise<Array<PartialTokenInfo | undefined>> {
    return this.engine.providerManager.getTokenInfos(
      this.networkId,
      tokenAddresses,
    );
  }

  override async getAccountNonce(): Promise<number | null> {
    const nonce = await getTxCount(await this.getAccountAddress(), this);
    return nonce;
  }

  override async updatePendingTxs(histories: Array<HistoryEntry>) {
    const decoder = EVMTxDecoder.getDecoder(this.engine);
    const decodedPendings = histories
      .filter<HistoryEntryTransaction>(
        (h): h is HistoryEntryTransaction => 'rawTx' in h,
      )
      .filter((h) => h.status === HistoryEntryStatus.PENDING)
      .map(async (h) => ({
        entry: h,
        decodedItem: await decoder.decodeHistoryEntry(h),
      }));

    if (!decodedPendings.length) {
      return {};
    }

    const pendings = await Promise.all(decodedPendings);

    const updatedStatuses = await this.getTransactionStatuses(
      pendings.map(({ decodedItem }) => decodedItem.txHash),
    );

    // TODO: handle different addresses.
    const {
      decodedItem: { fromAddress },
    } = pendings[0];
    const nonce = await getTxCount(fromAddress, this);

    const updatedStatusMap: Record<string, HistoryEntryStatus> = {};
    updatedStatuses.forEach((status, index) => {
      const { entry, decodedItem } = pendings[index];
      const { id } = entry;
      const txNonce = decodedItem.nonce;
      if (
        status === TransactionStatus.NOT_FOUND ||
        status === TransactionStatus.INVALID
      ) {
        if (!isNil(txNonce) && txNonce < nonce) {
          updatedStatusMap[id] = HistoryEntryStatus.DROPPED;
        }
      } else if (status === TransactionStatus.CONFIRM_AND_SUCCESS) {
        updatedStatusMap[id] = HistoryEntryStatus.SUCCESS;
      } else if (status === TransactionStatus.CONFIRM_BUT_FAILED) {
        updatedStatusMap[id] = HistoryEntryStatus.FAILED;
      }
    });

    if (Object.keys(updatedStatusMap).length > 0) {
      await this.engine.dbApi.updateHistoryEntryStatuses(updatedStatusMap);
    }

    return updatedStatusMap;
  }

  // TODO mergeDecodedTx( { decodedTx, encodedTx, historyTx, rawTx }, extraTxMap: { covalentTx })
  //    call at saveSendConfirmHistory
  async mergeDecodedTx({
    decodedTx,
    encodedTx,
    historyTx,
    rawTx,
    // extra tx
    covalentTx,
    rpcReceiptTx,
    nftTxs,
    isCovalentApiAvailable,
  }: {
    decodedTx: IDecodedTx;
    encodedTx?: IEncodedTx;
    historyTx?: IHistoryTx;
    rawTx?: IRawTx;
    covalentTx?: ICovalentHistoryListItem;
    rpcReceiptTx?: any;
    nftTxs?: NFTTransaction[];
    isCovalentApiAvailable?: boolean;
  }): Promise<IDecodedTx> {
    const network = await this.getNetwork();
    if (historyTx) {
      // update local history tx info to decodedTx
      decodedTx = {
        ...historyTx.decodedTx,
        encodedTx: decodedTx.encodedTx ?? historyTx.decodedTx.encodedTx,
      };
    }
    // TODO parse covalentTx log_events to decodedTx.actions, like tokenTransfer actions
    if (covalentTx) {
      // TODO update time and status by RPC
      //    eth_getBlockByHash timestamp
      //    eth_getTransactionReceipt status
      const blockSignedAt = new Date(covalentTx.block_signed_at).getTime();
      decodedTx.updatedAt = blockSignedAt;
      decodedTx.createdAt = decodedTx.createdAt ?? blockSignedAt;
      decodedTx.status = covalentTx.successful
        ? IDecodedTxStatus.Confirmed
        : IDecodedTxStatus.Failed;
      decodedTx.signer = covalentTx.from_address || decodedTx.signer;
      decodedTx.outputActions =
        covalentTx.parsedDecodedTx?.outputActions || decodedTx.outputActions;
      const priceValue = new BigNumber(covalentTx.gas_price).toFixed();
      const priceGwei = convertFeeValueToGwei({
        value: priceValue,
        network,
      });
      const limit = new BigNumber(covalentTx.gas_offered).toFixed();
      const limitUsed = new BigNumber(covalentTx.gas_spent).toFixed();
      const defaultGasInfo: IFeeInfoUnit = {
        priceValue,
        price: priceGwei,
        limit,
        limitUsed,
      };
      decodedTx.feeInfo = decodedTx.feeInfo || defaultGasInfo;
      if (decodedTx && decodedTx.feeInfo) {
        decodedTx.feeInfo.limitUsed = limitUsed;
        decodedTx.feeInfo.limit = limit;
        if (decodedTx.feeInfo.eip1559) {
          const eip1559Fee = decodedTx.feeInfo.price1559 as EIP1559Fee;
          eip1559Fee.gasPrice = priceGwei;
          eip1559Fee.gasPriceValue = priceValue;
        }
      }
      decodedTx.isFinal = true;
      // TODO update outputActions
      // decodedTx.outputActions
    }
    // fetch by RPC:  eth_getTransactionReceipt
    if (rpcReceiptTx) {
      // TODO update status, limitUsed, updatedAt, isFinal, outputActions, nonce
    }

    // status may be updated by refreshPendingHistory task, so ignore pending here
    if (decodedTx.status !== IDecodedTxStatus.Pending) {
      if (!isCovalentApiAvailable) {
        if (
          decodedTx.createdAt &&
          Date.now() - decodedTx.createdAt >
            HISTORY_CONSTS.SET_IS_FINAL_EXPIRED_IN
        ) {
          decodedTx.isFinal = true;
        }
      }
    }
    const address = await this.getAccountAddress();
    decodedTx = this.mergeNFTTx({ address, decodedTx, nftTxs });
    return Promise.resolve(decodedTx);
  }

  mergeNFTTx({
    address,
    decodedTx,
    nftTxs,
  }: {
    address: string;
    decodedTx: IDecodedTx;
    nftTxs?: NFTTransaction[];
  }): IDecodedTx {
    if (nftTxs) {
      const nftActions = nftTxs
        .map((tx) =>
          createOutputActionFromNFTTransaction({
            transaction: tx,
            address,
          }),
        )
        .filter(Boolean);
      const outputActions = decodedTx.outputActions ?? [];
      const decodeTxActions = outputActions?.filter((a) => {
        const { tokenTransfer, tokenApprove, nftTransfer } = a;
        if (tokenTransfer || tokenApprove || nftTransfer) {
          const tokenInfo = tokenTransfer?.tokenInfo ?? tokenApprove?.tokenInfo;
          const assetInfo = nftTransfer?.asset;

          if (tokenInfo) {
            const { tokenIdOnNetwork, id } = tokenInfo;
            const findNFTTx = nftTxs.find(
              (tx) =>
                tx.contractAddress === tokenIdOnNetwork && tx.tokenId === id,
            );
            if (findNFTTx) {
              return false;
            }
          }

          if (assetInfo) {
            const findNFTTx = nftTxs.find(
              (tx) =>
                (tx.contractAddress === assetInfo.contractAddress ||
                  tx.tokenAddress === assetInfo.tokenAddress) &&
                (tx.tokenId === assetInfo.tokenId ||
                  tx.contractTokenId === assetInfo.contractTokenId),
            );
            if (findNFTTx) {
              return false;
            }
          }
        }
        return true;
      });
      decodedTx.outputActions = [...decodeTxActions, ...nftActions];
    }
    return decodedTx;
  }

  // TODO add limit here
  override async fetchOnChainHistory(options: {
    tokenIdOnNetwork?: string;
    localHistory?: IHistoryTx[];
  }): Promise<IHistoryTx[]> {
    const { tokenIdOnNetwork, localHistory = [] } = options;
    const localFinalHashes = localHistory
      .filter((item) => item.decodedTx.isFinal)
      .map((item) => item.decodedTx.txid);
    const chainId = await this.getNetworkChainId();
    const address = await this.getAccountAddress();
    const client = await this.getJsonRPCClient();
    /*
    {
      hash1: { covalentTx, alchemyTx, infStoneTx, explorerTx, rpcTx },
      hash2: { covalentTx, alchemyTx, infStoneTx, explorerTx, rpcTx },
    }

    - fetch hashes
    - filter hashes (not isFinal)
    - parse result
    - merge result
     */

    let hashes: string[] = [];
    let covalentTxList: ICovalentHistoryListItem[] = [];
    let isCovalentApiAvailable = false;
    try {
      // TODO covalentApi, AlchemyApi, InfStoneApi, blockExplorerApi, RPC api
      const covalentHistory = await covalentApi.fetchCovalentHistoryRaw({
        chainId,
        address,
        contract: tokenIdOnNetwork,
      });
      isCovalentApiAvailable = true;
      covalentTxList = covalentHistory.data.items;
      hashes = covalentTxList.map((item) => item.tx_hash);
    } catch (error) {
      console.error(error);
      // fallback localHistory which isLocalCreated to RPC query update gasUsed
      //    if covalentApi if fail or NOT support on this chain
      hashes = localHistory
        .filter((item) => !!item.isLocalCreated)
        .map((item) => item.decodedTx.txid);
    }

    // ignore localHistory isFinal
    hashes = difference(hashes, localFinalHashes);
    hashes = hashes.filter(Boolean);

    /*
   const batchCallParams2 = hashes.map(
      (hash) => ['eth_getTransactionReceipt', [hash]] as [string, string[]],
    );
    // TODO batchCall one by one
    await client.rpc.batchCall(batchCallParams2);
    */

    const batchCallParams = hashes.map(
      // TODO eth_getTransactionByHash eth_getTransactionReceipt
      (hash) => ['eth_getTransactionByHash', [hash]] as [string, string[]],
    );
    let rpcTxList: Array<IRpcTxEvm | null> = [];

    if (batchCallParams.length) {
      try {
        rpcTxList = await client.rpc.batchCall(batchCallParams);
      } catch (error) {
        console.error(error);
      }
    }

    const nftMap = await getNFTTransactionHistory(address, this.networkId);

    const historyTxList = await Promise.all(
      hashes.map(async (hash, index) => {
        // pending tx rpc return null
        let encodedTx = rpcTxList.find((item) => item?.hash === hash);
        const isRpcTx = Boolean(encodedTx);
        // *** update rpcTx tx.data from tx.input
        if (encodedTx && isRpcTx && encodedTx.input && !encodedTx.data) {
          encodedTx.data = encodedTx.input;
        }

        const historyTx = localHistory.find(
          (item) => item.decodedTx.txid === hash,
        );
        if (historyTx?.decodedTx?.isFinal) {
          return null;
        }

        encodedTx =
          encodedTx ||
          (historyTx?.decodedTx?.encodedTx as IEncodedTxEvm | undefined);
        if (encodedTx) {
          // *** update tx.nonce
          // convert 0x string to number, chain-libs need number type
          if (isString(encodedTx.nonce)) {
            encodedTx.nonce = new BigNumber(encodedTx.nonce).toNumber() ?? 0;
          }
        }

        let covalentTx = covalentTxList.find(
          (covalentTxItem) => covalentTxItem.tx_hash === hash,
        );
        if (covalentTx) {
          covalentTx = await covalentApi.parseCovalentTxToDecodedTx({
            covalentTx,
            address,
            vault: this,
            encodedTx,
          });
        }

        let decodedTx = covalentTx?.parsedDecodedTx;

        if (!decodedTx && covalentTx?.onlyInvolvedInDelegateVotesChanged) {
          return null;
        }

        if (encodedTx) {
          // TODO _decode getOrAddToken RPC error
          // TODO encodedTx both transfer Native and Token
          try {
            decodedTx = await this.decodeTx(encodedTx, null);
          } catch (error) {
            console.error(error);
          }
        }

        if (!decodedTx) {
          return null;
        }
        const nftTxs = nftMap[hash] as NFTTransaction[];
        decodedTx = await this.mergeDecodedTx({
          decodedTx,
          encodedTx,
          historyTx,
          covalentTx,
          nftTxs,
          isCovalentApiAvailable,
        });

        decodedTx.tokenIdOnNetwork = tokenIdOnNetwork;

        // TODO merge decodedTx info from local pending history

        return this.buildHistoryTx({
          decodedTx,
          encodedTx,
          historyTxToMerge: historyTx,
        });
      }),
    );
    return historyTxList.filter(Boolean);
    // TODO batchCall not supported chain, fallback parse covalentTxList to decodedTx
  }

  override async checkIsScamHistoryTx(historyTx: IHistoryTx) {
    try {
      const { decodedTx } = historyTx;
      const { encodedTx } = decodedTx;

      const from = (encodedTx as IEncodedTxEvm)?.from.toLowerCase();
      const to = (encodedTx as IEncodedTxEvm)?.to?.toLowerCase();
      const address = (await this.getAccountAddress()).toLocaleLowerCase();
      if (from === address || to === address) return false;

      const actions = decodedTx.outputActions || decodedTx.actions;

      for (let i = 0; i < actions.length; i += 1) {
        const action = actions[i];
        if (action.type !== IDecodedTxActionType.TOKEN_TRANSFER) return false;

        if (
          action.type === IDecodedTxActionType.TOKEN_TRANSFER &&
          action.tokenTransfer?.amount &&
          !new BigNumber(action.tokenTransfer?.amount).isZero()
        ) {
          const impl = await this.getNetworkImpl();
          const uniqueTokenSymbols = UNIQUE_TOKEN_SYMBOLS[impl] ?? [];
          const { tokenInfo } = action.tokenTransfer;

          if (
            uniqueTokenSymbols.includes(tokenInfo.symbol.toUpperCase()) &&
            tokenInfo.riskLevel &&
            tokenInfo.riskLevel > TokenRiskLevel.WARN
          ) {
            return true;
          }

          return false;
        }

        if (
          action.type === IDecodedTxActionType.TOKEN_TRANSFER &&
          action.tokenTransfer?.amount &&
          new BigNumber(action.tokenTransfer?.amount).isZero() &&
          [
            action.tokenTransfer.from.toLocaleLowerCase(),
            action.tokenTransfer.to.toLocaleLowerCase(),
          ].includes(from)
        )
          return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  override fixAddressCase(address: string) {
    // TODO replace `engineUtils.fixAddressCase`
    return Promise.resolve(toLower(address || ''));
  }

  override isContractAddress = memoizee(
    async (address: string): Promise<boolean> => {
      try {
        await this.validateAddress(address);
        const client = await this.getJsonRPCClient();
        return await client.isContract(address);
      } catch {
        return Promise.resolve(false);
      }
    },
    {
      promise: true,
      max: 50,
    },
  );

  override async getAccountNameInfoMap(): Promise<
    Record<string, AccountNameInfo>
  > {
    const network = await this.getNetwork();
    let accountNameInfo = getAccountNameInfoByImpl(network.impl);
    if (network.id !== OnekeyNetwork.etc) {
      accountNameInfo = omit(accountNameInfo, 'etcNative');
    }
    return accountNameInfo;
  }

  override async filterAccounts({
    accounts,
    networkId,
  }: {
    accounts: DBAccount[];
    networkId: string;
  }): Promise<DBAccount[]> {
    if (networkId !== OnekeyNetwork.etc) {
      return accounts.filter((account) => account.coinType !== COINTYPE_ETC);
    }
    return Promise.resolve(accounts);
  }

  override shouldChangeAccountWhenNetworkChanged({
    previousNetwork,
    newNetwork,
    activeAccountId,
  }: {
    previousNetwork: Network | undefined;
    newNetwork: Network | undefined;
    activeAccountId: string | null;
  }): Promise<{
    shouldReloadAccountList: boolean;
    shouldChangeActiveAccount: boolean;
  }> {
    const prevNetworkIsEtc = previousNetwork?.id === OnekeyNetwork.etc;
    const newNetworkIsEtc = newNetwork?.id === OnekeyNetwork.etc;
    const newNetworkIsEvm = newNetwork?.impl === IMPL_EVM && !newNetworkIsEtc;
    const prevNetworkIsOtherEvm =
      previousNetwork?.impl === IMPL_EVM && !prevNetworkIsEtc;
    const isETCAccount = activeAccountId?.indexOf(`m/44'/61'/0'/`);
    // The previous network is ETC, the new network is another evm chain
    // but the current account is with etc, so it needs to be refreshed
    const shouldChangeActiveAccount =
      prevNetworkIsEtc && newNetworkIsEvm && !!isETCAccount;

    return Promise.resolve({
      shouldChangeActiveAccount,
      shouldReloadAccountList: shouldChangeActiveAccount
        ? // If need to refresh activeAccount, then don't need to refresh the account list additionally
          false
        : // The previous network is the evm chain, the next network is etc
          // the CoinType61 account needs to be refreshed
          newNetworkIsEtc && prevNetworkIsOtherEvm,
    });
  }

  override async canAutoCreateNextAccount(password: string): Promise<boolean> {
    return Promise.resolve(true);
  }

  override async checkRpcBatchSupport(
    url: string,
  ): Promise<IClientEndpointStatus> {
    let result: IClientEndpointStatus | undefined;
    const client = await this.getJsonRPCClient();
    const start = performance.now();
    try {
      const res = await client.rpc.batchCall<Array<string>>(
        [
          ['eth_blockNumber', []],
          [
            'eth_getBalance',
            // fake address
            ['0xf44371ccc370662734cfc4b78b1beadf7012bc5d', 'latest'],
          ],
          ['eth_gasPrice', []],
        ],
        undefined,
        undefined,
        true,
        false,
      );
      const latestBlock = new BigNumber(res[0]).toNumber();
      if (
        Number.isNaN(latestBlock) ||
        typeof res[1] !== 'string' ||
        typeof res[2] !== 'string'
      ) {
        throw new Error(
          `[evm.getClientEndpointStatus] Invalid response ${JSON.stringify(
            res,
          )}`,
        );
      }
      result = {
        rpcBatchSupported: true,
        responseTime: Math.floor(performance.now() - start),
        latestBlock,
      };
    } catch (e) {
      result = await super.getClientEndpointStatus(url);
      result.rpcBatchSupported = false;
    }

    return result;
  }

  override async fetchRpcChainId(url: string): Promise<string> {
    const chainId = await this.engine.providerManager.getEVMChainId(url);
    return String(chainId);
  }

  override async getUserNFTAssets({
    serviceData,
  }: {
    serviceData: NFTListItems;
  }): Promise<NFTAssetMeta | undefined> {
    return Promise.resolve({
      type: NFTAssetType.EVM,
      data: serviceData as Collection[],
    });
  }
}
