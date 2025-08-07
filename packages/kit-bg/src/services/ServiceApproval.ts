import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworksSupportBulkRevokeApproval } from '@onekeyhq/shared/src/config/presetNetworks';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { TX_RISKY_LEVEL_SPAM } from '@onekeyhq/shared/src/walletConnect/constant';
import type {
  IContractApproval,
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
      accountId: string;
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
            withoutAccountId: false,
          },
        );
      queries = allNetworkAccounts.filter(
        (i) => networksSupportBulkRevokeApproval[i.networkId],
      ) as {
        accountId: string;
        networkId: string;
        accountAddress: string;
      }[];
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
        accountId,
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

    const contractApprovals = resp.data.data.contractApprovals ?? [];

    const riskApprovals: IContractApproval[] = [];
    const normalApprovals: IContractApproval[] = [];

    for (const item of contractApprovals) {
      const query = queries.find((q) => q.networkId === item.networkId) as {
        accountId: string;
        networkId: string;
        accountAddress: string;
      };

      if (item.highestRiskLevel >= TX_RISKY_LEVEL_SPAM) {
        riskApprovals.push({
          ...item,
          accountId: query.accountId,
          owner: query.accountAddress,
        });
      } else {
        normalApprovals.push({
          ...item,
          accountId: query.accountId,
          owner: query.accountAddress,
        });
      }
    }

    return {
      ...resp.data.data,
      contractApprovals: [
        ...riskApprovals.sort(
          (a, b) => b.latestApprovalTime - a.latestApprovalTime,
        ),
        ...normalApprovals.sort(
          (a, b) => b.latestApprovalTime - a.latestApprovalTime,
        ),
      ],
    };
  }
}

export default ServiceApproval;
