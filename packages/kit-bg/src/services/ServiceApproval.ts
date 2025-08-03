import qs from 'querystring';

import { isNil, omitBy } from 'lodash';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  IFetchAccountApprovalsParams,
  IFetchAccountApprovalsResponse,
} from '@onekeyhq/shared/types/approval';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceApproval extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  _fetchAccountApprovalsControllers: AbortController[] = [];

  @backgroundMethod()
  public async abortFetchAccountApprovals() {
    this._fetchAccountApprovalsControllers.forEach((controller) => {
      controller.abort();
    });
    this._fetchAccountApprovalsControllers = [];
  }

  @backgroundMethod()
  public async fetchAccountApprovals(params: IFetchAccountApprovalsParams) {
    const { networkId, spenderAddress, limit, accountId, dbAccount } = params;

    const accountParams = {
      accountId,
      networkId,
      dbAccount,
    };

    let accountAddress = params.accountAddress;
    if (!accountAddress) {
      accountAddress =
        await this.backgroundApi.serviceAccount.getAccountAddressForApi(
          accountParams,
        );
    }

    const controller = new AbortController();
    this._fetchAccountApprovalsControllers.push(controller);

    const client = await this.getClient(EServiceEndpointEnum.Wallet);

    const resp = await client.get<{
      data: IFetchAccountApprovalsResponse;
    }>(
      `/wallet/v1/account/token-approval/list?${qs.stringify(
        omitBy(
          {
            networkId,
            accountAddress,
            spenderAddress,
            limit,
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

    return resp.data.data;
  }
}

export default ServiceApproval;
