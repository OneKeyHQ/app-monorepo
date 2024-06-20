import qs from 'querystring';

import { isNil, omitBy } from 'lodash';

import type { IAddressQueryResult } from '@onekeyhq/kit/src/components/AddressInput';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { parseRPCResponse } from '@onekeyhq/shared/src/request/utils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { addressIsEnsFormat } from '@onekeyhq/shared/src/utils/uriUtils';
import type {
  IAddressInteractionStatus,
  IAddressValidateStatus,
  IAddressValidation,
  IFetchAccountDetailsParams,
  IFetchAccountDetailsResp,
  IQueryCheckAddressArgs,
} from '@onekeyhq/shared/types/address';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { IResolveNameResp } from '@onekeyhq/shared/types/name';
import type {
  IProxyRequest,
  IProxyRequestItem,
  IProxyResponse,
  IRpcProxyResponse,
} from '@onekeyhq/shared/types/proxy';

import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';

type IAddressNetworkIdParams = {
  networkId: string;
  address: string;
};

@backgroundClass()
class ServiceAccountProfile extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  public async fetchAccountDetails(
    params: IFetchAccountDetailsParams,
  ): Promise<IFetchAccountDetailsResp> {
    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const resp = await client.get<{
      data: IFetchAccountDetailsResp;
    }>(`/wallet/v1/account/get-account?${qs.stringify(omitBy(params, isNil))}`);

    return resp.data.data;
  }

  @backgroundMethod()
  public async validateAddress(
    params: IAddressNetworkIdParams,
  ): Promise<IAddressValidateStatus> {
    const { networkId, address } = params;
    try {
      const resp = await this.fetchValidateAddressResult(params);
      return resp.data.data.isValid ? 'valid' : 'invalid';
    } catch (serverError) {
      try {
        const localValidation =
          await this.backgroundApi.serviceValidator.validateAddress({
            networkId,
            address,
          });
        return localValidation.isValid ? 'valid' : 'invalid';
      } catch (localError) {
        console.error('failed to validateAddress', serverError, localError);
        defaultLogger.addressInput.validation.failWithUnknownError({
          networkId,
          address,
          serverError: (serverError as Error).message,
          localError: (localError as Error).message,
        });
        return 'unknown';
      }
    }
  }

  fetchValidateAddressResult = memoizee(
    async (params: IAddressNetworkIdParams) => {
      const { networkId, address } = params;
      const client = await this.getClient(EServiceEndpointEnum.Wallet);
      const resp = await client.get<{
        data: IAddressValidation;
      }>('/wallet/v1/account/validate-address', {
        params: { networkId, accountAddress: address },
      });
      return resp;
    },
    {
      maxAge: timerUtils.getTimeDurationMs({ seconds: 10 }),
    },
  );

  private async getAddressInteractionStatus({
    networkId,
    fromAddress,
    toAddress,
  }: {
    networkId: string;
    fromAddress: string;
    toAddress: string;
  }): Promise<IAddressInteractionStatus> {
    try {
      const client = await this.getClient(EServiceEndpointEnum.Wallet);
      const resp = await client.get<{
        data: {
          interacted: boolean;
        };
      }>('/wallet/v1/account/interacted', {
        params: {
          networkId,
          accountAddress: fromAddress,
          toAccountAddress: toAddress,
        },
      });
      return resp.data.data.interacted ? 'interacted' : 'not-interacted';
    } catch {
      return 'unknown';
    }
  }

  private async checkAccountInteractionStatus({
    networkId,
    accountId,
    toAddress,
  }: {
    networkId: string;
    accountId: string;
    toAddress: string;
  }): Promise<IAddressInteractionStatus | undefined> {
    const acc = await this.backgroundApi.serviceAccount.getAccount({
      networkId,
      accountId,
    });
    if (acc.address.toLowerCase() !== toAddress.toLowerCase()) {
      return this.getAddressInteractionStatus({
        networkId,
        fromAddress: acc.address,
        toAddress,
      });
    }
  }

  private async verifyCannotSendToSelf({
    networkId,
    accountId,
    accountAddress,
  }: {
    networkId: string;
    accountId: string;
    accountAddress: string;
  }): Promise<boolean> {
    const vault = await vaultFactory.getVault({ networkId, accountId });
    const vaultSettings = await vault.getVaultSettings();
    if (!vaultSettings.cannotSendToSelf) {
      return false;
    }
    const acc = await this.backgroundApi.serviceAccount.getAccount({
      networkId,
      accountId,
    });
    const addressValidation = await vault.validateAddress(accountAddress);
    return (
      acc.addressDetail.displayAddress === addressValidation.displayAddress
    );
  }

  @backgroundMethod()
  public async queryAddress({
    networkId,
    address,
    accountId,
    enableNameResolve,
    enableAddressBook,
    enableWalletName,
    enableAddressInteractionStatus,
    enableVerifySendFundToSelf,
    skipValidateAddress,
  }: IQueryCheckAddressArgs) {
    const result: IAddressQueryResult = { input: address };
    if (!networkId) {
      return result;
    }

    if (!skipValidateAddress) {
      result.validStatus = await this.validateAddress({
        networkId,
        address,
      });
    }

    if (enableNameResolve) {
      const vault = await vaultFactory.getChainOnlyVault({ networkId });
      const isDomain = await vault.checkIsDomainName({ name: address });
      if (isDomain) {
        await this.handleNameSolve(networkId, address, result);
      }
    }
    if (!skipValidateAddress && result.validStatus !== 'valid') {
      return result;
    }
    const resolveAddress = result.resolveAddress ?? result.input;
    if (enableVerifySendFundToSelf && accountId && resolveAddress) {
      const disableFundToSelf = await this.verifyCannotSendToSelf({
        networkId,
        accountId,
        accountAddress: resolveAddress,
      });
      if (disableFundToSelf) {
        result.validStatus = 'prohibit-send-to-self';
        return result;
      }
    }

    if (enableAddressBook && resolveAddress) {
      // handleAddressBookName
      const addressBookItem =
        await this.backgroundApi.serviceAddressBook.findItem({
          networkId,
          address: resolveAddress,
        });
      result.addressBookName = addressBookItem?.name;
    }
    if (enableWalletName && resolveAddress) {
      // handleWalletAccountName
      const walletAccountItems =
        await this.backgroundApi.serviceAccount.getAccountNameFromAddress({
          networkId,
          address: resolveAddress,
        });

      if (walletAccountItems.length > 0) {
        let item = walletAccountItems[0];
        if (accountId) {
          const account = await this.backgroundApi.serviceAccount.getAccount({
            accountId,
            networkId,
          });
          const accountItem = walletAccountItems.find(
            (a) =>
              account.indexedAccountId === a.accountId ||
              account.id === a.accountId,
          );

          if (accountItem) {
            item = accountItem;
          }
        }

        result.walletAccountName = `${item.walletName} / ${item.accountName}`;
      }
    }
    if (enableAddressInteractionStatus && resolveAddress && accountId) {
      result.addressInteractionStatus =
        await this.checkAccountInteractionStatus({
          networkId,
          accountId,
          toAddress: resolveAddress,
        });
    }
    return result;
  }

  private async handleNameSolve(
    networkId: string,
    address: string,
    result: IAddressQueryResult,
  ) {
    const vault = await vaultFactory.getChainOnlyVault({ networkId });
    let resolveNames: IResolveNameResp | null | undefined =
      await vault.resolveDomainName({
        name: address,
      });

    if (!resolveNames) {
      resolveNames = await this.backgroundApi.serviceNameResolver.resolveName({
        name: address,
        networkId,
      });
    }

    if (resolveNames && resolveNames.names?.length) {
      result.resolveAddress = resolveNames.names?.[0].value;
      result.resolveOptions = resolveNames.names?.map((o) => o.value);
      if (result.validStatus !== 'valid') {
        result.validStatus = await this.validateAddress({
          networkId,
          address: result.resolveAddress,
        });
      }
    }
    return result;
  }

  @backgroundMethod()
  async sendProxyRequest<T>({
    networkId,
    body,
    returnRawData,
  }: {
    networkId: string;
    body: IProxyRequestItem[];
    returnRawData?: boolean;
  }): Promise<T[]> {
    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const request: IProxyRequest = { networkId, body };
    const resp = await client.post<IProxyResponse<T>>(
      '/wallet/v1/proxy/wallet',
      request,
    );
    const data = resp.data.data.data;
    if (data.some((item) => !item.success)) {
      if (returnRawData) {
        // @ts-expect-error
        return data;
      }
      throw new Error('Failed to send proxy request');
    }
    return data.map((item) => item.data);
  }

  async sendRpcProxyRequest<T>({
    networkId,
    body,
  }: {
    networkId: string;
    body: IProxyRequestItem[];
  }): Promise<T[]> {
    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const request: IProxyRequest = { networkId, body };
    const resp = await client.post<IRpcProxyResponse<T>>(
      '/wallet/v1/proxy/wallet',
      request,
    );

    const data = resp.data.data.data;

    return Promise.all(data.map((item) => parseRPCResponse<T>(item)));
  }
}

export default ServiceAccountProfile;
