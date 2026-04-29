import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { formatNextHalving } from '../utils/formatNextHalving';

import { useTokenDetail } from './useTokenDetail';

export interface IUseBtcMetadataResult {
  marketCap: string;
  circulatingSupply: string;
  remainingSupply: string;
  totalSupply: string;
  fdv: string;
  blockHeight: string;
  blockReward: string;
  nextHalvingDisplay: string;
}

export function useBtcMetadata(): IUseBtcMetadataResult | null {
  const intl = useIntl();
  const { tokenDetail, networkId } = useTokenDetail();

  return useMemo(() => {
    if (networkId !== getNetworkIdsMap().btc) {
      return null;
    }
    const meta = tokenDetail?.btcMetadata;
    if (!meta || meta.stale) {
      return null;
    }
    return {
      marketCap: meta.marketCap,
      circulatingSupply: meta.circulatingSupply,
      remainingSupply: meta.remainingSupply,
      totalSupply: meta.totalSupply,
      fdv: meta.fdv,
      blockHeight: meta.blockHeight,
      blockReward: meta.blockReward,
      nextHalvingDisplay: formatNextHalving(
        meta.nextHalving.estimatedSecondsUntilHalving,
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
        },
      ),
    };
  }, [intl, networkId, tokenDetail?.btcMetadata]);
}
