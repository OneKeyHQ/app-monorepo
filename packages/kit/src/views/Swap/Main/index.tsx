import { Box } from '@onekeyhq/components';

import { useAppSelector } from '../../../hooks';
import {
  LimitOrderButtonProgressContext,
  SwapButtonProgressContext,
} from '../context';
import { useProgressStatusContext } from '../hooks/useSwapUtils';

import { LimitOrderMain } from './LimitOrder';
import { SwapMain } from './Swap';

export function Main() {
  const mode = useAppSelector((s) => s.swap.mode);
  const swapContext = useProgressStatusContext();
  const limitOrderContext = useProgressStatusContext();
  return (
    <SwapButtonProgressContext.Provider value={swapContext}>
      <LimitOrderButtonProgressContext.Provider value={limitOrderContext}>
        <Box>{mode === 'limit' ? <LimitOrderMain /> : <SwapMain />}</Box>
      </LimitOrderButtonProgressContext.Provider>
    </SwapButtonProgressContext.Provider>
  );
}
