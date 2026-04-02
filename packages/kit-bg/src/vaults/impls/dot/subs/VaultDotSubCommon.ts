import { methods } from '@substrate/txwrapper-polkadot';
import BigNumber from 'bignumber.js';

import type { IEncodedTxDot } from '@onekeyhq/core/src/chains/dot/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import type { IServerAccountTokenItem } from '@onekeyhq/shared/types/serverToken';
import type { IFetchTokenDetailItem } from '@onekeyhq/shared/types/token';
import { EDecodedTxActionType } from '@onekeyhq/shared/types/tx';

import { getTransactionTypeFromTxInfo } from '../utils';

import VaultDotSubBase from './VaultDotSubBase';

import type {
  IDecodedAssetIdContext,
  IFetchTokenDetailContext,
  IFetchTokenListContext,
  INativeTransferBuildContext,
  ITokenTransferBuildContext,
  IUpdateUnsignedTxContext,
} from './VaultDotSubBase';
import type { Args } from '@substrate/txwrapper-polkadot';

export default class VaultDotSubCommon extends VaultDotSubBase {
  override supportsNetwork(_networkId: string, _chainId: string): boolean {
    // Common implementation acts as fallback; precise networks override this.
    return true;
  }

  override async buildTokenTransfer(
    context: ITokenTransferBuildContext,
  ): Promise<IEncodedTxDot> {
    const { tokenInfo, to, amountValue, keepAlive, info, option } = context;
    const id = parseInt(tokenInfo.address, 10);
    if (Number.isNaN(id)) {
      throw new OneKeyInternalError(
        'Invalid token address for DOT asset transfer',
      );
    }
    const args = {
      id,
      target: to,
      amount: amountValue,
    };

    return keepAlive
      ? methods.assets.transferKeepAlive(args, info, option)
      : methods.assets.transfer(args, info, option);
  }

  override async getAddressByTxArgs(args: Args): Promise<string | undefined> {
    const dest = (args as { dest?: { id?: string } }).dest;
    return dest?.id;
  }

  override async extractAssetId(
    context: IDecodedAssetIdContext,
  ): Promise<string | undefined> {
    if (context.pallet !== 'assets') {
      return undefined;
    }
    const assetId = (context.args as { id?: { toString(): string } })?.id;
    return assetId?.toString();
  }

  override async fetchTokenDetailByRpc(
    _context: IFetchTokenDetailContext,
  ): Promise<IFetchTokenDetailItem | undefined> {
    return undefined;
  }

  override async fetchAdditionalAccountTokens(
    _context: IFetchTokenListContext,
  ): Promise<IServerAccountTokenItem[]> {
    return [];
  }

  override async buildNativeTransfer(
    context: INativeTransferBuildContext,
  ): Promise<IEncodedTxDot> {
    const dest = { id: context.to };
    return context.keepAlive
      ? methods.balances.transferKeepAlive(
          {
            value: context.amountValue,
            dest,
          },
          context.info,
          context.option,
        )
      : methods.balances.transferAllowDeath(
          {
            value: context.amountValue,
            dest,
          },
          context.info,
          context.option,
        );
  }

  override async updateUnsignedTx(
    context: IUpdateUnsignedTxContext,
  ): Promise<IEncodedTxDot | undefined> {
    const { decodedUnsignedTx, params } = context;
    const type = getTransactionTypeFromTxInfo(decodedUnsignedTx);
    if (type !== EDecodedTxActionType.ASSET_TRANSFER) {
      return undefined;
    }
    if (!params.nativeAmountInfo) {
      return undefined;
    }

    const txBaseInfo = await this.vault.getTxBaseInfoForSub();
    const from = await this.vault.getAccountAddress();
    const info = {
      ...txBaseInfo,
      address: from,
      eraPeriod: 64,
      nonce: decodedUnsignedTx.nonce ?? 0,
      tip: 0,
    };
    const option = {
      metadataRpc: txBaseInfo.metadataRpc,
      registry: txBaseInfo.registry,
    };

    const network = await this.vault.getNetwork();
    const amountValue = new BigNumber(
      params.nativeAmountInfo.maxSendAmount ?? '0',
    )
      .shiftedBy(network.decimals)
      .minus(
        new BigNumber(params.feeInfo?.feeDot?.extraTipInDot ?? '0').shiftedBy(
          params.feeInfo?.common.feeDecimals ?? 0,
        ),
      )
      .toFixed(0);
    const dest = decodedUnsignedTx.method.args.dest as { id: string };

    const keepAlive =
      decodedUnsignedTx.method?.name?.indexOf('KeepAlive') !== -1;
    const tx = keepAlive
      ? methods.balances.transferKeepAlive(
          {
            value: amountValue,
            dest,
          },
          info,
          option,
        )
      : methods.balances.transferAll(
          {
            dest,
            keepAlive: false,
          },
          info,
          option,
        );

    return {
      ...tx,
      specName: txBaseInfo.specName,
      chainName: network.name,
      metadataRpc: '' as `0x${string}`,
    };
  }
}
