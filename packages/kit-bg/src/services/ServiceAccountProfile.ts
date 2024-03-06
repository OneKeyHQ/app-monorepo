import type { IAddressQueryResult } from '@onekeyhq/kit/src/common/components/AddressInput';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { checkIsDomain } from '@onekeyhq/shared/src/utils/uriUtils';
import type {
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
  enableNameResolve?: boolean;
  enableAddressBook?: boolean;
  enableWalletName?: boolean;
  enableFirstTransferCheck?: boolean;
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
  public async validateAddress({
    networkId,
    address,
  }: IAddressNetworkIdParams): Promise<boolean> {
    try {
      const result = await this.fetchAccountDetails({
        networkId,
        accountAddress: address,
        withValidate: true,
      });
      return Boolean(result.validateInfo?.isValid);
    } catch {
      return false;
    }
  }

  @backgroundMethod()
  public async queryAddress({
    networkId,
    address,
    enableNameResolve,
    enableAddressBook,
    enableWalletName,
  }: IQueryAddressArgs) {
    const result: IAddressQueryResult = { input: address };
    if (!networkId) {
      return result;
    }
    result.isValid = await this.validateAddress({
      networkId,
      address,
    });
    const isDomain = checkIsDomain(address);
    if (isDomain && enableNameResolve) {
      await this.handleNameSolve(networkId, address, result);
    }
    if (!result.isValid) {
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
      result.walletAccountName = walletAccountItems?.[0]?.accountName;
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
      if (!result.isValid) {
        result.isValid = await this.validateAddress({
          networkId,
          address: result.resolveAddress,
        });
      }
    }
    return result;
  }
}

export default ServiceAccountProfile;
