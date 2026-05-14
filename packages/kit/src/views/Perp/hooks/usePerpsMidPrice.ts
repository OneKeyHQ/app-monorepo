import { noop } from 'lodash';

import { usePromiseResult } from '../../../hooks/usePromiseResult';
import {
  useHyperliquidActions,
  usePerpsMidByCoin,
} from '../../../states/jotai/contexts/hyperliquid';

export function usePerpsMidPrice({ coin }: { coin: string }): {
  mid: string | undefined;
  midFormattedByDecimals: string | undefined;
} {
  const mid = usePerpsMidByCoin(coin);
  const actions = useHyperliquidActions();
  const { result } = usePromiseResult(async () => {
    noop(mid);
    return actions.current.getMidPrice({ coin });
  }, [mid, coin, actions]);

  if (!result) {
    return { mid: undefined, midFormattedByDecimals: undefined };
  }
  return result;
}
