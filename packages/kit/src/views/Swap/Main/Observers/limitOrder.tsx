import { useEffect } from 'react';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../../hooks';
import {
  setInstantRate,
  setMktRate,
  setTypedPrice,
} from '../../../../store/reducers/limitOrder';
import {
  selectLimitOrderTokenIn,
  selectLimitOrderTokenOut,
} from '../../../../store/selectors';
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
  const tokenIn = useAppSelector(selectLimitOrderTokenIn);
  const tokenOut = useAppSelector(selectLimitOrderTokenOut);
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
