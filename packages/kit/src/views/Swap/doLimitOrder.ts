import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import {
  setInstantRate,
  setLoading,
  setMktRate,
  setTypedPrice,
} from '../../store/reducers/limitOrder';

import { SwapQuoter } from './quoter';

import type { ILimitOrderQuoteParams } from './typings';

const refs: { params: ILimitOrderQuoteParams | undefined; count: number } = {
  params: undefined,
  count: 0,
};

export const fetchOrderInstantRate = async ({
  params,
  loading,
}: {
  params: ILimitOrderQuoteParams | undefined;
  loading: boolean;
}) => {
  refs.params = params;
  if (!params) {
    backgroundApiProxy.dispatch(
      setInstantRate(''),
      setMktRate(''),
      setLoading(false),
      setTypedPrice({ reversed: false, value: '' }),
    );
    return;
  }
  if (loading) {
    backgroundApiProxy.dispatch(setLoading(true));
  }
  refs.count += 1;
  try {
    const res = await SwapQuoter.client.fetchLimitOrderQuote(params);
    if (res && refs.params === params) {
      backgroundApiProxy.serviceLimitOrder.setRate(res.instantRate);
    }
  } finally {
    refs.count -= 1;
    if (refs.count === 0) {
      backgroundApiProxy.dispatch(setLoading(false));
    }
  }
};
