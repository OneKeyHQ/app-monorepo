import { useMemo } from 'react';
import { useAppSelector } from '../../../hooks';

export const useMarketTokenChart = ({
  coingeckoId,
}: {
  coingeckoId: string;
}) => {
  const charts = useAppSelector((s) => s.market.charts);
  return useMemo(() => charts[coingeckoId], [charts, coingeckoId]);
};

export const useMarketTokenInfo = ({
  coingeckoId,
}: {
  coingeckoId: string;
}) => {
  const infos = useAppSelector((s) => s.market.infos);
  return useMemo(() => infos[coingeckoId], [infos, coingeckoId]);
};

export const useMarketTokenStats = ({
  coingeckoId,
}: {
  coingeckoId: string;
}) => {
  const stats = useAppSelector((s) => s.market.stats);
  return useMemo(() => stats[coingeckoId], [stats, coingeckoId]);
};
