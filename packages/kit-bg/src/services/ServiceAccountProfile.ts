import type { IAddressQueryResult } from '@onekeyhq/kit/src/components/AddressInput';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { checkIsDomain } from '@onekeyhq/shared/src/utils/uriUtils';
import type {
  IAddressInteractionStatus,
  IAddressValidateStatus,
  IAddressValidation,
  IFetchAccountDetailsParams,
  IFetchAccountDetailsResp,
} from '@onekeyhq/shared/types/address';

import ServiceBase from './ServiceBase';

type IAddressNetworkIdParams = {
  networkId: string;
  address: string;
};

type IQueryAddressArgs = {
  networkId: string;
  address: string;
  accountId?: string;
  enableNameResolve?: boolean;
  enableAddressBook?: boolean;
  enableWalletName?: boolean;
  enableAddressInteractionStatus?: boolean;
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
    const client = await this.getClient();
    const resp = await client.get<{
      data: IFetchAccountDetailsResp;
    }>('/wallet/v1/account/get-account', {
      params,
    });
    return resp.data.data;
  }

  @backgroundMethod()
  public async validateAddress(
    params: IAddressNetworkIdParams,
  ): Promise<IAddressValidateStatus> {
    const { networkId, address } = params;
    try {
      const client = await this.getClient();
      const resp = await client.get<{
        data: IAddressValidation;
      }>('/wallet/v1/account/validate-address', {
        params: { networkId, accountAddress: address },
      });
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
        defaultLogger.addressInput.validation.failWithUnknownError(params);
        return 'unknown';
      }
    }
  }

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
      const client = await this.getClient();
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

  @backgroundMethod()
  public async queryAddress({
    networkId,
    address,
    accountId,
    enableNameResolve,
    enableAddressBook,
    enableWalletName,
    enableAddressInteractionStatus,
  }: IQueryAddressArgs) {
    const result: IAddressQueryResult = { input: address };
    if (!networkId) {
      return result;
    }
    result.validStatus = await this.validateAddress({
      networkId,
      address,
    });
    const isDomain = checkIsDomain(address);
    if (isDomain && enableNameResolve) {
      await this.handleNameSolve(networkId, address, result);
    }
    if (result.validStatus !== 'valid') {
      return result;
    }
    const resolveAddress = result.resolveAddress ?? result.input;
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
        const item = walletAccountItems[0];
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
    const resolveNames =
      await this.backgroundApi.serviceNameResolver.resolveName({
        name: address,
        networkId,
      });
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
}

export default ServiceAccountProfile;
