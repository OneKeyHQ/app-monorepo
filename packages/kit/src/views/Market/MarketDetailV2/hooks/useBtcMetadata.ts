import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IBtcMetadata,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/marketV2';

import { formatNextHalving } from '../utils/formatNextHalving';

import { useTokenDetail } from './useTokenDetail';

export type IUseBtcMetadataResult = Omit<
  IBtcMetadata,
  'nextHalving' | 'updatedAt' | 'stale'
> & {
  nextHalvingDisplay: string;
};

type IUseBtcMetadataFromTokenDetailParams = {
  tokenDetail?: IMarketTokenDetail;
  networkId?: string;
};

export function useBtcMetadataFromTokenDetail({
  tokenDetail,
  networkId,
}: IUseBtcMetadataFromTokenDetailParams): IUseBtcMetadataResult | null {
  const intl = useIntl();

  return useMemo(() => {
    if (networkId !== getNetworkIdsMap().btc) {
      return null;
    }
    const meta = tokenDetail?.btcMetadata;
    const estimatedSecondsUntilHalving =
      meta?.nextHalving?.estimatedSecondsUntilHalving;
    if (
      !meta ||
      meta.stale ||
      !Number.isFinite(Number(estimatedSecondsUntilHalving))
    ) {
      return null;
    }
    return {
      marketCap: meta.marketCap,
      circulatingSupply: meta.circulatingSupply,
      remainingSupply: meta.remainingSupply,
      totalSupply: meta.totalSupply,
      fdv: meta.fdv,
      volume24h: meta.volume24h,
      blockHeight: meta.blockHeight,
      blockReward: meta.blockReward,
      nextHalvingDisplay: formatNextHalving(
        Number(estimatedSecondsUntilHalving),
        {
          y: (amount) =>
            intl.formatMessage(
              { id: ETranslations.dexmarket_token_age_y },
              { amount },
            ),
          d: (amount) =>
            intl.formatMessage(
              { id: ETranslations.dexmarket_token_age_d },
              { amount },
            ),
          h: (amount) =>
            intl.formatMessage(
              { id: ETranslations.dexmarket_token_age_h },
              { amount },
            ),
          imminent: () =>
            intl.formatMessage({
              id: ETranslations.dexmarket_btc_next_halving_imminent,
            }),
        },
      ),
    };
  }, [intl, networkId, tokenDetail?.btcMetadata]);
}

export function useBtcMetadata(): IUseBtcMetadataResult | null {
  const { tokenDetail, networkId } = useTokenDetail();

  return useBtcMetadataFromTokenDetail({
    tokenDetail,
    networkId,
  });
}
