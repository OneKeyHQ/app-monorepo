import qs from 'querystring';

import { isArray, isNil, isObject, omitBy } from 'lodash';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import {
  ETraitsDisplayType,
  type IFetchAccountNFTsParams,
  type IFetchAccountNFTsResp,
  type IFetchNFTDetailsParams,
  type IFetchNFTDetailsResp,
} from '@onekeyhq/shared/types/nft';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceNFT extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  _fetchAccountNFTsControllers: AbortController[] = [];

  @backgroundMethod()
  public async abortFetchAccountNFTs() {
    this._fetchAccountNFTsControllers.forEach((controller) => {
      controller.abort();
    });
    this._fetchAccountNFTsControllers = [];
  }

  @backgroundMethod()
  public async fetchAccountNFTs(params: IFetchAccountNFTsParams) {
    const { accountId, networkId, ...rest } = params;
    const client = await this.getClient(EServiceEndpointEnum.Wallet);

    const [xpub, accountAddress] = await Promise.all([
      this.backgroundApi.serviceAccount.getAccountXpub({
        accountId,
        networkId,
      }),
      this.backgroundApi.serviceAccount.getAccountAddressForApi({
        accountId,
        networkId,
      }),
    ]);

    const controller = new AbortController();
    this._fetchAccountNFTsControllers.push(controller);

    const resp = await client.get<{
      data: IFetchAccountNFTsResp;
    }>(
      `/wallet/v1/account/nft/list?${qs.stringify(
        omitBy({ networkId, accountAddress, xpub, ...rest }, isNil),
      )}`,
      {
        signal: controller.signal,
        headers:
          await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader({
            accountId: params.accountId,
          }),
      },
    );

    resp.data.data.data = resp.data.data.data.map((nft) => ({
      ...nft,
      accountId,
      networkId,
    }));

    return resp.data.data;
  }

  @backgroundMethod()
  public async fetchNFTDetails(params: IFetchNFTDetailsParams) {
    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const { nfts, accountId, networkId } = params;

    const [xpub, accountAddress] = await Promise.all([
      this.backgroundApi.serviceAccount.getAccountXpub({
        accountId,
        networkId,
      }),
      this.backgroundApi.serviceAccount.getAccountAddressForApi({
        accountId,
        networkId,
      }),
    ]);

    const resp = await client.post<IFetchNFTDetailsResp>(
      '/wallet/v1/account/nft/detail',
      {
        accountAddress,
        xpub,
        networkId,
        nftIds: nfts.map((nft) =>
          isNil(nft.itemId)
            ? nft.collectionAddress
            : `${nft.collectionAddress}:${nft.itemId}`,
        ),
      },
      {
        headers:
          await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader({
            accountId,
          }),
      },
    );
    const result = resp.data.data;

    return result.map((nft) => {
      if (nft.metadata?.attributes) {
        if (isArray(nft.metadata?.attributes)) {
          nft.metadata.attributes = nft.metadata.attributes
            .filter((attr) => !!attr)
            .map((attr) => ({
              ...attr,
              traitType: attr.trait_type,
              displayType: attr.display_type,
            }));
        } else if (isObject(nft.metadata?.attributes)) {
          nft.metadata.attributes = Object.keys(nft.metadata.attributes).map(
            (key) => ({
              traitType: key,
              trait_type: key,
              value:
                (nft.metadata?.attributes?.[
                  key as unknown as number
                ] as unknown as string) || '',
              displayType: ETraitsDisplayType.String,
              display_type: ETraitsDisplayType.String,
            }),
          );
        }
      }
      return nft;
    });
  }

  @backgroundMethod()
  public async getNFT(params: {
    accountId: string;
    networkId: string;
    nftId: string;
    collectionAddress: string;
  }) {
    try {
      return {
        ...(await this._getNFTMemo(params)),
      };
    } catch (error) {
      return Promise.resolve(undefined);
    }
  }

  _getNFTMemo = memoizee(
    async ({
      accountId,
      networkId,
      nftId,
      collectionAddress,
    }: {
      accountId: string;
      networkId: string;
      nftId: string;
      collectionAddress: string;
    }) => {
      const nftDetails = await this.fetchNFTDetails({
        accountId,
        networkId,
        nfts: [{ collectionAddress, itemId: nftId }],
      });
      return nftDetails[0];
    },
    {
      promise: true,
      primitive: true,
      max: 10,
      maxAge: timerUtils.getTimeDurationMs({ minute: 5 }),
    },
  );
}

export default ServiceNFT;
