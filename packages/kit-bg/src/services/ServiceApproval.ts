import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworksSupportBulkRevokeApproval } from '@onekeyhq/shared/src/config/presetNetworks';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
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
    const { accountId, networkId } = params;

    let queries: {
      accountAddress: string;
      networkId: string;
    }[] = [];

    if (networkUtils.isAllNetwork({ networkId })) {
      const networksSupportBulkRevokeApproval =
        getNetworksSupportBulkRevokeApproval();

      const { allNetworkAccounts } =
        await this.backgroundApi.serviceAllNetwork.buildAllNetworkAccountsForApiParam(
          {
            accountId,
            networkId,
            excludeIncompatibleWithWalletAccounts: true,
            withoutAccountId: true,
          },
        );
      queries = allNetworkAccounts.filter(
        (i) => networksSupportBulkRevokeApproval[i.networkId],
      );
    } else {
      let accountAddress = params.accountAddress;
      if (!accountAddress) {
        accountAddress =
          await this.backgroundApi.serviceAccount.getAccountAddressForApi({
            accountId,
            networkId,
          });
      }

      queries.push({
        accountAddress,
        networkId,
      });
    }

    const controller = new AbortController();
    this._fetchAccountApprovalsControllers.push(controller);

    const client = await this.getClient(EServiceEndpointEnum.Wallet);

    const resp = await client.post<{
      data: IFetchAccountApprovalsResponse;
    }>(
      `/wallet/v1/account/token-approval/list`,
      {
        queries,
      },
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
