import qs from 'querystring';

import { isArray, isNil, isObject, omitBy } from 'lodash';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import { ETraitsDisplayType } from '@onekeyhq/shared/types/nft';
import type {
  IAccountNFT,
  IFetchAccountNFTsParams,
  IFetchAccountNFTsResp,
  IFetchNFTDetailsParams,
  IFetchNFTDetailsResp,
} from '@onekeyhq/shared/types/nft';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import ServiceBase from './ServiceBase';

import type { DeviceUploadResourceParams } from '@onekeyfe/hd-core';

@backgroundClass()
class ServiceNFT extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  _fetchAccountNFTsControllers: AbortController[] = [];

  @backgroundMethod()
  public async uploadNFTImageToDevice(params: {
    accountId: string;
    uploadResParams: DeviceUploadResourceParams;
  }) {
    const { accountId, uploadResParams } = params;
    const { deviceParams } =
      await this.backgroundApi.servicePassword.promptPasswordVerifyByAccount({
        accountId,
        reason: EReasonForNeedPassword.Default,
      });
    await this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
      async () =>
        this.backgroundApi.serviceHardware.uploadResource(
          deviceParams?.dbDevice.connectId ?? '',
          uploadResParams,
        ),
      { deviceParams, debugMethodName: 'nft.uploadNFTImageToDevice' },
    );
  }

  @backgroundMethod()
  public async abortFetchAccountNFTs() {
    this._fetchAccountNFTsControllers.forEach((controller) => {
      controller.abort();
    });
    this._fetchAccountNFTsControllers = [];
  }

  @backgroundMethod()
  public async fetchAccountNFTs(params: IFetchAccountNFTsParams) {
    const {
      accountId,
      networkId,
      isAllNetworks,
      allNetworksAccountId,
      allNetworksNetworkId,
      isManualRefresh,
      saveToLocal,
      ...rest
    } = params;

    if (
      isAllNetworks &&
      this._currentNetworkId !== getNetworkIdsMap().onekeyall
    ) {
      return {
        data: [],
        next: '',
        networkId: this._currentNetworkId,
      };
    }

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
        omitBy(
          {
            networkId,
            accountAddress,
            xpub,
            isAllNetwork: isAllNetworks,
            isForceRefresh: isManualRefresh,
            ...rest,
          },
          isNil,
        ),
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

    resp.data.data.networkId = this._currentNetworkId;

    resp.data.data.isSameAllNetworksAccountData = !!(
      allNetworksAccountId &&
      allNetworksNetworkId &&
      allNetworksAccountId === this._currentAccountId &&
      allNetworksNetworkId === this._currentNetworkId
    );

    if (saveToLocal) {
      await this.updateAccountLocalNFTs({
        accountId,
        networkId,
        nfts: resp.data.data.data,
      });
    }

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

  @backgroundMethod()
  public async updateAccountLocalNFTs(params: {
    accountId: string;
    networkId: string;
    nfts: IAccountNFT[];
  }) {
    const { accountId, networkId, nfts } = params;
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
    await this.backgroundApi.simpleDb.localNFTs.updateAccountNFTs({
      networkId,
      accountAddress,
      xpub,
      nfts,
    });
  }

  @backgroundMethod()
  public async getAccountLocalNFTs(params: {
    accountId: string;
    networkId: string;
  }) {
    const { accountId, networkId } = params;
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

    const localNFTs =
      await this.backgroundApi.simpleDb.localNFTs.getAccountNFTs({
        networkId,
        accountAddress,
        xpub,
      });

    return localNFTs;
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
