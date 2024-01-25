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
      await this.fetchAddressDetails({
        networkId,
        accountAddress: address,
        withValidate: true,
      });
      return true;
    } catch {
      return false;
    }
  }

  @backgroundMethod()
  public async queryAddress({
    networkId,
    address,
    enableNameResolve,
  }: IQueryAddressArgs) {
    const result: IAddressQueryResult = { input: address };
    if (networkId) {
      result.isValid = await this.validateAddress({
        networkId,
        address,
      });
      await this.backgroundApi.serviceValidator.validateAddress({
        networkId,
        address,
      });
      const includeDot = checkIsDomain(address);
      if (includeDot && enableNameResolve) {
        const resolveNames =
          await this.backgroundApi.serviceNameResolver.resolveName({
            name: address,
            networkId,
          });
        if (resolveNames) {
          result.resolveAddress = resolveNames.names?.[0].value;
          result.resolveOptions = resolveNames.names?.map((o) => o.value);

          if (!result.isValid) {
            const resolveValidateResult =
              await this.backgroundApi.serviceValidator.validateAddress({
                networkId,
                address: result.resolveAddress,
              });
            result.isValid = resolveValidateResult.isValid;
          }
        }
      }
    }
    return result;
  }
}

export default ServiceAccountProfile;
