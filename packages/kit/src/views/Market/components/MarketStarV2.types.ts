import type { IIconButtonProps, IStackProps } from '@onekeyhq/components';
import type { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';

export type IMarketStarV2Props = {
  size?: IIconButtonProps['size'];
  chainId: string;
  contractAddress: string;
  from: EWatchlistFrom;
  tokenSymbol?: string;
  isNative?: boolean;
  customIconSize?: string;
} & IStackProps;
