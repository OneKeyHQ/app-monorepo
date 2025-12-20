import { u8aToHex } from '@polkadot/util';
import { decodeAddress } from '@polkadot/util-crypto';
import { methods } from '@substrate/txwrapper-polkadot';
import BigNumber from 'bignumber.js';

import type { IEncodedTxDot } from '@onekeyhq/core/src/chains/dot/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IServerAccountTokenItem } from '@onekeyhq/shared/types/serverToken';
import type { IFetchTokenDetailItem } from '@onekeyhq/shared/types/token';
import { EDecodedTxActionType } from '@onekeyhq/shared/types/tx';

import { getMinAmount, getTransactionTypeFromTxInfo } from '../utils';

import VaultDotSubCommon from './VaultDotSubCommon';

import type {
  IDecodedAssetIdContext,
  IFetchTokenDetailContext,
  IFetchTokenListContext,
  ITokenTransferBuildContext,
  IUpdateUnsignedTxContext,
} from './VaultDotSubBase';
import type { Args } from '@substrate/txwrapper-polkadot';

class VaultDotSubAssetHubKusama extends VaultDotSubCommon {
  private createAssetStructure(assetId: string) {
    return {
      parents: 0,
      interior: {
        X2: [
          {
            // 50 is the pallet index for Assets pallet on Polkadot Asset Hub
            // This is used for XCM location structure
            palletInstance: 50,
          },
          {
            generalIndex: parseInt(assetId, 10),
          },
        ],
      },
    };
  }

  private async fetchAccountTokenInfo(assetId: string, accountAddress: string) {
    const tokenList = await this.vault.fetchTokenList({
      accountId: this.vault.accountId,
      requestApiParams: {
        accountAddress,
        networkId: this.vault.networkId,
        contractList: [assetId],
        hiddenTokens: [],
      },
      flag: 'dot--asset-hub-ksm--account-token-info',
    });

    const tokenInfo = tokenList.data.data.tokens.data.find(
      (token) => token.address === assetId,
    );

    const balanceEntry = tokenInfo
      ? tokenList.data.data.tokens.map[tokenInfo.$key]
      : undefined;

    return { tokenInfo, balanceEntry } as const;
  }

  override supportsNetwork(networkId: string, chainId: string): boolean {
    return (
      networkId === 'dot--kusama-assethub' || chainId === 'kusama-assethub'
    );
  }

  override async buildTokenTransfer(
    context: ITokenTransferBuildContext,
  ): Promise<IEncodedTxDot> {
    // Use tokens as transaction fees
    // const tokenAssetId = context.tokenInfo.address;
    // const asset = this.createAssetStructure(tokenAssetId);

    return super.buildTokenTransfer({
      ...context,
      info: {
        ...context.info,
        // assetId: asset,
      },
    });
  }

  override async getAddressByTxArgs(args: Args): Promise<string | undefined> {
    const arg = args as unknown as {
      target?: { id?: string };
      dest?: { id?: string };
    };
    const targetOrDest = arg?.target?.id ?? arg?.dest?.id;
    if (targetOrDest) {
      return targetOrDest;
    }
    return super.getAddressByTxArgs(args);
  }

  override async extractAssetId(
    context: IDecodedAssetIdContext,
  ): Promise<string | undefined> {
    if (context.chainId !== 'kusama-assethub') {
      return super.extractAssetId(context);
    }
    if (context.pallet !== 'assets') {
      return super.extractAssetId(context);
    }
    const assetId = (context.args as { id?: { toString(): string } })?.id;
    return assetId?.toString() ?? '';
  }

  override async fetchTokenDetailByRpc(
    context: IFetchTokenDetailContext,
  ): Promise<IFetchTokenDetailItem | undefined> {
    const apiPromise = context.apiPromise;
    if (!apiPromise) {
      return super.fetchTokenDetailByRpc(context);
    }
    const accountAddress = context.params.accountAddress ?? '';
    if (!accountAddress) {
      return super.fetchTokenDetailByRpc(context);
    }

    const assetMetadata = await apiPromise.query.assets.metadata(
      context.contract,
    );
    const account = await apiPromise.query.assets.account(
      context.contract,
      accountAddress,
    );

    const accountValue = account?.value;
    if (!assetMetadata || !accountValue) {
      return undefined;
    }

    const decimals = assetMetadata.decimals.toNumber();
    const balance = accountValue.balance.toString();

    const info = {
      decimals,
      name: assetMetadata.name.toUtf8(),
      symbol: assetMetadata.symbol.toUtf8(),
      address: context.contract,
      logoURI: '',
      isNative: false,
    };

    return {
      info,
      balance,
      balanceParsed: new BigNumber(balance).shiftedBy(-decimals).toFixed(),
      fiatValue: '0',
      price: 0,
      price24h: 0,
    };
  }

  override async fetchAdditionalAccountTokens(
    context: IFetchTokenListContext,
  ): Promise<IServerAccountTokenItem[]> {
    if (!context.accountAddress) {
      return super.fetchAdditionalAccountTokens(context);
    }

    const assetIds: number[] = [];
    const assetMetadataEntries =
      await context.apiPromise.query.assets.asset.entries();
    for (const [key] of assetMetadataEntries) {
      assetIds.push(key.args[0].toNumber());
    }

    const accountHex = u8aToHex(decodeAddress(context.accountAddress));
    const queries = assetIds.map((assetId) => [assetId, accountHex] as const);
    const balances = await context.apiPromise.query.assets.account.multi(
      queries,
    );

    const tokens: IServerAccountTokenItem[] = [];
    balances.forEach((balanceOption, index) => {
      if (!balanceOption.isSome) {
        return;
      }
      const balanceInfo = balanceOption.unwrap();
      if (balanceInfo.balance.isZero()) {
        return;
      }
      tokens.push({
        info: {
          decimals: 0,
          name: '',
          symbol: '',
          address: assetIds[index].toString(),
          isNative: false,
        },
        balance: balanceInfo.balance.toString(),
        balanceParsed: '0',
        fiatValue: '0',
        price: '0',
        price24h: 0,
      });
    });

    for (const token of tokens) {
      const metadata = await context.apiPromise.query.assets.metadata(
        token.info?.address ?? '',
      );
      const decimals = metadata.decimals.toNumber();
      token.info = {
        address: token.info?.address ?? '',
        decimals,
        name: metadata.name.toUtf8(),
        symbol: metadata.symbol.toUtf8(),
        isNative: false,
      };
      token.balanceParsed = new BigNumber(token.balance)
        .shiftedBy(-decimals)
        .toFixed();
    }

    const baseTokens = await super.fetchAdditionalAccountTokens(context);
    return [...baseTokens, ...tokens];
  }

  override async updateUnsignedTx(
    context: IUpdateUnsignedTxContext,
  ): Promise<IEncodedTxDot | undefined> {
    const { decodedUnsignedTx } = context;
    const type = getTransactionTypeFromTxInfo(decodedUnsignedTx);
    if (type !== EDecodedTxActionType.ASSET_TRANSFER) {
      return super.updateUnsignedTx(context);
    }

    const assetId =
      (
        decodedUnsignedTx.method.args?.id as { toString(): string } | undefined
      )?.toString() ?? '';
    const amount = decodedUnsignedTx.method.args?.amount as string;
    if (!assetId) {
      return super.updateUnsignedTx(context);
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

    const to = await this.getAddressByTxArgs(decodedUnsignedTx.method.args);

    if (!to) {
      return super.updateUnsignedTx(context);
    }

    const { tokenInfo, balanceEntry } = await this.fetchAccountTokenInfo(
      assetId,
      from,
    );

    if (!tokenInfo || !balanceEntry) {
      throw new OneKeyInternalError({
        message: 'updateUnsignedTx not found tokenInfo',
        key: ETranslations.send_engine_incorrect_token_address,
      });
    }

    if (new BigNumber(amount).gte(new BigNumber(balanceEntry.balance ?? '0'))) {
      const amountValue = new BigNumber(amount ?? '0').toFixed(0);

      const keepAlive =
        decodedUnsignedTx.method?.name?.indexOf('KeepAlive') !== -1;

      const tx = keepAlive
        ? methods.assets.transferKeepAlive(
            {
              id: parseInt(tokenInfo.address, 10),
              target: to,
              amount: amountValue,
            },
            {
              ...info,
              // assetId: asset,
            },
            option,
          )
        : methods.assets.transfer(
            {
              id: parseInt(tokenInfo.address, 10),
              target: to,
              amount: amountValue,
            },
            {
              ...info,
              // assetId: asset,
            },
            option,
          );

      const network = await this.vault.getNetwork();
      return {
        ...tx,
        specName: txBaseInfo.specName,
        chainName: network.name,
        metadataRpc: '' as `0x${string}`,
      };
    }

    return undefined;
  }
}

export default VaultDotSubAssetHubKusama;
