import { noop } from 'lodash';

import { usePromiseResult } from '../../../hooks/usePromiseResult';
import {
  useHyperliquidActions,
  usePerpsAllMidsAtom,
} from '../../../states/jotai/contexts/hyperliquid';

export function usePerpsMidPrice({ coin }: { coin: string }): {
  mid: string | undefined;
  midFormattedByDecimals: string | undefined;
} {
  const [allMids] = usePerpsAllMidsAtom();
  const actions = useHyperliquidActions();
  const { result } = usePromiseResult(async () => {
    noop(allMids);
    return actions.current.getMidPrice({ coin });
  }, [allMids, coin, actions]);

  if (!result) {
    return { mid: undefined, midFormattedByDecimals: undefined };
  }
  return result;
}
