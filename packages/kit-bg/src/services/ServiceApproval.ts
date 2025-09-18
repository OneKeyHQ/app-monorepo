import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworksSupportBulkRevokeApproval } from '@onekeyhq/shared/src/config/presetNetworks';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
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
        (i) =>
          networksSupportBulkRevokeApproval[i.networkId] && i.accountAddress,
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

    if (queries.length === 0) {
      return {
        contractApprovals: [],
        tokenMap: {},
        contractMap: {},
      };
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

    // 90 days
    const inactiveApprovalTime = timerUtils.getTimeDurationMs({ day: 90 });
    const now = Date.now();

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
          isRiskContract: true,
        });
      } else {
        normalApprovals.push({
          ...item,
          accountId: query.accountId,
          owner: query.accountAddress,
          isInactiveApproval:
            now - item.latestApprovalTime > inactiveApprovalTime,
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

  @backgroundMethod()
  async shouldShowRiskApprovalsRevokeSuggestion({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }) {
    const config =
      await this.backgroundApi.simpleDb.approval.getRiskApprovalsRevokeSuggestionConfig(
        {
          networkId,
          accountId,
        },
      );

    if (config && config.lastShowTime) {
      const interval = Date.now() - config.lastShowTime;
      if (interval > timerUtils.getTimeDurationMs({ day: 14 })) {
        return true;
      }
      return false;
    }

    return true;
  }

  @backgroundMethod()
  async shouldShowInactiveApprovalsAlert({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }) {
    const config =
      await this.backgroundApi.simpleDb.approval.getInactiveApprovalsAlertConfig(
        {
          networkId,
          accountId,
        },
      );
    if (config && config.lastShowTime) {
      const interval = Date.now() - config.lastShowTime;
      if (interval > timerUtils.getTimeDurationMs({ day: 30 })) {
        return true;
      }
      return false;
    }

    return true;
  }

  @backgroundMethod()
  async updateRiskApprovalsRevokeSuggestionConfig({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }) {
    await this.backgroundApi.simpleDb.approval.updateRiskApprovalsRevokeSuggestionConfig(
      {
        networkId,
        accountId,
      },
    );
  }

  @backgroundMethod()
  async updateInactiveApprovalsAlertConfig({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }) {
    await this.backgroundApi.simpleDb.approval.updateInactiveApprovalsAlertConfig(
      {
        networkId,
        accountId,
      },
    );
  }
}

export default ServiceApproval;
