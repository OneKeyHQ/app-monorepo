import type { IMarketTokenSecurityData } from '@onekeyhq/shared/types/marketV2';

export type ISecurityStatus = 'safe' | 'caution' | 'risk';

export type ISecurityKeyValue = {
  key: string;
  label: string;
  value: string | number | boolean;
  riskType: 'safe' | 'caution' | 'normal' | 'risk';
};

export type IUseTokenSecurityParams = {
  tokenAddress?: string;
  networkId: string;
};

export type IUseTokenSecurityResult = {
  securityData: IMarketTokenSecurityData | null;
  securityStatus: ISecurityStatus | null;
  riskCount: number;
  cautionCount: number;
  formattedData: ISecurityKeyValue[];
};
