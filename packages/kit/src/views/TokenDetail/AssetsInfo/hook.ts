import { useEffect, useMemo } from 'react';

import B from 'bignumber.js';

import { getBalanceKey } from '@onekeyhq/engine/src/managers/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAccount, useAppSelector } from '../../../hooks';
import {
  useAccountTokensBalance,
  useSingleToken,
  useTokenSupportStakedAssets,
} from '../../../hooks/useTokens';
import { useKeleMinerOverview } from '../../Staking/hooks';

export const useStakingAmount = (props: {
  networkId: string;
  accountId: string;
  tokenId: string;
}) => {
  const { networkId, accountId, tokenId } = props;

  const minerOverview = useKeleMinerOverview(networkId, accountId);
  const statedSupport = useTokenSupportStakedAssets(networkId, tokenId);

  useEffect(() => {
    if (statedSupport) {
      backgroundApiProxy.serviceStaking.fetchMinerOverview({
        accountId,
        networkId,
      });
    }
  }, [accountId, networkId, statedSupport]);

  return useMemo(
    () => ({
      statedSupport,
      amount: minerOverview?.amount?.total_amount ?? 0,
    }),
    [minerOverview?.amount?.total_amount, statedSupport],
  );
};
export const useAccountTokenDetailAmount = (props: {
  networkId: string;
  accountId: string;
  tokenId: string;
  sendAddress?: string;
}) => {
  const { networkId, accountId, tokenId, sendAddress } = props;

  const { account } = useAccount({
    networkId,
    accountId,
  });

  const balances = useAccountTokensBalance(networkId, accountId);
  const { token } = useSingleToken(networkId, tokenId);

  const { balance: accountAmount } = balances[
    getBalanceKey({
      ...token,
      sendAddress,
    })
  ] ?? {
    balance: '0',
  };

  const { amount: stakingAmount } = useStakingAmount(props);

  const defiTokenAmount = useAppSelector((s) => {
    const defis = s.overview.defi?.[`${networkId}--${account?.address ?? ''}`];
    if (!defis) {
      return new B(0);
    }
    // sum.plus(next.protocolValue), new B(0))
    return defis.reduce((protocolSum, obj) => {
      const poolTokens = obj.pools.reduce((poolTypeSum, [, items]) => {
        const tokensValues = items.reduce(
          (allTokenSum, { supplyTokens, rewardTokens }) => {
            const supplyTokenSum = supplyTokens
              .filter((t) => t.tokenAddress === tokenId)
              .reduce(
                (tokenSum, sToken) => tokenSum.plus(sToken.balanceParsed ?? 0),
                new B(0),
              );
            const rewardTokenSum = rewardTokens
              .filter((t) => t.tokenAddress === tokenId)
              .reduce(
                (tokenSum, rToken) => tokenSum.plus(rToken.balanceParsed ?? 0),
                new B(0),
              );
            return allTokenSum.plus(supplyTokenSum).plus(rewardTokenSum);
          },
          new B(0),
        );
        return poolTypeSum.plus(tokensValues);
      }, new B(0));
      return protocolSum.plus(poolTokens);
    }, new B(0));
  });

  return useMemo(
    () => ({
      totalAmount: defiTokenAmount.plus(stakingAmount).plus(accountAmount),
    }),
    [accountAmount, defiTokenAmount, stakingAmount],
  );
};
