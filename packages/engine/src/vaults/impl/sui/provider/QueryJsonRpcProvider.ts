/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
import {
  Coin,
  GetObjectDataResponse,
  JsonRpcProvider,
  SuiMoveObject,
  SuiObject,
  getMoveObject,
  getObjectExistsResponse,
  isGetObjectDataResponse,
  isSuiMoveTypeParameterIndex,
  isTransactionDigest,
} from '@mysten/sui.js';
import { get } from 'lodash';

import { Nft } from './NFT';

import type { CoinMetadata, CoinObject, NftObject } from '../types';

function getCoinObject(obj: SuiMoveObject): CoinObject {
  const arg = Coin.getCoinTypeArg(obj);
  return {
    objectId: get(obj, 'fields.id.id', ''),
    symbol: arg ? Coin.getCoinSymbol(arg) : '',
    balance: BigInt(obj.fields.balance),
    object: obj,
  };
}

export class QueryJsonRpcProvider extends JsonRpcProvider {
  async tryGetPastObject(
    objectId: string,
    version: number,
  ): Promise<GetObjectDataResponse | undefined> {
    try {
      return await this.client.requestWithType(
        'sui_tryGetPastObject',
        [objectId, version],
        isGetObjectDataResponse,
        this.options.skipDataValidation,
      );
    } catch (err) {
      throw new Error(`Error fetching object info: ${err} for id ${objectId}`);
    }
  }

  async tryGetPastObjectBatch(
    objects: {
      objectId: string;
      version: number;
    }[],
  ): Promise<GetObjectDataResponse[]> {
    const requests = objects.map((object) => ({
      method: 'sui_tryGetPastObject',
      args: [object.objectId, object.version],
    }));
    try {
      return await this.client.batchRequestWithType(
        requests,
        isGetObjectDataResponse,
        true,
      );
    } catch (err) {
      throw new Error(`Error fetching object info: ${err} for id ${objects}`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isCoinMetadata(obj: any, _argumentName?: string): obj is CoinMetadata {
    return (
      ((obj !== null && typeof obj === 'object') ||
        typeof obj === 'function') &&
      isSuiMoveTypeParameterIndex(obj.decimals) &&
      isTransactionDigest(obj.name) &&
      isTransactionDigest(obj.symbol) &&
      isTransactionDigest(obj.description) &&
      (obj.iconUrl === null || isTransactionDigest(obj.iconUrl)) &&
      (obj.id === null || isTransactionDigest(obj.id))
    );
  }

  async getCoinMetadata(coinType: string) {
    try {
      return await this.client.requestWithType(
        'sui_getCoinMetadata',
        [coinType],
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.isCoinMetadata,
        this.options.skipDataValidation,
      );
    } catch (err) {
      throw new Error(
        `Error fetching coin Metadata: ${err} for id ${coinType}`,
      );
    }
  }

  public async getOwnedObjects(address: string): Promise<SuiObject[]> {
    const objectInfos = await this.getObjectsOwnedByAddress(address);
    const objectIds = objectInfos.map((obj) => obj.objectId);
    const resps = await this.getObjectBatch(objectIds);
    return resps
      .filter((resp) => resp.status === 'Exists')
      .map((resp) => getObjectExistsResponse(resp) as SuiObject);
  }

  public async getOwnedCoins(address: string): Promise<CoinObject[]> {
    const objects = await this.getOwnedObjects(address);
    const res = objects
      .map((item) => ({
        id: item.reference.objectId,
        object: getMoveObject(item),
      }))
      .filter((item) => item.object && Coin.isCoin(item.object))
      .map((item) => getCoinObject(item.object as SuiMoveObject));
    return res;
  }

  public async getGasObject(
    address: string,
    gasBudget: number,
  ): Promise<CoinObject | undefined> {
    // TODO: Try to merge coins in this case if gas object is undefined.
    const coins = await this.getOwnedCoins(address);
    return coins
      .filter((coin) => coin.symbol === 'SUI')
      .find((coin) => coin.balance >= gasBudget);
  }

  public async getOwnedNfts(address: string): Promise<NftObject[]> {
    const objects = await this.getOwnedObjects(address);
    const res = objects
      .map((item) => ({
        id: item.reference.objectId,
        object: getMoveObject(item),
        previousTransaction: item.previousTransaction,
      }))
      .filter((item) => item.object && Nft.isNft(item.object))
      .map((item) => {
        const obj = item.object as SuiMoveObject;
        return Nft.getNftObject(obj, item.previousTransaction);
      });
    return res;
  }
}
