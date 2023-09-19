import BigNumber from 'bignumber.js';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { SwapQuoter } from '../Swap/quoter';

import {
  getMaticContractAdderess,
  getStMaticContractAdderess,
} from './address';

import type { FetchQuoteParams } from '../Swap/typings';

export async function getStMaticToMaticQuote(input: {
  value: string;
  networkId: string;
  accountId: string;
}) {
  const { networkId, accountId, value } = input;
  const stMatic = await backgroundApiProxy.engine.findToken({
    networkId,
    tokenIdOnNetwork: getStMaticContractAdderess(networkId),
  });
  const matic = await backgroundApiProxy.engine.findToken({
    networkId,
    tokenIdOnNetwork: getMaticContractAdderess(networkId),
  });
  if (!matic || !stMatic) {
    throw new Error('failed to quote swap price');
  }
  const typedValue = new BigNumber(value).toFixed();

  const network = await backgroundApiProxy.engine.getNetwork(networkId);
  const account = await backgroundApiProxy.engine.getAccount(
    accountId,
    networkId,
  );
  const params: FetchQuoteParams = {
    networkOut: network,
    networkIn: network,
    tokenOut: matic,
    tokenIn: stMatic,
    slippagePercentage: '1',
    typedValue,
    independentField: 'INPUT',
    activeAccount: account,
    receivingAddress: account.address,
  };
  const res = await SwapQuoter.client.fetchQuote(params);
  const quote = res?.data;
  if (!quote) {
    throw new Error('failed to build unstake params');
  }
  return { params, quote };
}
