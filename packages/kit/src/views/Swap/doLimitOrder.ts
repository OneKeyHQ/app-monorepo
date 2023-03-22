import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import {
  setInstantRate,
  setLoading,
  setMktRate,
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
    );
    return;
  }
  if (loading) {
    backgroundApiProxy.dispatch(setLoading(true));
  }
  refs.count += 1;
  try {
    const res = await SwapQuoter.client.fetchLimitOrderQuote(params);
    if (refs.params === params) {
      if (res) {
        backgroundApiProxy.dispatch(
          setInstantRate(res.instantRate),
          setMktRate(res.instantRate),
        );
      }
    }
  } finally {
    refs.count -= 1;
    if (refs.count === 0) {
      backgroundApiProxy.dispatch(setLoading(false));
    }
  }
};
