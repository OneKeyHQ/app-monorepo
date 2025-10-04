import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';

import { formatPriceToSignificantDigits } from '@onekeyhq/shared/src/utils/perpsUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { usePerpsAllMidsAtom } from '../../../states/jotai/contexts/hyperliquid';

export function usePerpsMidPrice({ coin }: { coin: string }): {
  mid: string | undefined;
  midFormattedByDecimals: string | undefined;
} {
  const [allMids] = usePerpsAllMidsAtom();
  const mid = allMids?.mids?.[coin];
  const midValue = new BigNumber(mid || '');
  const { result: tokenInfo } = usePromiseResult(async () => {
    return backgroundApiProxy.serviceHyperliquid.getSymbolMeta({
      coin,
    });
  }, [coin]);
  const szDecimals = tokenInfo?.universe?.szDecimals ?? null;
  const midFormattedByDecimals = useMemo(() => {
    if (isNil(szDecimals) || Number.isNaN(szDecimals)) {
      return mid;
    }
    const result = formatPriceToSignificantDigits(mid, szDecimals);
    return result;
  }, [mid, szDecimals]);
  if (midValue.isNaN() || midValue.isLessThanOrEqualTo(0)) {
    return { mid: undefined, midFormattedByDecimals: undefined };
  }
  return { mid, midFormattedByDecimals };
}
