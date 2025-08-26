import type { IMarketTokenSecurityData } from '@onekeyhq/shared/types/marketV2';

export type ISecurityStatus = 'safe' | 'warning';

export type ISecurityKeyValue = {
  key: string;
  label: string;
  value: string;
  isWarning: boolean;
};

export type IUseTokenSecurityParams = {
  tokenAddress?: string;
  networkId: string;
};

export type IUseTokenSecurityResult = {
  securityData: IMarketTokenSecurityData | null;
  securityStatus: ISecurityStatus | null;
  warningCount: number;
  formattedData: ISecurityKeyValue[];
};
