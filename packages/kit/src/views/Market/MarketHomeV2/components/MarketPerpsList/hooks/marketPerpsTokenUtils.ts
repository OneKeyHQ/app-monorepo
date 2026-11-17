import {
  getTokenSubtitle,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { ITokenSearchAliases } from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IMarketPerpsTokenFromServer } from '@onekeyhq/shared/types/marketV2';

export interface IMarketPerpsToken {
  name: string;
  displayName: string;
  dexLabel?: string;
  maxLeverage: number;
  subtitle?: string;
  tokenImageUrl: string;
  markPrice: string;
  prevDayPrice: string;
  change24hPercent: number;
  volume24h: string;
  openInterest: string;
  fundingRate: string;
}

export function mapServerToken(
  token: IMarketPerpsTokenFromServer,
  tokenSearchAliases: ITokenSearchAliases | undefined,
): IMarketPerpsToken {
  const { dexLabel } = parseDexCoin(token.name);

  return {
    name: token.name,
    displayName: token.displayName,
    dexLabel,
    maxLeverage: token.maxLeverage,
    subtitle: getTokenSubtitle(token.name, tokenSearchAliases),
    tokenImageUrl: token.tokenImageUrl,
    markPrice: token.markPrice,
    prevDayPrice: token.prevDayPrice,
    change24hPercent: token.change24hPercent,
    volume24h: token.volume24h,
    openInterest: token.openInterest,
    fundingRate: token.fundingRate,
  };
}
