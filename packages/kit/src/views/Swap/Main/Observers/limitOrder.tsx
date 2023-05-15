import { useEffect } from 'react';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../../hooks';
import {
  setInstantRate,
  setMktRate,
  setTypedPrice,
} from '../../../../store/reducers/limitOrder';
import { fetchOrderInstantRate } from '../../doLimitOrder';
import { useLimitOrderParams } from '../../hooks/useLimitOrder';

const LimitOrderParamsObserver = () => {
  const params = useLimitOrderParams();
  useEffect(() => {
    fetchOrderInstantRate({ params, loading: true });
  }, [params]);
  return null;
};

const LimitOrderRateResetObserver = () => {
  const tokenIn = useAppSelector((s) => s.limitOrder.tokenIn);
  const tokenOut = useAppSelector((s) => s.limitOrder.tokenOut);
  useEffect(() => {
    backgroundApiProxy.dispatch(
      setMktRate(''),
      setInstantRate(''),
      setTypedPrice({ value: '' }),
    );
  }, [tokenIn, tokenOut]);
  return null;
};

export const LimitOrderObserver = () => (
  <>
    <LimitOrderParamsObserver />
    <LimitOrderRateResetObserver />
  </>
);
