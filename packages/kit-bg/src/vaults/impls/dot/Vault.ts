/* eslint-disable @typescript-eslint/no-unused-vars */
import { ApiPromise, HttpProvider, WsProvider } from '@polkadot/api';
import { hexToNumber, u8aToHex } from '@polkadot/util';
import {
  checkAddress,
  decodeAddress,
  encodeAddress,
} from '@polkadot/util-crypto';
import { decode, methods } from '@substrate/txwrapper-polkadot';
import BigNumber from 'bignumber.js';
import { md5 } from 'js-md5';
import { isEmpty, isNaN, isNil, isObject, omit, orderBy } from 'lodash';

import { serializeSignedTransaction } from '@onekeyhq/core/src/chains/dot/sdkDot';
import type { IEncodedTxDot } from '@onekeyhq/core/src/chains/dot/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import {
  BalanceLowerMinimum,
  InvalidTransferValue,
  NotImplemented,
  OneKeyInternalError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import numberUtils from '@onekeyhq/shared/src/utils/numberUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IAddressValidation,
  IFetchServerAccountDetailsParams,
  IFetchServerAccountDetailsResponse,
  IGeneralInputValidation,
  INetworkAccountAddressDetail,
  IPrivateKeyValidation,
  IXprvtValidation,
  IXpubValidation,
} from '@onekeyhq/shared/types/address';
import type {
  IMeasureRpcStatusParams,
  IMeasureRpcStatusResult,
} from '@onekeyhq/shared/types/customRpc';
import type {
  IEstimateFeeParams,
  IEstimateGasParams,
  IEstimateGasResp,
  IFeeInfoUnit,
  IServerEstimateFeeResponse,
  ITronResourceRentalInfo,
} from '@onekeyhq/shared/types/fee';
import { ESendPreCheckTimingEnum } from '@onekeyhq/shared/types/send';
import type {
  IFetchServerTokenDetailParams,
  IFetchServerTokenDetailResponse,
  IFetchServerTokenListApiParams,
  IFetchServerTokenListParams,
  IFetchServerTokenListResponse,
  IServerAccountTokenItem,
} from '@onekeyhq/shared/types/serverToken';
import type {
  IAccountToken,
  IFetchTokenDetailItem,
  ITokenData,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';
import {
  EDecodedTxActionType,
  EDecodedTxDirection,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';
import type {
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxTransferInfo,
} from '@onekeyhq/shared/types/tx';

import { VaultBase } from '../../base/VaultBase';

import { KeyringExternal } from './KeyringExternal';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import {
  getBlockInfo,
  getGenesisHash,
  getMetadataRpc,
  getMinAmount,
  getRegistry,
  getRuntimeVersion,
  getTransactionTypeFromTxInfo,
} from './utils';

import type { IDBWalletType } from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';
import type {
  IBroadcastTransactionByCustomRpcParams,
  IBuildAccountAddressDetailParams,
  IBuildDecodedTxParams,
  IBuildEncodedTxParams,
  IBuildUnsignedTxParams,
  IGetPrivateKeyFromImportedParams,
  IGetPrivateKeyFromImportedResult,
  INativeAmountInfo,
  IUpdateUnsignedTxParams,
  IValidateGeneralInputParams,
} from '../../types';
import type { ProviderInterface } from '@polkadot/rpc-provider/types';
import type { Type } from '@polkadot/types';
import type { Args, TypeRegistry } from '@substrate/txwrapper-polkadot';

export default class VaultDot extends VaultBase {
  override coreApi = coreChainApi.dot.hd;

  override keyringMap: Record<IDBWalletType, typeof KeyringBase | undefined> = {
    hd: KeyringHd,
    qr: undefined,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringExternal,
  };

  override async buildAccountAddressDetail(
    params: IBuildAccountAddressDetailParams,
  ): Promise<INetworkAccountAddressDetail> {
    const { account, networkInfo, networkId, externalAccountAddress } = params;

    let address = account.address || externalAccountAddress || '';
    const baseAddress = address;
    if (account.pub) {
      const pubKeyBytes = bufferUtils.hexToBytes(
        hexUtils.stripHexPrefix(account.pub),
      );
      address = encodeAddress(pubKeyBytes, +networkInfo.addressPrefix);
    }

    return {
      networkId,
      normalizedAddress: baseAddress,
      displayAddress: address,
      address,
      baseAddress,
      isValid: true,
      allowEmptyAddress: false,
    };
  }

  private async _getTxBaseInfo(): Promise<{
    blockHash: `0x${string}`;
    blockNumber: number;
    genesisHash: `0x${string}`;
    metadataRpc: `0x${string}`;
    specName: string;
    specVersion: number;
    transactionVersion: number;
    registry: TypeRegistry;
  }> {
    const customRpcClient = await this.getCustomApiPromise();
    const [
      { specName, specVersion, transactionVersion },
      genesisHash,
      metadataRpc,
      { blockHash, blockNumber },
    ] = await Promise.all([
      getRuntimeVersion(this.networkId, this.backgroundApi, customRpcClient),
      getGenesisHash(this.networkId, this.backgroundApi, customRpcClient),
      getMetadataRpc(this.networkId, this.backgroundApi, customRpcClient),
      getBlockInfo(this.networkId, this.backgroundApi, customRpcClient),
    ]);
    const info = {
      metadataRpc,
      specName: specName as 'polkadot',
      specVersion,
      chainName: await this.getNetworkChainId(),
    };
    const registry = await getRegistry(
      { ...info, networkId: this.networkId },
      this.backgroundApi,
      customRpcClient,
    );
    return {
      ...info,
      blockNumber,
      transactionVersion,
      blockHash,
      genesisHash,
      registry,
    };
  }

  override async buildEncodedTx(
    params: IBuildEncodedTxParams,
  ): Promise<IEncodedTx> {
    const { transfersInfo } = params;
    if (!transfersInfo || !transfersInfo[0].to) {
      throw new OneKeyLocalError('Invalid transferInfo.to params');
    }
    const networkInfo = await this.getNetworkInfo();

    const { to, amount, tokenInfo, keepAlive } = transfersInfo[0];
    const from = await this.getAccountAddress();
    const toAccountId = decodeAddress(
      to,
      true,
      networkInfo?.addressPrefix ? +networkInfo.addressPrefix : 0,
    );

    const chainId = await this.getNetworkChainId();
    let toAccount = { id: to };
    if (chainId === 'joystream' || chainId === 'hydration') {
      toAccount = hexUtils.addHexPrefix(
        bufferUtils.bytesToHex(toAccountId),
      ) as unknown as { id: string };
    }

    let amountValue;

    const network = await this.getNetwork();
    const txBaseInfo = await this._getTxBaseInfo();

    const info = {
      ...txBaseInfo,
      address: from,
      eraPeriod: 64,
      nonce: 0,
      tip: 0,
    };

    const option = {
      metadataRpc: txBaseInfo.metadataRpc,
      registry: txBaseInfo.registry,
    };

    let unsigned;
    if (tokenInfo && tokenInfo?.address && !tokenInfo.isNative) {
      amountValue = new BigNumber(amount)
        .shiftedBy(tokenInfo.decimals)
        .toFixed(0);

      if (chainId === 'asset-hub') {
        const asset = {
          parents: 0,
          interior: {
            X2: [
              {
                palletInstance: 50,
              },
              {
                generalIndex: parseInt(tokenInfo.address, 10),
              },
            ],
          },
        };

        if (keepAlive) {
          unsigned = methods.assets.transferKeepAlive(
            {
              id: parseInt(tokenInfo.address, 10),
              target: to,
              amount: amountValue,
            },
            {
              ...info,
              assetId: asset,
            },
            option,
          );
        } else {
          unsigned = methods.assets.transfer(
            {
              id: parseInt(tokenInfo.address, 10),
              target: to,
              amount: amountValue,
            },
            {
              ...info,
              assetId: asset,
            },
            option,
          );
        }
      } else if (keepAlive) {
        unsigned = methods.assets.transferKeepAlive(
          {
            id: parseInt(tokenInfo.address, 10),
            target: to,
            amount: amountValue,
          },
          info,
          option,
        );
      } else {
        unsigned = methods.assets.transfer(
          {
            id: parseInt(tokenInfo.address, 10),
            target: to,
            amount: amountValue,
          },
          info,
          option,
        );
      }
    } else {
      console.log('======>>>>>> buildEncodedTx tokenInfo send native');

      amountValue = new BigNumber(amount)
        .shiftedBy(network.decimals)
        .toFixed(0);
      if (keepAlive) {
        unsigned = methods.balances.transferKeepAlive(
          {
            value: amountValue,
            dest: toAccount,
          },
          info,
          option,
        );
      } else if (chainId === 'joystream') {
        unsigned = methods.balances.transfer(
          {
            value: amountValue,
            dest: toAccount,
          },
          info,
          option,
        );
      } else {
        console.log('=====>>>>> ', `sssssss ${amountValue} ${toAccount}`);

        unsigned = methods.balances.transferAllowDeath(
          {
            value: amountValue,
            dest: toAccount,
          },
          info,
          option,
        );
      }
    }

    return {
      ...unsigned,
      specName: txBaseInfo.specName,
      chainName: network.name,
      metadataRpc: '' as unknown as `0x${string}`,
    };
  }

  private async _decodeUnsignedTx(unsigned: IEncodedTxDot) {
    let { metadataRpc } = unsigned;
    const customRpcClient = await this.getCustomApiPromise();
    if (!metadataRpc) {
      metadataRpc = await getMetadataRpc(
        this.networkId,
        this.backgroundApi,
        customRpcClient,
      );
    }
    const registry = await getRegistry(
      {
        specName: unsigned.specName,
        specVersion: unsigned.specVersion,
        metadataRpc,
        networkId: this.networkId,
      },
      this.backgroundApi,
      customRpcClient,
    );

    const decodedUnsigned = decode(unsigned, {
      metadataRpc,
      registry,
    });

    return {
      decodedUnsigned,
      registry,
    };
  }

  private async _getAddressByTxArgs(args: Args): Promise<string> {
    const chainId = await this.getNetworkChainId();
    if (chainId === 'joystream' || chainId === 'hydration') {
      return args.dest as string;
    }
    if (chainId === 'asset-hub') {
      const arg = args as {
        target?: { id?: string }; // asset hub token transfer
        dest?: { id?: string }; // asset hub native transfer
      };
      return arg.target?.id ?? arg.dest?.id ?? '';
    }
    return (args.dest as { id: string }).id;
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const { unsignedTx } = params;

    const encodedTx = unsignedTx.encodedTx as IEncodedTxDot;

    const chainId = await this.getNetworkChainId();
    const account = await this.getAccount();

    const { decodedUnsigned: decodeUnsignedTx, registry } =
      await this._decodeUnsignedTx(encodedTx);

    let action: IDecodedTxAction | null = null;
    const actionType = getTransactionTypeFromTxInfo(decodeUnsignedTx);

    if (actionType === EDecodedTxActionType.ASSET_TRANSFER) {
      const from = account.address;
      let to = '';
      let amount = '';

      const networkInfo = await this.getNetworkInfo();
      let assetId = '';

      if (
        chainId === 'asset-hub' &&
        decodeUnsignedTx.method.pallet === 'assets'
      ) {
        assetId = decodeUnsignedTx.method.args.id?.toString() ?? '';
      }

      const tokenInfo = await this.backgroundApi.serviceToken.getToken({
        accountId: this.accountId,
        networkId: this.networkId,
        tokenIdOnNetwork: assetId || (networkInfo.nativeTokenAddress ?? ''),
      });

      if (tokenInfo) {
        const { value: tokenAmount, amount: tokenAmountAsset } =
          decodeUnsignedTx.method.args;
        to = await this._getAddressByTxArgs(decodeUnsignedTx.method.args);

        if (decodeUnsignedTx.method.name === 'transferAll') {
          const balance = new BigNumber(
            params.transferPayload?.amountToSend ?? 0,
          ).shiftedBy(tokenInfo.decimals);
          const feeInfo = unsignedTx.feeInfo;
          const fee = feeInfo
            ? new BigNumber(feeInfo.gas?.gasLimit ?? 0)
                .times(new BigNumber(feeInfo.gas?.gasPrice ?? 0))
                .shiftedBy(feeInfo.common.feeDecimals)
            : 0;
          amount = balance.minus(fee).toFixed();
        } else {
          amount =
            tokenAmount?.toString() ?? tokenAmountAsset?.toString() ?? '0';
        }

        const transferAction: IDecodedTxTransferInfo = {
          from,
          to,
          amount: new BigNumber(amount)
            .shiftedBy(-tokenInfo.decimals)
            .toFixed(),
          icon: tokenInfo.logoURI ?? '',
          name: tokenInfo.symbol,
          symbol: tokenInfo.symbol,
          tokenIdOnNetwork: tokenInfo.address,
          isNFT: false,
          isNative: tokenInfo.symbol === networkInfo.nativeTokenAddress,
        };

        action = await this.buildTxTransferAssetAction({
          from,
          to,
          transfers: [transferAction],
        });
      }
    }

    if (!action) {
      action = {
        type: EDecodedTxActionType.UNKNOWN,
        direction: EDecodedTxDirection.OTHER,
        unknownAction: {
          from: account.address,
          to: '',
        },
      };
    }

    const result: IDecodedTx = {
      txid: '',
      owner: account.address,
      signer: account.address,
      nonce: decodeUnsignedTx.nonce,
      actions: [action],
      status: EDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      feeInfo: encodedTx?.feeInfo,
      extraInfo: null,
      encodedTx,
    };

    return result;
  }

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const encodedTx = (params.encodedTx ??
      (await this.buildEncodedTx(params))) as IEncodedTxDot;
    if (encodedTx) {
      return {
        encodedTx,
      };
    }
    throw new OneKeyInternalError();
  }

  override async attachFeeInfoToDAppEncodedTx(params: {
    encodedTx: IEncodedTx;
    feeInfo: IFeeInfoUnit;
  }): Promise<IEncodedTx> {
    // dApp not edit fee
    return Promise.resolve('');
  }

  override async updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    console.log('========>>>>>>> updateUnsignedTx start: ', params);

    const { unsignedTx, nativeAmountInfo } = params;
    let encodedTx = unsignedTx.encodedTx as IEncodedTxDot;
    if (params.nonceInfo) {
      encodedTx.nonce = hexUtils.hexlify(params.nonceInfo.nonce, {
        hexPad: 'left',
      }) as `0x${string}`;
    }
    if (params.feeInfo) {
      encodedTx.feeInfo = params.feeInfo;
    }
    const extraTip = new BigNumber(params.feeInfo?.feeDot?.extraTipInDot ?? '0')
      .shiftedBy(params.feeInfo?.common.feeDecimals ?? 0)
      .toFixed();

    const customRpcClient = await this.getCustomApiPromise();
    const chainId = await this.getNetworkChainId();
    const { decodedUnsigned: decodeUnsignedTx } = await this._decodeUnsignedTx(
      encodedTx,
    );

    // send max amount
    if (nativeAmountInfo) {
      const type = getTransactionTypeFromTxInfo(decodeUnsignedTx);
      if (type === EDecodedTxActionType.ASSET_TRANSFER) {
        const txBaseInfo = await this._getTxBaseInfo();
        const from = await this.getAccountAddress();

        const info = {
          ...txBaseInfo,
          address: from,
          eraPeriod: 64,
          nonce: decodeUnsignedTx.nonce ?? 0,
          tip: 0,
        };

        const option = {
          metadataRpc: txBaseInfo.metadataRpc,
          registry: txBaseInfo.registry,
        };

        const network = await this.getNetwork();
        const amountValue = new BigNumber(nativeAmountInfo.maxSendAmount ?? '0')
          .shiftedBy(network.decimals)
          .minus(extraTip)
          .toFixed(0);
        const dest = decodeUnsignedTx.method.args.dest as { id: string };

        let tx;
        if (decodeUnsignedTx.method?.name?.indexOf('KeepAlive') !== -1) {
          tx = methods.balances.transferKeepAlive(
            {
              value: amountValue,
              dest,
            },
            info,
            option,
          );
        } else {
          tx = methods.balances.transferAll(
            {
              dest,
              keepAlive: false,
            },
            info,
            option,
          );
        }
        encodedTx = {
          ...tx,
          specName: txBaseInfo.specName,
          chainName: network.name,
          metadataRpc: '' as `0x${string}`,
        };
      }
    } else if (
      chainId === 'asset-hub' &&
      decodeUnsignedTx.method.pallet === 'assets'
    ) {
      const type = getTransactionTypeFromTxInfo(decodeUnsignedTx);
      if (type === EDecodedTxActionType.ASSET_TRANSFER) {
        const assetId = decodeUnsignedTx.method.args.id?.toString() ?? '';
        const amount = decodeUnsignedTx.method.args.amount as string;

        const txBaseInfo = await this._getTxBaseInfo();
        const from = await this.getAccountAddress();

        const info = {
          ...txBaseInfo,
          address: from,
          eraPeriod: 64,
          nonce: decodeUnsignedTx.nonce ?? 0,
          tip: 0,
        };

        const option = {
          metadataRpc: txBaseInfo.metadataRpc,
          registry: txBaseInfo.registry,
        };
        const to = await this._getAddressByTxArgs(decodeUnsignedTx.method.args);

        const tokenList = await this.fetchTokenList({
          accountId: this.accountId,
          requestApiParams: {
            accountAddress: from,
            networkId: this.networkId,
            contractList: [assetId],
            hiddenTokens: [],
          },
          flag: 'dot-updateUnsignedTx-send-token',
        });
        const tokenInfo = tokenList.data.data.tokens.data.find(
          (token) => token.address === assetId,
        );

        if (!tokenInfo) {
          throw new OneKeyInternalError({
            message: 'updateUnsignedTx not found tokenInfo',
            key: ETranslations.send_engine_incorrect_token_address,
          });
        }
        const token = tokenList.data.data.tokens.map[tokenInfo?.$key];

        if (new BigNumber(amount).gte(new BigNumber(token.balance))) {
          const minBalance = await getMinAmount(
            this.networkId,
            this.backgroundApi,
            assetId,
          );
          const amountValue = new BigNumber(amount ?? '0')
            .minus(minBalance)
            .toFixed(0);

          const asset = {
            parents: 0,
            interior: {
              X2: [
                {
                  palletInstance: 50,
                },
                {
                  generalIndex: parseInt(tokenInfo.address, 10),
                },
              ],
            },
          };

          let tx;
          if (decodeUnsignedTx.method?.name?.indexOf('KeepAlive') !== -1) {
            tx = methods.assets.transferKeepAlive(
              {
                id: parseInt(tokenInfo.address, 10),
                target: to,
                amount: amountValue,
              },
              {
                ...info,
                assetId: asset,
              },
              option,
            );
          } else {
            tx = methods.assets.transfer(
              {
                id: parseInt(tokenInfo.address, 10),
                target: to,
                amount: amountValue,
              },
              {
                ...info,
                assetId: asset,
              },
              option,
            );
          }

          const network = await this.getNetwork();
          encodedTx = {
            ...tx,
            specName: txBaseInfo.specName,
            chainName: network.name,
            metadataRpc: '' as `0x${string}`,
          };
        }
      }
    }

    if (!params.nonceInfo && !encodedTx.isFromDapp) {
      const blockInfo = await getBlockInfo(
        this.networkId,
        this.backgroundApi,
        customRpcClient,
      );
      const registry = await getRegistry(
        {
          networkId: this.networkId,
          metadataRpc: encodedTx.metadataRpc,
          specName: (encodedTx.specName ?? '') as 'polkadot',
          specVersion: +encodedTx.specVersion,
        },
        this.backgroundApi,
        customRpcClient,
      );
      const era = registry.createType('ExtrinsicEra', {
        current: blockInfo.blockNumber,
        period: 64,
      });
      encodedTx = {
        ...encodedTx,
        blockHash: blockInfo.blockHash,
        blockNumber: blockInfo.blockNumber as unknown as `0x${string}`,
        era: era.toHex(),
      };
    }

    if (params.feeInfo?.feeDot && !encodedTx.isFromDapp) {
      // dApp transactions don't set tips as they handle fees differently
      encodedTx.tip = numberUtils.numberToHex(extraTip) as `0x${string}`;
    }

    return {
      encodedTx,
      feeInfo: params.feeInfo,
    };
  }

  override async validateAddress(address: string): Promise<IAddressValidation> {
    const networkInfo = await this.getNetworkInfo();
    let isValid = true;
    try {
      const [result] = checkAddress(address, +networkInfo.addressPrefix);
      isValid = result;
    } catch (error) {
      isValid = false;
    }
    return {
      isValid,
      normalizedAddress: address,
      displayAddress: address,
    };
  }

  override async validateXpub(xpub: string): Promise<IXpubValidation> {
    return {
      isValid: false,
    };
  }

  override getPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    return this.baseGetPrivateKeyFromImported(params);
  }

  override async validateXprvt(xprvt: string): Promise<IXprvtValidation> {
    return {
      isValid: false,
    };
  }

  override validatePrivateKey(
    privateKey: string,
  ): Promise<IPrivateKeyValidation> {
    return this.baseValidatePrivateKey(privateKey);
  }

  override async validateGeneralInput(
    params: IValidateGeneralInputParams,
  ): Promise<IGeneralInputValidation> {
    const { result } = await this.baseValidateGeneralInput(params);
    return result;
  }

  override async buildEstimateFeeParams({
    encodedTx,
  }: {
    encodedTx: IEncodedTxDot | undefined;
  }) {
    if (!encodedTx) {
      return { encodedTx };
    }

    const fakeSignature = Buffer.concat([
      Buffer.from([0x01]),
      Buffer.alloc(64).fill(0x42),
    ]);
    const tx = await serializeSignedTransaction(
      {
        ...encodedTx,
        metadataRpc: await getMetadataRpc(
          this.networkId,
          this.backgroundApi,
          await this.getCustomApiPromise(),
        ),
      },
      fakeSignature.toString('hex'),
    );
    return {
      encodedTx: bufferUtils
        .toBuffer(tx)
        .toString('base64') as unknown as IEncodedTx,
    };
  }

  private _getBalance = memoizee(
    async (address: string) => {
      const account =
        await this.backgroundApi.serviceAccountProfile.fetchAccountInfo({
          accountId: this.accountId,
          networkId: this.networkId,
          accountAddress: address,
          withNetWorth: true,
        });
      return new BigNumber(account.balance ?? 0);
    },
    { promise: true, maxAge: 10_000 },
  );

  override async validateSendAmount({
    to,
    amount,
    isNative,
    tokenBalance,
  }: {
    to: string;
    amount: string;
    tokenBalance: string;
    isNative?: boolean;
  }): Promise<boolean> {
    const customRpcClient = await this.getCustomApiPromise();
    // preload registry
    void getRegistry(
      {
        networkId: this.networkId,
      },
      this.backgroundApi,
      customRpcClient,
    );
    if (isNil(amount) || isEmpty(amount) || isEmpty(to)) {
      return true;
    }
    if (isNative) {
      const network = await this.getNetwork();

      const sendAmount = new BigNumber(amount).shiftedBy(network.decimals);
      const minAmount = await getMinAmount(
        this.networkId,
        this.backgroundApi,
        undefined,
        customRpcClient,
      );
      const balance = await this._getBalance(to);

      if (balance.plus(sendAmount).lt(minAmount)) {
        throw new InvalidTransferValue({
          key: ETranslations.form_amount_recipient_activate,
          info: {
            amount: minAmount.shiftedBy(-network.decimals).toFixed(),
            unit: network.symbol,
          },
        });
      }
    }
    return true;
  }

  override async precheckUnsignedTx(params: {
    unsignedTx: IUnsignedTxPro;
    nativeAmountInfo?: INativeAmountInfo;
    precheckTiming: ESendPreCheckTimingEnum;
    feeInfo?: IFeeInfoUnit;
  }): Promise<boolean> {
    if (params.precheckTiming !== ESendPreCheckTimingEnum.Confirm) {
      return true;
    }
    if (params.nativeAmountInfo?.maxSendAmount) {
      return true;
    }
    const { unsignedTx, feeInfo } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxDot;
    const { decodedUnsigned: decodedUnsignedTx } = await this._decodeUnsignedTx(
      encodedTx,
    );
    const actionType = getTransactionTypeFromTxInfo(decodedUnsignedTx);

    if (actionType === EDecodedTxActionType.ASSET_TRANSFER) {
      const args = decodedUnsignedTx.method.args as {
        dest: string;
        value: string;
      };

      const toAddress = await this._getAddressByTxArgs(args);
      if (toAddress === encodedTx.address) {
        return true;
      }

      const customRpcClient = await this.getCustomApiPromise();

      const minAmount = await getMinAmount(
        this.networkId,
        this.backgroundApi,
        undefined,
        customRpcClient,
      );
      const balance = !params.nativeAmountInfo?.maxSendAmount
        ? await this._getBalance(encodedTx.address)
        : new BigNumber(0);
      const tokenAmount = new BigNumber(args.value);
      const gasLimit = new BigNumber(feeInfo?.gas?.gasLimit ?? '0');
      const gasPrice = new BigNumber(feeInfo?.gas?.gasPrice ?? '0');
      const fee = gasLimit
        .times(gasPrice)
        .plus(new BigNumber(feeInfo?.common.baseFee ?? '0'))
        .shiftedBy(feeInfo?.common.feeDecimals ?? 0);
      const leftAmount = balance.minus(tokenAmount).minus(fee);

      if (leftAmount.lt(minAmount) && leftAmount.gt(0)) {
        const network = await this.getNetwork();
        throw new BalanceLowerMinimum({
          info: {
            amount: minAmount.shiftedBy(-network.decimals).toFixed(),
            symbol: network.symbol,
          },
        });
      }
    }

    return true;
  }

  // Custom RPC Client
  getRpcClient = async (
    url: string,
  ): Promise<ProviderInterface | undefined> => {
    if (url.startsWith('http')) {
      return new HttpProvider(url);
    } else if (!isEmpty(url)) {
      return new WsProvider(url);
    }
    return undefined;
  };

  private _getCustomApiPromise = memoizee(
    async (url: string): Promise<ApiPromise> => {
      return ApiPromise.create({
        provider: await this.getRpcClient(url),
        initWasm: false,
      });
    },
    {
      promise: true,
      maxAge: timerUtils.getTimeDurationMs({ seconds: 10 }),
      normalizer: ([url]) => {
        return `${this.networkId}-${url}`;
      },
    },
  );

  getCustomApiPromise = async (): Promise<ApiPromise | undefined> => {
    const rpcInfo =
      await this.backgroundApi.serviceCustomRpc.getCustomRpcForNetwork(
        this.networkId,
      );

    if (rpcInfo?.isCustomNetwork) {
      return this._getCustomApiPromise(rpcInfo?.rpc ?? '');
    }

    return undefined;
  };

  override async getCustomRpcEndpointStatus(
    params: IMeasureRpcStatusParams,
  ): Promise<IMeasureRpcStatusResult> {
    const rpcUrl = params.rpcUrl;
    if (!rpcUrl) {
      throw new OneKeyInternalError('Invalid rpc url');
    }
    try {
      const client = await this.getRpcClient(rpcUrl);
      const apiPromise = await ApiPromise.create({
        provider: client,
        initWasm: false,
      });

      const start = performance.now();
      const header = await apiPromise.rpc.chain.getHeader();
      const responseTime = Math.floor(performance.now() - start);

      await apiPromise.disconnect();

      return {
        responseTime,
        bestBlockNumber: hexToNumber(header.number.toHex()),
      };
    } catch (error) {
      console.error('getCustomRpcEndpointStatus ERROR:', error);
      throw error;
    }
  }

  override async broadcastTransactionFromCustomRpc(
    params: IBroadcastTransactionByCustomRpcParams,
  ): Promise<ISignedTxPro> {
    const { customRpcInfo, signedTx } = params;
    const rpcUrl = customRpcInfo.rpc;
    if (!rpcUrl) {
      throw new OneKeyInternalError('Invalid rpc url');
    }
    const provider = await this.getRpcClient(rpcUrl);
    const client = await ApiPromise.create({ provider, initWasm: false });
    const txHash = await client.rpc.author.submitExtrinsic(signedTx.rawTx);
    const txId = txHash.toHex();
    console.log('broadcastTransaction END:', {
      txid: txId,
      rawTx: signedTx.rawTx,
    });
    return {
      ...params.signedTx,
      txid: txId,
    };
  }

  override async fetchAccountDetailsByRpc(
    params: IFetchServerAccountDetailsParams,
  ): Promise<IFetchServerAccountDetailsResponse> {
    const apiPromise = await this.getCustomApiPromise();
    if (!apiPromise) {
      throw new OneKeyInternalError('No RPC url');
    }

    const account = await apiPromise.query.system.account(
      params.accountAddress,
    );

    const nonce = account.nonce.toNumber();
    const balance = new BigNumber(account.data.free.toString());
    const frozenBalance = new BigNumber(account.data.frozen.toString());
    const network = await this.getNetwork();
    const balanceParsed = balance.shiftedBy(-(network?.decimals ?? 0));

    return {
      data: {
        data: {
          address: params.accountAddress,
          balance: balance.toFixed(),
          balanceParsed: balanceParsed.toFixed(),
          frozenBalance: frozenBalance.toFixed(),
          nonce,
        },
      },
    };
  }

  override async fetchTokenDetailsByRpc(
    params: IFetchServerTokenDetailParams,
  ): Promise<IFetchServerTokenDetailResponse> {
    const networkInfo = await this.getNetworkInfo();
    const network = await this.getNetwork();

    const resp = await Promise.all(
      params.contractList?.map(async (contract) => {
        if (contract === networkInfo.nativeTokenAddress) {
          const accountDetails = (
            await this.fetchAccountDetailsByRpc({
              accountAddress: params.accountAddress ?? '',
              networkId: params.networkId,
              accountId: params.accountId ?? '',
            })
          ).data.data;

          if (!accountDetails.balanceParsed || !accountDetails.balance) {
            return undefined;
          }

          return {
            info: {
              decimals: network.decimals,
              name: network.shortname,
              symbol: network.symbol,
              address: networkInfo.nativeTokenAddress,
              logoURI: network.logoURI,
              isNative: true,
            },
            balance: accountDetails.balance,
            balanceParsed: accountDetails.balanceParsed,
            frozenBalance: accountDetails.frozenBalance,
            frozenBalanceParsed: accountDetails.frozenBalanceParsed,
            fiatValue: '0',
            price: 0,
          };
        }
        if (network.chainId === 'asset-hub') {
          const apiPromise = await this.getCustomApiPromise();

          const asset = await apiPromise?.query.assets.metadata(contract);

          const account = await apiPromise?.query.assets.account(
            contract,
            params.accountAddress ?? '',
          );

          // const assetInfo = await apiPromise?.query.assets.asset(contract);
          // const assetFrozen = assetInfo?.value?.minBalance;

          const accountValue = account?.value;
          if (!asset || !accountValue) {
            return undefined;
          }

          return {
            info: {
              decimals: asset.decimals.toNumber(),
              name: asset.name.toUtf8(),
              symbol: asset.symbol.toUtf8(),
              address: contract,
              logoURI: '',
              isNative: false,
            },
            balance: accountValue.balance.toString(),
            balanceParsed: new BigNumber(accountValue.balance.toString())
              .shiftedBy(-asset.decimals.toNumber())
              .toFixed(),
            fiatValue: '0',
            price: 0,
          };
        }

        return undefined;
      }) ?? [],
    );

    return {
      data: {
        data: resp.filter((item) => item !== undefined),
      },
    };
  }

  _parseAccountTokenArray(
    { networkId, accountAddress }: IFetchServerTokenListApiParams,
    accountTokenArray: IServerAccountTokenItem[],
  ): ITokenData {
    let fiatValue = BigNumber(0);
    const map: Record<string, ITokenFiat> = {};
    const data: IAccountToken[] = [];

    accountTokenArray.forEach((accountToken) => {
      if (!isNaN(Number(accountToken.fiatValue))) {
        fiatValue = fiatValue.plus(accountToken.fiatValue);
      }
      const key = `${networkId}_${accountAddress}_${
        accountToken.info?.uniqueKey ?? accountToken?.info?.address ?? ''
      }`;

      map[key] = {
        price: 0,
        price24h: 0,
        balance: accountToken.balance,
        balanceParsed: accountToken.balanceParsed,
        fiatValue: '0',
      };

      data.push({
        $key: key,
        ...omit(accountToken?.info, 'uniqueKey'),
      } as IAccountToken);
    });

    return {
      map,
      data: orderBy(
        data,
        [
          // @ts-expect-error
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          (item) => map?.[item.$key]?.order ?? 9999,
          (item) => item.isNative,
          (item) => +(map?.[item.$key]?.fiatValue ?? 0),
        ],
        ['asc', 'desc', 'desc'],
      ),
      keys: md5(
        `${networkId}__${
          isEmpty(map) ? '' : Object.keys(map).join(',')
        }__${JSON.stringify(data)}`,
      ),
      fiatValue: undefined,
    };
  }

  override async fetchTokenListByRpc(
    params: IFetchServerTokenListParams,
  ): Promise<IFetchServerTokenListResponse> {
    const provider = await this.getCustomApiPromise();
    if (!provider) {
      throw new OneKeyInternalError('No RPC url');
    }

    const networkInfo = await this.getNetworkInfo();
    const tokenDetails = await this.fetchTokenDetailsByRpc({
      accountAddress: params.requestApiParams.accountAddress ?? '',
      networkId: params.requestApiParams.networkId,
      accountId: params.accountId ?? '',
      contractList: [networkInfo.nativeTokenAddress ?? ''],
    });

    const accountTokenArray: IServerAccountTokenItem[] = [];
    accountTokenArray.push({
      info: {
        decimals: tokenDetails.data.data[0].info.decimals,
        name: tokenDetails.data.data[0].info.name,
        symbol: tokenDetails.data.data[0].info.symbol,
        address: tokenDetails.data.data[0].info.address,
        logoURI: tokenDetails.data.data[0].info.logoURI,
        isNative: true,
      },
      balance: tokenDetails.data.data[0].balance,
      balanceParsed: tokenDetails.data.data[0].balanceParsed,
      fiatValue: '0',
      price: '0',
      price24h: 0,
    });

    const chainId = await this.getNetworkChainId();
    if (chainId === 'asset-hub') {
      const assetIds: number[] = [];
      const assetMetadataEntries = await provider.query.assets.asset.entries();
      for (const [key] of assetMetadataEntries) {
        assetIds.push(key.args[0].toNumber());
      }

      const accountIdHex = u8aToHex(
        decodeAddress(params.requestApiParams.accountAddress),
      );
      const queries = assetIds.map((assetId) => [assetId, accountIdHex]);
      const balances = await provider.query.assets.account.multi(queries);

      const existsBalances: {
        assetId: string;
        balance: string;
        isFrozen: boolean;
        isSufficient: boolean;
      }[] = [];
      balances.forEach((balanceOption, index) => {
        if (balanceOption.isSome) {
          const balanceInfo = balanceOption.unwrap();

          if (!balanceInfo.balance.isZero()) {
            existsBalances.push({
              assetId: assetIds[index].toString(),
              balance: balanceInfo.balance.toString(),
              isFrozen: balanceInfo.status.isFrozen,
              isSufficient: balanceInfo.reason.isSufficient,
            });
          }
        }
      });

      for (const item of existsBalances) {
        const assetId = item.assetId;
        const balance = item.balance;

        const assetMetadata = await provider.query.assets.metadata(assetId);

        const balanceParsed = new BigNumber(balance)
          .shiftedBy(-assetMetadata.decimals.toNumber())
          .toFixed()
          .toString();

        accountTokenArray.push({
          info: {
            decimals: assetMetadata.decimals.toNumber(),
            name: assetMetadata.name.toUtf8(),
            symbol: assetMetadata.symbol.toUtf8(),
            address: assetId.toString(),
            isNative: false,
          },
          balance,
          balanceParsed,
          fiatValue: '0',
          price: '0',
          price24h: 0,
        });
      }
    }

    const hiddenTokenSet = new Set(params.requestApiParams.hiddenTokens ?? []);
    const sortedAccountTokenArray = orderBy(
      accountTokenArray,
      [(item) => item.info?.isNative, (item) => +(item.fiatValue ?? 0)],
      ['desc', 'desc'],
    ).filter((n) => !hiddenTokenSet.has(n.info?.address ?? ''));

    const smallTokenArray: IServerAccountTokenItem[] = [];
    const riskTokenArray: IServerAccountTokenItem[] = [];

    const tokens = this._parseAccountTokenArray(
      params.requestApiParams,
      sortedAccountTokenArray,
    );
    const riskTokens = this._parseAccountTokenArray(
      params.requestApiParams,
      riskTokenArray,
    );
    const smallBalanceTokens = this._parseAccountTokenArray(
      params.requestApiParams,
      smallTokenArray,
    );

    return {
      data: {
        data: {
          tokens,
          riskTokens,
          smallBalanceTokens,
        },
      },
    };
  }

  override async estimateFeeByRpc(
    params: IEstimateGasParams,
  ): Promise<IServerEstimateFeeResponse> {
    const apiPromise = await this.getCustomApiPromise();
    if (!apiPromise) {
      throw new OneKeyInternalError('No RPC url');
    }

    if (!params.encodedTx) {
      throw new OneKeyInternalError('No encodedTx');
    }

    const nativeToken = await this.getNetwork();
    const feeDecimals = nativeToken.decimals;
    const feeSymbol = nativeToken.symbol;
    let gasLimit = '0';

    // @ts-expect-error
    const signedTxU8a = Buffer.from(params.encodedTx, 'base64');
    try {
      const queryInfo = await apiPromise.call.transactionPaymentApi.queryInfo(
        signedTxU8a,
        signedTxU8a.byteLength,
      );
      const queryInfoJson = queryInfo.toJSON() as { partialFee: number };
      const weight = queryInfoJson.partialFee.toString();
      gasLimit = new BigNumber(weight).toFixed(0).toString();
    } catch (err) {
      const queryInfo =
        await apiPromise.call.transactionPaymentCallApi.queryCallFeeDetails(
          signedTxU8a,
          signedTxU8a.byteLength,
        );
      const queryInfoJson = queryInfo.toJSON() as {
        inclusionFee: {
          baseFee: number;
          lenFee: number;
        };
      };
      gasLimit = new BigNumber(queryInfoJson.inclusionFee.baseFee.toString())
        .plus(queryInfoJson.inclusionFee.lenFee.toString())
        .toFixed(0)
        .toString();
    }
    const gasPrice = new BigNumber('1')
      .shiftedBy(-feeDecimals)
      .toFixed()
      .toString();
    return {
      data: {
        data: {
          isEIP1559: false,
          feeDecimals,
          feeSymbol,
          nativeDecimals: nativeToken.decimals,
          nativeSymbol: nativeToken.symbol,
          baseFee: '0',
          nativeTokenPrice: {
            price: 0,
            price24h: 0,
          },
          gas: [
            {
              gasPrice,
              gasLimitForDisplay: gasLimit,
              gasLimit,
            },
          ],
          feeData: [{ extraTip: '0' }],
        },
      },
    };
  }
}
