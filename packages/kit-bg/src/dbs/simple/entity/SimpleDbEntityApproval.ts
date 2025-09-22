import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface ISimpleDbApprovalConfig {
  approvalResurfaceDaysConfig?: {
    approvalResurfaceDays: number;
    approvalAlertResurfaceDays: number;
  };
  riskApprovalsRevokeSuggestionConfig?: Record<
    string,
    { lastShowTime: number }
  >;
  inactiveApprovalsRevokeSuggestionConfig?: Record<
    string,
    { lastShowTime: number }
  >;
  inactiveApprovalsAlertConfig?: Record<string, { lastShowTime: number }>; // key: networkId_accountId
  riskApprovalsAlertConfig?: Record<string, { lastShowTime: number }>; // key: networkId_accountId
}

function buildApprovalAlertKey(networkId: string, accountId: string) {
  return `${networkId}_${accountId}`;
}

function buildApprovalRevokeSuggestionKey({
  accountId,
  indexedAccountId,
}: {
  accountId: string;
  indexedAccountId?: string;
}) {
  if (accountUtils.isOthersAccount({ accountId })) {
    return accountId;
  }

  const walletId = accountUtils.getWalletIdFromAccountId({ accountId });

  return `${walletId}_${indexedAccountId ?? ''}`;
}

export class SimpleDbEntityApproval extends SimpleDbEntityBase<ISimpleDbApprovalConfig> {
  entityName = 'approval';

  override enableCache = false;

  @backgroundMethod()
  async getRiskApprovalsRevokeSuggestionConfig({
    accountId,
    indexedAccountId,
  }: {
    accountId: string;
    indexedAccountId?: string;
  }) {
    const config = await this.getRawData();
    const key = buildApprovalRevokeSuggestionKey({
      accountId,
      indexedAccountId,
    });
    return config?.riskApprovalsRevokeSuggestionConfig?.[key];
  }

  @backgroundMethod()
  async getInactiveApprovalsRevokeSuggestionConfig({
    accountId,
    indexedAccountId,
  }: {
    accountId: string;
    indexedAccountId?: string;
  }) {
    const config = await this.getRawData();
    const key = buildApprovalRevokeSuggestionKey({
      accountId,
      indexedAccountId,
    });
    return config?.inactiveApprovalsRevokeSuggestionConfig?.[key];
  }

  @backgroundMethod()
  async getInactiveApprovalsAlertConfig({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }) {
    const config = await this.getRawData();
    const key = buildApprovalAlertKey(networkId, accountId);
    return config?.inactiveApprovalsAlertConfig?.[key];
  }

  @backgroundMethod()
  async getApprovalResurfaceDaysConfig() {
    const config = await this.getRawData();
    return config?.approvalResurfaceDaysConfig;
  }

  @backgroundMethod()
  async getRiskApprovalsAlertConfig({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }) {
    const config = await this.getRawData();
    const key = buildApprovalAlertKey(networkId, accountId);
    return config?.riskApprovalsAlertConfig?.[key];
  }

  @backgroundMethod()
  async updateApprovalResurfaceDaysConfig({
    approvalResurfaceDays,
    approvalAlertResurfaceDays,
  }: {
    approvalResurfaceDays: number;
    approvalAlertResurfaceDays: number;
  }) {
    await this.setRawData((rawData) => {
      return {
        ...rawData,
        approvalResurfaceDaysConfig: {
          ...rawData?.approvalResurfaceDaysConfig,
          approvalResurfaceDays,
          approvalAlertResurfaceDays,
        },
      };
    });
  }

  @backgroundMethod()
  async updateRiskApprovalsRevokeSuggestionConfig({
    accountId,
    indexedAccountId,
  }: {
    accountId: string;
    indexedAccountId?: string;
  }) {
    await this.setRawData((rawData) => {
      const key = buildApprovalRevokeSuggestionKey({
        accountId,
        indexedAccountId,
      });
      return {
        riskApprovalsRevokeSuggestionConfig: {
          ...rawData?.riskApprovalsRevokeSuggestionConfig,
          [key]: {
            ...rawData?.riskApprovalsRevokeSuggestionConfig?.[key],
            lastShowTime: Date.now(),
          },
        },
      };
    });
  }

  @backgroundMethod()
  async updateInactiveApprovalsRevokeSuggestionConfig({
    accountId,
    indexedAccountId,
  }: {
    accountId: string;
    indexedAccountId?: string;
  }) {
    await this.setRawData((rawData) => {
      const key = buildApprovalRevokeSuggestionKey({
        accountId,
        indexedAccountId,
      });
      return {
        ...rawData,
        inactiveApprovalsRevokeSuggestionConfig: {
          ...rawData?.inactiveApprovalsRevokeSuggestionConfig,
          [key]: {
            ...rawData?.inactiveApprovalsRevokeSuggestionConfig?.[key],
            lastShowTime: Date.now(),
          },
        },
      };
    });
  }

  @backgroundMethod()
  async updateRiskApprovalsAlertConfig({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }) {
    await this.setRawData((rawData) => {
      const key = buildApprovalAlertKey(networkId, accountId);
      return {
        ...rawData,
        riskApprovalsAlertConfig: {
          ...rawData?.riskApprovalsAlertConfig,
          [key]: {
            ...rawData?.riskApprovalsAlertConfig?.[key],
            lastShowTime: Date.now(),
          },
        },
      };
    });
  }

  @backgroundMethod()
  async updateInactiveApprovalsAlertConfig({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }) {
    await this.setRawData((rawData) => {
      const key = buildApprovalAlertKey(networkId, accountId);
      return {
        ...rawData,
        inactiveApprovalsAlertConfig: {
          ...rawData?.inactiveApprovalsAlertConfig,
          [key]: {
            ...rawData?.inactiveApprovalsAlertConfig?.[key],
            lastShowTime: Date.now(),
          },
        },
      };
    });
  }
}
