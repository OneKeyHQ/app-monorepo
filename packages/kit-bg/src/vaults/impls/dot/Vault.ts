/* eslint-disable @typescript-eslint/no-unused-vars */
import { decodeAddress, encodeAddress } from '@polkadot/util-crypto';
import { decode, getRegistry, methods } from '@substrate/txwrapper-polkadot';
import BigNumber from 'bignumber.js';
import { isEmpty, isNil } from 'lodash';

import { serializeUnsignedTransaction } from '@onekeyhq/core/src/chains/dot/sdkDot';
import type { IEncodedTxDot } from '@onekeyhq/core/src/chains/dot/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  IEncodedTx,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import numberUtils from '@onekeyhq/shared/src/utils/numberUtils';
import type {
  IAddressValidation,
  IGeneralInputValidation,
  INetworkAccountAddressDetail,
  IPrivateKeyValidation,
  IXprvtValidation,
  IXpubValidation,
} from '@onekeyhq/shared/types/address';
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
import { getTransactionTypeFromTxInfo } from './utils';

import type { IDBWalletType } from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';
import type {
  IBuildAccountAddressDetailParams,
  IBuildDecodedTxParams,
  IBuildEncodedTxParams,
  IBuildUnsignedTxParams,
  IGetPrivateKeyFromImportedParams,
  IGetPrivateKeyFromImportedResult,
  IUpdateUnsignedTxParams,
  IValidateGeneralInputParams,
} from '../../types';
import type {
  Args,
  BaseTxInfo,
  TypeRegistry,
} from '@substrate/txwrapper-polkadot';

export default class VaultDot extends VaultBase {
  override coreApi = coreChainApi.dot.hd;

  override keyringMap: Record<IDBWalletType, typeof KeyringBase> = {
    hd: KeyringHd,
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
    blockHash: string;
    blockNumber: number;
    genesisHash: string;
    metadataRpc: `0x${string}`;
    specName: string;
    specVersion: number;
    transactionVersion: number;
    registry: TypeRegistry;
  }> {
    const [
      { specName, specVersion, transactionVersion },
      blockHash,
      genesisHash,
      { block },
      metadataRpc,
    ] = (await this.backgroundApi.serviceAccountProfile.sendProxyRequest({
      networkId: this.networkId,
      body: [
        {
          route: 'rpc',
          params: {
            method: 'state_getRuntimeVersion',
            params: [],
          },
        },
        {
          route: 'rpc',
          params: {
            method: 'chain_getBlockHash',
            params: [],
          },
        },
        {
          route: 'rpc',
          params: {
            method: 'chain_getBlockHash',
            params: [0],
          },
        },
        {
          route: 'rpc',
          params: {
            method: 'chain_getBlock',
            params: [],
          },
        },
        {
          route: 'rpc',
          params: {
            method: 'state_getMetadata',
            params: [],
          },
        },
      ],
    })) as [
      { specName: string; specVersion: number; transactionVersion: number },
      string,
      string,
      { block: { header: { number: number } } },
      `0x${string}`,
    ];
    const info = {
      metadataRpc,
      specName: specName as 'polkadot',
      specVersion,
      chainName: await this.getNetworkChainId(),
    };
    const registry = getRegistry(info);
    return {
      ...info,
      blockNumber: block.header.number,
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
      throw new Error('Invalid transferInfo.to params');
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
    if (chainId === 'joystream') {
      toAccount = hexUtils.addHexPrefix(
        bufferUtils.bytesToHex(toAccountId),
      ) as unknown as { id: string };
    }

    let amountValue;

    const network = await this.getNetwork();
    const txBaseInfo = await this._getTxBaseInfo();

    const account =
      await this.backgroundApi.serviceAccountProfile.fetchAccountDetails({
        networkId: this.networkId,
        accountAddress: from,
      });

    const info = {
      ...txBaseInfo,
      address: from,
      eraPeriod: 64,
      nonce: account.nonce ?? 0,
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
        .toFixed();
      if (keepAlive) {
        unsigned = methods.assets.transferKeepAlive(
          {
            id: parseInt(tokenInfo.address),
            target: to,
            amount: amountValue,
          },
          info,
          option,
        );
      } else {
        unsigned = methods.assets.transfer(
          {
            id: parseInt(tokenInfo.address),
            target: to,
            amount: amountValue,
          },
          info,
          option,
        );
      }
    } else {
      amountValue = new BigNumber(amount).shiftedBy(network.decimals).toFixed();
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
    };
  }

  private async _getRegistry(params: {
    metadataRpc?: `0x${string}`;
    specVersion?: string;
    specName?: string;
  }): Promise<TypeRegistry> {
    const network = await this.getNetwork();

    let metadataRpcHex: `0x${string}`;
    if (isNil(params.metadataRpc) || isEmpty(params.metadataRpc)) {
      const [res] =
        await this.backgroundApi.serviceAccountProfile.sendProxyRequest<`0x${string}`>(
          {
            networkId: this.networkId,
            body: [
              {
                route: 'rpc',
                params: {
                  method: 'state_getMetadata',
                  params: [],
                },
              },
            ],
          },
        );
      metadataRpcHex = res;
    } else {
      metadataRpcHex = params.metadataRpc;
    }

    let specVersion: number;
    let specName: string;
    if (
      !params.specVersion ||
      isEmpty(params.specVersion) ||
      !params.specName ||
      isEmpty(params.specName)
    ) {
      const [res] =
        await this.backgroundApi.serviceAccountProfile.sendProxyRequest<{
          specName: string;
          specVersion: number;
        }>({
          networkId: this.networkId,
          body: [
            {
              route: 'rpc',
              params: {
                method: 'state_getRuntimeVersion',
                params: [],
              },
            },
          ],
        });
      specVersion = res.specVersion;
      specName = res.specName;
    } else {
      specVersion = +numberUtils.hexToDecimal(
        hexUtils.addHexPrefix(params.specVersion),
      );
      specName = params.specName;
    }

    return getRegistry({
      chainName: network.name,
      specName: specName as 'polkadot',
      specVersion,
      metadataRpc: metadataRpcHex,
    });
  }

  private async _decodeUnsignedTx(unsigned: IEncodedTxDot) {
    const registry = await this._getRegistry(unsigned);

    const { metadataRpc } = unsigned;
    const decodedUnsigned = decode(unsigned, {
      metadataRpc,
      registry,
    });

    return decodedUnsigned;
  }

  private async _getAddressByTxArgs(args: Args): Promise<string> {
    const chainId = await this.getNetworkChainId();
    if (chainId === 'joystream') {
      return args.dest as string;
    }
    return (args.dest as { id: string }).id;
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const { unsignedTx } = params;

    const encodedTx = unsignedTx.encodedTx as IEncodedTxDot;

    const account = await this.getAccount();

    const decodeUnsignedTx = await this._decodeUnsignedTx(encodedTx);

    let action: IDecodedTxAction | null = null;
    const actionType = getTransactionTypeFromTxInfo(decodeUnsignedTx);

    if (actionType === EDecodedTxActionType.ASSET_TRANSFER) {
      const from = account.address;
      let to = '';
      let amount = '';

      const tokenInfo = await this.backgroundApi.serviceToken.getToken({
        networkId: this.networkId,
        tokenIdOnNetwork: decodeUnsignedTx.assetId
          ? decodeUnsignedTx.assetId.toString()
          : '',
        accountAddress: account.address,
      });

      const { amount: tokenAmount } = decodeUnsignedTx.method.args;
      to = await this._getAddressByTxArgs(decodeUnsignedTx.method.args);

      amount = tokenAmount?.toString() ?? '0';

      const transferAction: IDecodedTxTransferInfo = {
        from,
        to,
        amount: new BigNumber(amount).shiftedBy(-tokenInfo.decimals).toFixed(),
        icon: tokenInfo.logoURI ?? '',
        name: tokenInfo.symbol,
        symbol: tokenInfo.symbol,
        tokenIdOnNetwork: tokenInfo.address,
        isNFT: false,
      };

      action = {
        type: actionType,
        assetTransfer: {
          from,
          to,
          sends: [transferAction],
          receives: [],
        },
      };
    } else {
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
    const encodedTx = params.encodedTx ?? (await this.buildEncodedTx(params));
    if (encodedTx) {
      return {
        encodedTx,
      }
    }
    throw new OneKeyInternalError();
  }

  override async updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const { unsignedTx } = params;
    let encodedTx = unsignedTx.encodedTx as IEncodedTxDot;
    if (params.nonceInfo) {
      encodedTx.nonce = numberUtils.numberToHex(params.nonceInfo.nonce, {
        prefix0x: true,
      }) as `0x${string}`;
    }
    return {
      encodedTx,
      feeInfo: params.feeInfo,
    };
  }

  override async validateAddress(address: string): Promise<IAddressValidation> {
    const networkInfo = await this.backgroundApi.serviceNetwork.getNetwork({
      networkId: this.networkId,
    });
    const options = networkInfo.extensions?.providerOptions as {
      addressRegex: string;
    };
    return {
      isValid: new RegExp(options.addressRegex).test(address),
      normalizedAddress: address,
      displayAddress: address,
    };
  }

  override validateXpub(xpub: string): Promise<IXpubValidation> {
    throw new Error('Method not implemented.');
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
    encodedTx: IEncodedTx | undefined;
  }): Promise<IEncodedTx | undefined> {
    const tx = await serializeUnsignedTransaction(encodedTx as IEncodedTxDot);
    return bufferUtils
      .toBuffer(tx.rawTx)
      .toString('base64') as unknown as IEncodedTx;
  }
}
