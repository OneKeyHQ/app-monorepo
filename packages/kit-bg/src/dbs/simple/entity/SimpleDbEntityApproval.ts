import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface ISimpleDbApprovalConfig {
  riskApprovalsRevokeSuggestionConfig: Record<string, { lastShowTime: number }>;
  inactiveApprovalsAlertConfig: Record<string, { lastShowTime: number }>; // key: networkId_accountId
}

function buildConfigKey(networkId: string, accountId: string) {
  return `${networkId}_${accountId}`;
}

export class SimpleDbEntityApproval extends SimpleDbEntityBase<ISimpleDbApprovalConfig> {
  entityName = 'approval';

  override enableCache = false;

  @backgroundMethod()
  async getRiskApprovalsRevokeSuggestionConfig({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }) {
    const config = await this.getRawData();
    const key = buildConfigKey(networkId, accountId);
    return config?.riskApprovalsRevokeSuggestionConfig[key];
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
    const key = buildConfigKey(networkId, accountId);
    return config?.inactiveApprovalsAlertConfig[key];
  }

  @backgroundMethod()
  async updateRiskApprovalsRevokeSuggestionConfig({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }) {
    await this.setRawData((rawData) => {
      const key = buildConfigKey(networkId, accountId);
      return {
        inactiveApprovalsAlertConfig:
          rawData?.inactiveApprovalsAlertConfig ?? {},
        riskApprovalsRevokeSuggestionConfig: {
          ...rawData?.riskApprovalsRevokeSuggestionConfig,
          [key]: {
            ...rawData?.riskApprovalsRevokeSuggestionConfig[key],
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
      const key = buildConfigKey(networkId, accountId);
      return {
        riskApprovalsRevokeSuggestionConfig:
          rawData?.riskApprovalsRevokeSuggestionConfig ?? {},
        inactiveApprovalsAlertConfig: {
          ...rawData?.inactiveApprovalsAlertConfig,
          [key]: {
            ...rawData?.inactiveApprovalsAlertConfig[key],
            lastShowTime: Date.now(),
          },
        },
      };
    });
  }
}
