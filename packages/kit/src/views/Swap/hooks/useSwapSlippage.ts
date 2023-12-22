import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useSwapSlippagePercentageAtom } from '../../../states/jotai/contexts/swap';

export const useSwapSlippageSync = () => {
  const [, setSwapSlippage] = useSwapSlippagePercentageAtom();
  usePromiseResult(async () => {
    const slippageConfigCache =
      await backgroundApiProxy.simpleDb.swapSlippage.getRawData();
    if (slippageConfigCache && slippageConfigCache.data) {
      setSwapSlippage(slippageConfigCache.data);
    }
  }, [setSwapSlippage]);
};
