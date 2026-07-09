import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import type { IKytRiskDetail } from '@onekeyhq/shared/types/kyt';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import type {
  IDeFiProtocol,
  IDeFiSupportedProtocolAction,
  IProtocolSummary,
} from '../../types/defi';
import type { IUtxoAddressInfo } from '../../types/tx';

export enum EModalAssetDetailRoutes {
  TokenDetails = 'AssetDetail_TokenDetails',
  DeFiProtocolDetails = 'AssetDetail_DeFiProtocolDetails',
  NFTDetails = 'AssetDetail_NFTDetails',
  HistoryDetails = 'AssetDetail_HistoryDetails',
  UTXODetails = 'AssetDetail_UTXODetails',
  MarketDetail = 'AssetDetail_MarketDetail',
  KytRiskDetail = 'AssetDetail_KytRiskDetail',
}

export type IModalAssetDetailsParamList = {
  [EModalAssetDetailRoutes.TokenDetails]: {
    accountId: string;
    networkId: string;
    walletId: string;
    isBlocked?: boolean;
    riskyTokens?: string[];
    isAllNetworks?: boolean;
    indexedAccountId: string;
    tokenInfo: IAccountToken;
    aggregateTokens?: IAccountToken[];
    tokenMap?: Record<string, ITokenFiat>;
    accountAddress?: string;
  };
  [EModalAssetDetailRoutes.MarketDetail]: {
    token: string;
  };
  [EModalAssetDetailRoutes.NFTDetails]: {
    networkId: string;
    accountId: string;
    walletId: string;
    collectionAddress: string;
    itemId: string;
  };
  [EModalAssetDetailRoutes.HistoryDetails]: {
    accountId: string;
    networkId: string;
    transactionHash?: string;
    accountAddress?: string;
    notificationId?: string;
    notificationAccountId?: string;
    historyTx: IAccountHistoryTx | undefined;
    isAllNetworks?: boolean;
    checkIsFocused?: boolean;
    allowClickAccountNameSwitch?: boolean;
  };
  [EModalAssetDetailRoutes.UTXODetails]: {
    accountId: string;
    networkId: string;
    txId: string;
    inputs?: IUtxoAddressInfo[];
    outputs?: IUtxoAddressInfo[];
  };
  [EModalAssetDetailRoutes.DeFiProtocolDetails]: {
    protocol: IDeFiProtocol;
    protocolInfo?: IProtocolSummary;
    accountId?: string;
    indexedAccountId?: string;
    // Passed from the DeFi list so the detail page renders action buttons on
    // the first paint (alongside the positions) instead of after its own async
    // fetch resolves — avoids the layout jump. Falls back to fetching when
    // absent (e.g. deep-linked without the list loaded).
    supportedActions?: IDeFiSupportedProtocolAction[];
  };
  [EModalAssetDetailRoutes.KytRiskDetail]: {
    riskDetail: IKytRiskDetail;
  };
};
