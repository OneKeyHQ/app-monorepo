import type { IAddressQueryResult } from '@onekeyhq/kit/src/components/AddressInput';
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
  accountId?: string;
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
  private async isFirstTransfer({
    networkId,
    fromAddress,
    toAddress,
  }: {
    networkId: string;
    fromAddress: string;
    toAddress: string;
  }): Promise<boolean> {
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
      return !resp.data.data.interacted;
    } catch {
      return false;
    }
  }

  @backgroundMethod()
  private async accountIsFirstTransferTo({
    networkId,
    accountId,
    toAddress,
  }: {
    networkId: string;
    accountId: string;
    toAddress: string;
  }): Promise<boolean> {
    const acc = await this.backgroundApi.serviceAccount.getAccount({
      networkId,
      accountId,
    });
    return this.isFirstTransfer({
      networkId,
      fromAddress: acc.address,
      toAddress,
    });
  }

  @backgroundMethod()
  public async queryAddress({
    networkId,
    address,
    accountId,
    enableNameResolve,
    enableAddressBook,
    enableWalletName,
    enableFirstTransferCheck,
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
      if (walletAccountItems.length > 0) {
        const item = walletAccountItems[0];
        result.walletAccountName = `${item.walletName} / ${item.accountName}`;
      }
    }
    if (enableFirstTransferCheck && resolveAddress && accountId) {
      const isFirstTransfer = await this.accountIsFirstTransferTo({
        networkId,
        accountId,
        toAddress: resolveAddress,
      });
      result.isFirstTransfer = isFirstTransfer;
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
