import qs from 'querystring';

import { groupBy, isNil, omitBy } from 'lodash';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworksSupportBulkRevokeApproval } from '@onekeyhq/shared/src/config/presetNetworks';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IAddressInfo } from '@onekeyhq/shared/types/address';
import type {
  IContractApproval,
  IFetchAccountApprovalsParams,
  IFetchAccountApprovalsResponse,
} from '@onekeyhq/shared/types/approval';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { IToken } from '@onekeyhq/shared/types/token';

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
    const { accountId, indexedAccountId, networkId } = params;

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

    const data = resp.data.data.data;

    const contractApprovals: IContractApproval[] = [];
    let tokenMap: Record<
      string,
      {
        price: string;
        price24h: string;
        info: IToken;
      }
    > = {};

    let contractMap: Record<string, IAddressInfo> = {};

    for (const query of queries) {
      const approvalDataByNetwork = data[query.networkId];
      if (approvalDataByNetwork) {
        const transformedTokens = Object.entries(
          approvalDataByNetwork.tokens,
        ).reduce((acc, [address, tokenData]) => {
          acc[`${query.networkId}_${address}`] = tokenData;
          return acc;
        }, {} as Record<string, { price: string; price24h: string; info: IToken }>);

        tokenMap = {
          ...tokenMap,
          ...transformedTokens,
        };
        contractMap = {
          ...contractMap,
          ...approvalDataByNetwork.addressMap,
        };

        const approvalsDataByAccountAddress =
          approvalDataByNetwork[query.accountAddress.toLowerCase()];
        if (approvalsDataByAccountAddress) {
          const approvalsDataByContract =
            approvalsDataByAccountAddress.approvals;
          if (approvalsDataByContract.length > 0) {
            const contractGroup = groupBy(
              approvalsDataByContract,
              'spenderAddress',
            );
            Object.entries(contractGroup).forEach(
              ([spenderAddress, approvals]) => {
                const latestApprovalTime = Math.max(
                  ...approvals.map((i) => i.time),
                );
                const highestRiskLevel = Math.max(
                  ...approvals.map((i) => i.riskLevel),
                );
                const reason = approvals.find(
                  (i) => i.riskLevel === highestRiskLevel,
                )?.reason;
                contractApprovals.push({
                  networkId: query.networkId,
                  latestApprovalTime,
                  highestRiskLevel,
                  riskReason: reason,
                  contractAddress: spenderAddress,
                  approvals,
                });
              },
            );
          }
        }
      }
    }

    return {
      contractApprovals,
      tokenMap,
      contractMap,
    };
  }
}

export default ServiceApproval;
