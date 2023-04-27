import BigNumber from 'bignumber.js';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import {
  setError,
  setLoading,
  setQuote,
  setQuoteLimited,
  setResponses,
} from '../../store/reducers/swap';

import { SwapQuoter } from './quoter';
import { dangerRefs } from './refs';
import { QuoterType, SwapError } from './typings';
import { getTokenAmountString } from './utils';

import type { FetchQuoteParams, FetchQuoteResponse } from './typings';

const refs: { params: FetchQuoteParams | undefined; count: number } = {
  params: undefined,
  count: 0,
};

const findBestResponse = async (
  responses: FetchQuoteResponse[],
): Promise<FetchQuoteResponse | undefined> => {
  const items = responses.filter(
    (item) => !item.limited && item.data !== undefined,
  ) as Required<Pick<FetchQuoteResponse, 'data'>>[];
  if (items.length > 0) {
    const selectedQuoter =
      await backgroundApiProxy.serviceSwap.getCurrentUserSelectedQuoter();
    if (selectedQuoter) {
      const finded = items.find((item) => item.data.type === selectedQuoter);
      if (finded) {
        return finded;
      }
    }
    if (items.length === 1) {
      return items[0];
    }
    items.sort((a, b) => {
      const amountA = a.data.estimatedBuyAmount ?? a.data.buyAmount;
      const amountB = b.data.estimatedBuyAmount ?? b.data.buyAmount;
      return Number(amountB) - Number(amountA);
    });
    return items[0];
  }
  const notNullResponses = responses.filter(
    (res) => res.data,
  ) as Required<FetchQuoteResponse>[];
  if (notNullResponses.length === 0) {
    return;
  }
  if (notNullResponses.length === 1) {
    return notNullResponses[0];
  }
  let selectedRes = notNullResponses[0];
  let currentPriority: BigNumber | undefined;
  for (let i = 0; i < notNullResponses.length; i += 1) {
    const item = notNullResponses[i];
    const max = item?.limited?.max;
    const min = item?.limited?.min;
    const sellAmount = new BigNumber(item.data.sellAmount);
    const values: BigNumber.Value[] = [];
    if (!sellAmount.isNaN() && max) {
      values.push(sellAmount.minus(max).abs());
    }
    if (!sellAmount.isNaN() && min) {
      values.push(sellAmount.minus(min).abs());
    }
    let priority: BigNumber | undefined;
    if (values.length) {
      priority = BigNumber.min(...values);
    }
    if (priority && (!currentPriority || priority.lt(currentPriority))) {
      selectedRes = item;
      currentPriority = priority;
    }
  }
  return selectedRes;
};

const refreshQuotes = async (params: FetchQuoteParams) => {
  try {
    const responses = await SwapQuoter.client.fetchQuotes(params);
    if (!dangerRefs.submited && refs.params === params) {
      if (responses) {
        backgroundApiProxy.dispatch(setResponses(responses));
        const res = await findBestResponse(responses);
        if (res) {
          backgroundApiProxy.dispatch(
            setQuote(res.data),
            setQuoteLimited(res.limited),
          );
        } else {
          backgroundApiProxy.dispatch(
            setError(SwapError.NotSupport),
            setQuoteLimited(undefined),
          );
        }
      }
    }
  } catch (e) {
    backgroundApiProxy.dispatch(
      setError(SwapError.QuoteFailed),
      setLoading(false),
    );
  }
};

const fetchFastestQuote = async (params: FetchQuoteParams) => {
  let firstResponse: FetchQuoteResponse | undefined;
  const fetchAllQuotes = async () => {
    const responses = await SwapQuoter.client.fetchQuotes(params);
    if (!dangerRefs.submited && refs.params === params && responses) {
      backgroundApiProxy.dispatch(setResponses(responses));
      const res = await findBestResponse(responses);
      if (res && res.data?.type !== firstResponse?.data?.type) {
        if (!firstResponse) {
          firstResponse = res;
        }
        backgroundApiProxy.dispatch(
          setQuote(res.data),
          setQuoteLimited(res.limited),
        );
      }
    }
  };

  fetchAllQuotes();
  try {
    const res = await SwapQuoter.client.fetchQuote(params);
    if (refs.params === params && !firstResponse) {
      if (res) {
        firstResponse = res;
        backgroundApiProxy.dispatch(
          setQuote(res.data),
          setQuoteLimited(res.limited),
        );
      } else {
        backgroundApiProxy.dispatch(
          setError(SwapError.NotSupport),
          setQuoteLimited(undefined),
        );
      }
    }
  } catch {
    backgroundApiProxy.dispatch(
      setError(SwapError.QuoteFailed),
      setLoading(false),
    );
  }
};

export const doQuote = async ({
  params,
  loading,
}: {
  params: FetchQuoteParams | undefined;
  loading: boolean;
}) => {
  refs.params = params;
  if (!params) {
    backgroundApiProxy.dispatch(
      setQuote(undefined),
      setResponses(undefined),
      setLoading(false),
    );
    return;
  }
  const wrapperTransaction =
    await backgroundApiProxy.serviceSwap.buildWrapperTransaction(params);
  if (wrapperTransaction && wrapperTransaction.encodedTx) {
    backgroundApiProxy.dispatch(
      setQuoteLimited(undefined),
      setResponses(undefined),
      setQuote({
        type: QuoterType.onekey,
        instantRate: '1',
        wrapperTxInfo: wrapperTransaction,
        sellAmount: getTokenAmountString(params.tokenIn, params.typedValue),
        sellTokenAddress: params.tokenIn.tokenIdOnNetwork,
        buyAmount: getTokenAmountString(params.tokenOut, params.typedValue),
        buyTokenAddress: params.tokenOut.tokenIdOnNetwork,
      }),
    );
    return;
  }

  const isRefresh = await backgroundApiProxy.serviceSwap.refreshParams(params);

  if (loading) {
    backgroundApiProxy.dispatch(setLoading(true));
  }

  backgroundApiProxy.dispatch(setError(undefined));
  refs.count += 1;
  try {
    if (!isRefresh) {
      backgroundApiProxy.dispatch(setResponses(undefined));
      await fetchFastestQuote(params);
    } else {
      await refreshQuotes(params);
    }
  } finally {
    refs.count -= 1;
    if (refs.count === 0) {
      backgroundApiProxy.dispatch(setLoading(false));
    }
  }
};
